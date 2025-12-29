// Local: js/app.js

let usuarioLogado = null;
let abaAtiva = 'biblioteca';
let chatAberto = false;
let debounceTimer;
let cacheNomesChat = {}; 
let mediaRecorder = null;
let audioChunks = [];

// Variáveis para controle do Chat (Polling/Realtime)
let pollingInterval = null; 
let maiorIdMensagem = 0; // Guarda o ID da última mensagem vista

window.onload = function() { 
    try {
        const s = localStorage.getItem('gupy_session'); 
        if(s) { 
            usuarioLogado = JSON.parse(s); 
            if(usuarioLogado && usuarioLogado.primeiro_acesso) {
                document.getElementById('login-flow').classList.add('hidden');
                document.getElementById('first-access-modal').classList.remove('hidden');
            } else {
                entrarNoSistema(); 
            }
        } 
        else {
            document.getElementById('login-flow').classList.remove('hidden'); 
        }
    } catch (error) {
        console.error("Erro inicialização:", error);
        localStorage.removeItem('gupy_session');
        document.getElementById('login-flow').classList.remove('hidden');
    }
};

async function fazerLogin() {
    const u = document.getElementById('login-user').value; 
    const p = document.getElementById('login-pass').value;
    try { 
        const { data, error } = await _supabase.from('usuarios').select('*').eq('username', u).eq('senha', p);
        if (error) return Swal.fire('Erro', error.message, 'error');
        
        if (data && data.length) { 
            const usuario = data[0];
            if (usuario.ativo === false) return Swal.fire('Bloqueado', 'Conta inativada.', 'error');
            usuarioLogado = usuario; 
            localStorage.setItem('gupy_session', JSON.stringify(usuarioLogado));
            
            localStorage.setItem('gupy_ultimo_login_diario', new Date().toISOString().split('T')[0]); 
            
            if(usuarioLogado.primeiro_acesso) {
                document.getElementById('login-flow').classList.add('hidden');
                document.getElementById('first-access-modal').classList.remove('hidden');
            } else {
                registrarLog('LOGIN', 'Acesso realizado via Login'); 
                entrarNoSistema();
            }
        } else Swal.fire('Erro', 'Dados incorretos', 'warning');
    } catch (e) { Swal.fire('Erro', 'Conexão falhou', 'error'); }
}

function entrarNoSistema() {
    try {
        document.getElementById('login-flow').classList.add('hidden');
        document.getElementById('app-flow').classList.remove('hidden');
        
        const userNameDisplay = document.getElementById('user-name-display');
        const userAvatar = document.getElementById('avatar-initial');
        const roleLabel = document.getElementById('user-role-display'); 
        const adminMenu = document.getElementById('admin-menu-items');

        if(userNameDisplay && usuarioLogado) userNameDisplay.innerText = usuarioLogado.nome || usuarioLogado.username;
        if(userAvatar && usuarioLogado) userAvatar.innerText = (usuarioLogado.nome || usuarioLogado.username).charAt(0).toUpperCase();

        if (usuarioLogado.perfil === 'admin') { 
            if(roleLabel) { roleLabel.innerText = 'Administrador'; roleLabel.classList.add('text-yellow-400'); }
            if(adminMenu) { adminMenu.classList.remove('hidden'); adminMenu.classList.add('flex'); }
        } else { 
            if(roleLabel) { roleLabel.innerText = 'Colaborador'; roleLabel.classList.add('text-blue-300'); }
            if(adminMenu) { adminMenu.classList.add('hidden'); adminMenu.classList.remove('flex'); }
        }

        carregarNomesChat();
        navegar('biblioteca'); 
        iniciarHeartbeat(); 
        iniciarChat(); 
    } catch (error) {
        console.error("Erro entrarNoSistema:", error);
        navegar('biblioteca');
    }
}

async function atualizarSenhaPrimeiroAcesso() {
    const s1 = document.getElementById('new-password').value; 
    const s2 = document.getElementById('confirm-password').value;
    if(s1.length < 4 || s1 !== s2) return Swal.fire('Erro', 'Senhas inválidas', 'warning');
    
    await _supabase.from('usuarios').update({senha: s1, primeiro_acesso: false}).eq('id', usuarioLogado.id);
    usuarioLogado.primeiro_acesso = false; 
    localStorage.setItem('gupy_session', JSON.stringify(usuarioLogado)); 
    document.getElementById('first-access-modal').classList.add('hidden'); 
    
    localStorage.setItem('gupy_ultimo_login_diario', new Date().toISOString().split('T')[0]);
    registrarLog('LOGIN', 'Ativou conta e acessou');
    entrarNoSistema();
}

function logout() { 
    localStorage.removeItem('gupy_session'); 
    localStorage.removeItem('gupy_ultimo_login_diario'); 
    location.reload(); 
}

function navegar(pagina) {
    if (usuarioLogado.perfil !== 'admin' && (pagina === 'logs' || pagina === 'equipe' || pagina === 'dashboard')) pagina = 'biblioteca';
    abaAtiva = pagina;
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    const targetView = document.getElementById(`view-${pagina}`);
    if(targetView) targetView.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active-nav'));
    const btnAtivo = document.getElementById(`menu-${pagina}`);
    if(btnAtivo) btnAtivo.classList.add('active-nav');
    
    const btns = ['btn-add-global', 'btn-add-member', 'btn-refresh-logs'];
    btns.forEach(b => {
        const el = document.getElementById(b);
        if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    
    if (pagina === 'biblioteca') {
        const btn = document.getElementById('btn-add-global');
        if(btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); } 
        const btnFilter = document.getElementById('btn-toggle-filters');
        if(btnFilter) { btnFilter.classList.remove('hidden'); btnFilter.classList.add('flex'); }
        carregarFrases();
    } else {
        const btnFilter = document.getElementById('btn-toggle-filters');
        if(btnFilter) { btnFilter.classList.add('hidden'); btnFilter.classList.remove('flex'); }
        const p = document.getElementById('filter-panel');
        if(p) p.classList.add('hidden');
    }

    if (pagina === 'equipe') {
        const btn = document.getElementById('btn-add-member');
        if(btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
        carregarEquipe();
    } else if (pagina === 'logs') {
        const btn = document.getElementById('btn-refresh-logs');
        if(btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
        carregarLogs();
    } else if (pagina === 'dashboard') {
        carregarDashboard();
    }

    const inputBusca = document.getElementById('global-search');
    if(inputBusca) { 
        inputBusca.value = ''; 
        inputBusca.disabled = (pagina === 'dashboard'); 
        if(pagina === 'biblioteca') inputBusca.placeholder = "🔎 Pesquisar frases...";
        else if(pagina === 'equipe') inputBusca.placeholder = "🔎 Buscar membro...";
        else if(pagina === 'logs') inputBusca.placeholder = "🔎 Filtrar histórico...";
        else inputBusca.placeholder = "Pesquisar...";
    }
}

function debounceBusca() { 
    clearTimeout(debounceTimer); 
    debounceTimer = setTimeout(() => {
        const termo = document.getElementById('global-search').value.toLowerCase();
        if (abaAtiva === 'biblioteca' && typeof aplicarFiltros === 'function') aplicarFiltros();
        if (abaAtiva === 'equipe' && typeof filtrarEquipe === 'function') filtrarEquipe(termo);
        if (abaAtiva === 'logs' && typeof filtrarLogs === 'function') filtrarLogs(termo);
    }, 300); 
}

// --- FUNÇÕES DE CHAT (Híbrido: Realtime + Polling de Segurança) ---

async function carregarNomesChat() {
    const { data } = await _supabase.from('usuarios').select('username, nome');
    if(data) data.forEach(u => cacheNomesChat[u.username] = u.nome || u.username);
}

function iniciarHeartbeat() { const beat = async () => { await _supabase.from('usuarios').update({ultimo_visto: new Date().toISOString()}).eq('id', usuarioLogado.id); updateOnline(); }; beat(); setInterval(beat, 15000); }

async function updateOnline() { const {data} = await _supabase.from('usuarios').select('username').gt('ultimo_visto', new Date(Date.now()-60000).toISOString()); if(data){ document.getElementById('online-count').innerText = `${data.length} Online`; document.getElementById('online-users-list').innerText = data.map(u=>u.username).join(', '); document.getElementById('badge-online').classList.toggle('hidden', data.length<=1); }}

function toggleChat() { const w = document.getElementById('chat-window'); chatAberto = !chatAberto; w.className = chatAberto ? "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-open" : "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-closed"; if(chatAberto){ document.getElementById('online-users-list').classList.remove('hidden'); const btn = document.getElementById('chat-toggle-btn'); btn.classList.remove('bg-orange-500', 'animate-bounce'); btn.classList.add('bg-blue-600'); document.getElementById('badge-unread').classList.add('hidden'); } }

function iniciarChat() {
    const container = document.getElementById('chat-messages');
    if(container.innerHTML === '') {
        container.innerHTML = '<div class="text-center text-slate-400 py-4"><i class="fas fa-circle-notch fa-spin"></i> Conectando...</div>';
    }

    // 1. Carrega Histórico Inicial
    _supabase.from('chat_mensagens')
        .select('*')
        .order('created_at',{ascending:true})
        .limit(50)
        .then(({data, error})=>{
            if(!data) return;
            // Limpa o loading
            if(container.innerHTML.includes('Conectando')) container.innerHTML = '';
            
            data.forEach(m => addMsg(m, true));
        });

    // 2. Tenta Conectar via Realtime (WebSocket)
    _supabase.removeAllChannels();
    _supabase.channel('chat-room')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, payload => {
            addMsg(payload.new, false);
        })
        .subscribe();

    // 3. ATIVA O POLLING (Plano B - Verifica a cada 3 segundos)
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(buscarNovasMensagens, 3000);
}

// Função Auxiliar de Polling (Busca mensagens que o WebSocket perdeu)
async function buscarNovasMensagens() {
    if (maiorIdMensagem === 0) return; // Espera carregar o histórico primeiro

    const { data } = await _supabase
        .from('chat_mensagens')
        .select('*')
        .gt('id', maiorIdMensagem) // Só traz mensagens novas (ID maior que o último)
        .order('created_at', { ascending: true });

    if (data && data.length > 0) {
        data.forEach(m => addMsg(m, false));
    }
}

// 2. Enviar Texto (Otimizado)
async function enviarMensagemTexto() {
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if (!texto) return;

    input.value = ''; 
    input.focus();

    try {
        const { data, error } = await _supabase.from('chat_mensagens').insert([{
            usuario: usuarioLogado.username,
            mensagem: texto,
            perfil: usuarioLogado.perfil,
            tipo: 'texto'
        }]).select();

        if (error) throw error;

        // Mostra na tela imediatamente (Otimista)
        if (data && data.length > 0) {
            addMsg(data[0], false);
        }

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível enviar a mensagem.', 'error');
    }
}

// 3. Enviar Arquivo
async function enviarArquivoSelecionado(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = document.querySelector('button[title="Enviar Arquivo"] i');
    const originalIcon = btn.className;
    btn.className = "fas fa-circle-notch fa-spin text-blue-500";

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await _supabase.storage.from('chat-files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: publicData } = _supabase.storage.from('chat-files').getPublicUrl(filePath);
        
        const { data: msgData, error: msgError } = await _supabase.from('chat_mensagens').insert([{
            usuario: usuarioLogado.username,
            mensagem: file.name,
            perfil: usuarioLogado.perfil,
            tipo: 'arquivo',
            url_arquivo: publicData.publicUrl,
            nome_arquivo: file.name
        }]).select();

        if (msgError) throw msgError;

        if (msgData && msgData.length > 0) {
            addMsg(msgData[0], false);
        }

        input.value = ''; 
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao enviar arquivo', 'error');
    } finally {
        btn.className = originalIcon;
    }
}

// 4. Gravação de Voz
async function toggleGravacao() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        iniciarGravacao();
    } else {
        pararGravacao();
    }
}

async function iniciarGravacao() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            enviarAudioBlob(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        document.getElementById('recording-overlay').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Permissão de microfone negada.', 'warning');
    }
}

function pararGravacao() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('recording-overlay').classList.add('hidden');
    }
}

async function enviarAudioBlob(blob) {
    const fileName = `audio_${Date.now()}.mp3`;
    
    try {
        const { error: uploadError } = await _supabase.storage.from('chat-files').upload(fileName, blob);
        if (uploadError) throw uploadError;

        const { data: publicData } = _supabase.storage.from('chat-files').getPublicUrl(fileName);
        
        const { data: msgData, error: msgError } = await _supabase.from('chat_mensagens').insert([{
            usuario: usuarioLogado.username,
            mensagem: 'Mensagem de Voz',
            perfil: usuarioLogado.perfil,
            tipo: 'audio',
            url_arquivo: publicData.publicUrl
        }]).select();

        if (msgError) throw msgError;

        if (msgData && msgData.length > 0) {
            addMsg(msgData[0], false);
        }

    } catch (e) {
        console.error("Erro upload audio:", e);
    }
}

// 5. Renderizar Mensagem (Com Anti-Duplicidade e Atualização de ID)
function addMsg(msg, isHistory) {
    // 1. Atualiza o ponteiro de última mensagem vista (para o Polling saber onde parou)
    if (msg.id > maiorIdMensagem) {
        maiorIdMensagem = msg.id;
    }

    // 2. Prevenção de Duplicidade: Verifica se a msg já existe na tela
    if (document.getElementById(`msg-${msg.id}`)) return;

    const c = document.getElementById('chat-messages');
    const me = msg.usuario === usuarioLogado.username;
    const nomeMostrar = cacheNomesChat[msg.usuario] || msg.usuario;
    
    let contentHtml = '';
    
    if (msg.tipo === 'audio' && msg.url_arquivo) {
        contentHtml = `<audio controls class="w-full max-w-[200px] h-8 mt-1" src="${msg.url_arquivo}"></audio>`;
    } else if (msg.tipo === 'arquivo' && msg.url_arquivo) {
        const ext = msg.nome_arquivo ? msg.nome_arquivo.split('.').pop().toLowerCase() : '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            contentHtml = `<a href="${msg.url_arquivo}" target="_blank"><img src="${msg.url_arquivo}" class="max-w-[150px] rounded-lg mt-1 border border-white/20" alt="Imagem"></a>`;
        } else {
            contentHtml = `<a href="${msg.url_arquivo}" target="_blank" class="flex items-center gap-2 bg-slate-100 p-2 rounded-lg mt-1 hover:bg-slate-200 text-slate-700 no-underline"><i class="fas fa-file-download text-lg text-blue-500"></i><span class="text-xs font-bold underline decoration-dotted truncate max-w-[120px]">${msg.nome_arquivo || 'Arquivo'}</span></a>`;
        }
    } else {
        contentHtml = `<span>${msg.mensagem}</span>`;
    }

    const html = `
        <div id="msg-${msg.id}" class="flex flex-col ${me?'items-end':'items-start'} mb-3 animate-fade-in">
            <span class="text-[9px] text-gray-400 font-bold ml-1 mb-0.5">${me?'':nomeMostrar}</span>
            <div class="px-3 py-2 rounded-2xl ${me?'bg-blue-600 text-white rounded-br-none':'bg-white border border-gray-200 text-gray-700 rounded-bl-none'} max-w-[85%] break-words shadow-sm flex flex-col">
                ${contentHtml}
            </div>
        </div>`;
    
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;

    if (!isHistory && !chatAberto && !me) {
        const btn = document.getElementById('chat-toggle-btn');
        btn.classList.remove('bg-blue-600');
        btn.classList.add('bg-orange-500', 'animate-bounce');
        document.getElementById('badge-unread').classList.remove('hidden');
    }
}

// --- CALCULADORA UNIVERSAL ---
function mudarModoCalculadora(modo) {
    if(typeof window.modoCalculadora !== 'undefined') window.modoCalculadora = modo;
    else modoCalculadora = modo; 
    
    const btnIntervalo = document.getElementById('btn-mode-intervalo');
    const btnSoma = document.getElementById('btn-mode-soma');
    
    if (modo === 'intervalo') {
        btnIntervalo.className = "px-4 py-2 rounded-lg text-sm font-bold shadow-sm bg-white text-blue-600 transition";
        btnSoma.className = "px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition";
        document.getElementById('container-input-dias').classList.add('hidden');
        document.getElementById('resultado-soma').classList.add('hidden');
        document.getElementById('label-data-base').innerText = "Data Inicial / Nascimento";
    } else {
        btnSoma.className = "px-4 py-2 rounded-lg text-sm font-bold shadow-sm bg-white text-blue-600 transition";
        btnIntervalo.className = "px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition";
        document.getElementById('container-input-dias').classList.remove('hidden');
        document.getElementById('resultado-intervalo').classList.add('hidden');
        document.getElementById('label-data-base').innerText = "Data Inicial";
    }
}

function processarCalculadora() {
    const valData = document.getElementById('calc-data-input').value;
    if(valData.length !== 10) return Swal.fire('Data incompleta', 'Formato DD/MM/AAAA', 'warning');
    
    const parts = valData.split('/'); 
    const dataBase = new Date(parts[2], parts[1]-1, parts[0]);
    if (isNaN(dataBase.getTime())) return Swal.fire('Erro', 'Data inválida', 'error');

    // Verifica modo (compatível com var global ou local)
    const modo = (typeof window.modoCalculadora !== 'undefined') ? window.modoCalculadora : 'intervalo';

    if (modo === 'intervalo') {
        calcularModoIntervalo(dataBase, valData);
    } else {
        calcularModoSoma(dataBase);
    }
}

function calcularModoIntervalo(dNasc, textoOriginal) {
    const hoje = new Date(); 
    dNasc.setHours(0,0,0,0); hoje.setHours(0,0,0,0);
    if (dNasc > hoje) return Swal.fire('Erro', 'Para calcular idade, a data não pode ser futura.', 'warning');
    
    const diffTime = Math.abs(hoje - dNasc);
    const totalDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let anos = hoje.getFullYear() - dNasc.getFullYear();
    let meses = hoje.getMonth() - dNasc.getMonth();
    let diasRestantes = hoje.getDate() - dNasc.getDate();

    if (diasRestantes < 0) { meses--; diasRestantes += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate(); }
    if (meses < 0) { anos--; meses += 12; }
    
    const semanas = Math.floor(diasRestantes / 7);
    const diasFinais = diasRestantes % 7;
    
    document.getElementById('res-data-base').innerText = textoOriginal;
    document.getElementById('res-total-dias').innerText = totalDias.toLocaleString('pt-BR');
    document.getElementById('res-anos').innerText = anos;
    document.getElementById('res-meses').innerText = meses;
    document.getElementById('res-semanas').innerText = semanas;
    document.getElementById('res-dias').innerText = diasFinais;
    
    document.getElementById('resultado-intervalo').classList.remove('hidden');
    document.getElementById('resultado-soma').classList.add('hidden');
}

function calcularModoSoma(dataBase) {
    const inputDias = document.getElementById('calc-dias-input');
    const diasParaSomar = parseInt(inputDias.value);

    if (isNaN(diasParaSomar)) return Swal.fire('Atenção', 'Digite a quantidade de dias.', 'warning');

    const dataFutura = new Date(dataBase);
    dataFutura.setDate(dataFutura.getDate() + diasParaSomar);

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const dataComparacao = new Date(dataFutura);
    dataComparacao.setHours(0,0,0,0);

    const dia = String(dataFutura.getDate()).padStart(2, '0');
    const mes = String(dataFutura.getMonth() + 1).padStart(2, '0');
    const ano = dataFutura.getFullYear();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemanaTexto = diasSemana[dataFutura.getDay()];

    const box = document.getElementById('box-resultado-soma');
    const label = document.getElementById('label-resultado-soma');
    const textoData = document.getElementById('res-data-futura');
    const textoSemana = document.getElementById('res-dia-semana');

    box.className = "border-2 rounded-3xl p-8 flex flex-col justify-center items-center text-center shadow-sm transition-colors duration-300";
    label.className = "text-xs font-bold uppercase tracking-widest mb-2";
    textoData.className = "text-4xl md:text-5xl font-black mb-2 font-mono";
    textoSemana.className = "text-sm font-bold px-3 py-1 rounded-lg";

    if (dataComparacao < hoje) {
        box.classList.add('bg-red-50', 'border-red-100');
        label.classList.add('text-red-500');
        label.innerText = "⚠️ Boleto Vencido"; 
        textoData.classList.add('text-red-700');
        textoSemana.classList.add('text-red-600', 'bg-red-100');
    } else {
        box.classList.add('bg-emerald-50', 'border-emerald-100');
        label.classList.add('text-emerald-500');
        label.innerText = "A data futura será";
        textoData.classList.add('text-emerald-700');
        textoSemana.classList.add('text-emerald-600', 'bg-emerald-100');
    }

    textoData.innerText = `${dia}/${mes}/${ano}`;
    textoSemana.innerText = diaSemanaTexto;

    document.getElementById('resultado-soma').classList.remove('hidden');
    document.getElementById('resultado-intervalo').classList.add('hidden');
}

function calcularIdadeHeader() {
    abrirModalCalculadora();
}
