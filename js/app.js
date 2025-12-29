// Local: js/app.js

let usuarioLogado = null;
let abaAtiva = 'biblioteca';
let chatAberto = false;
let debounceTimer;
let cacheNomesChat = {}; 

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
            
            // Marca o login de hoje para não duplicar na cópia
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
    
    // Marca hoje também
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

// --- Funções de Chat e Header ---
async function carregarNomesChat() {
    const { data } = await _supabase.from('usuarios').select('username, nome');
    if(data) data.forEach(u => cacheNomesChat[u.username] = u.nome || u.username);
}
function iniciarHeartbeat() { const beat = async () => { await _supabase.from('usuarios').update({ultimo_visto: new Date().toISOString()}).eq('id', usuarioLogado.id); updateOnline(); }; beat(); setInterval(beat, 15000); }
async function updateOnline() { const {data} = await _supabase.from('usuarios').select('username').gt('ultimo_visto', new Date(Date.now()-60000).toISOString()); if(data){ document.getElementById('online-count').innerText = `${data.length} Online`; document.getElementById('online-users-list').innerText = data.map(u=>u.username).join(', '); document.getElementById('badge-online').classList.toggle('hidden', data.length<=1); }}
function toggleChat() { const w = document.getElementById('chat-window'); chatAberto = !chatAberto; w.className = chatAberto ? "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-open" : "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-closed"; if(chatAberto){ document.getElementById('online-users-list').classList.remove('hidden'); iniciarChat(); const btn = document.getElementById('chat-toggle-btn'); btn.classList.remove('bg-orange-500', 'animate-bounce'); btn.classList.add('bg-blue-600'); document.getElementById('badge-unread').classList.add('hidden'); } }
function iniciarChat() { _supabase.from('chat_mensagens').select('*').order('created_at',{ascending:true}).limit(50).then(({data})=>{if(data)data.forEach(m => addMsg(m, true))}); _supabase.channel('chat').on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_mensagens'},p=>addMsg(p.new, false)).subscribe(); }
async function enviarMensagem() { const i = document.getElementById('chat-input'); if(i.value.trim()){ await _supabase.from('chat_mensagens').insert([{usuario:usuarioLogado.username, mensagem:i.value.trim(), perfil:usuarioLogado.perfil}]); i.value=''; } }
function addMsg(msg, isHistory) { const c = document.getElementById('chat-messages'); const me = msg.usuario === usuarioLogado.username; const nomeMostrar = cacheNomesChat[msg.usuario] || msg.usuario; c.innerHTML += `<div class="flex flex-col ${me?'items-end':'items-start'} mb-2"><span class="text-[9px] text-gray-400 font-bold ml-1">${me?'':nomeMostrar}</span><div class="px-3 py-2 rounded-xl ${me?'bg-blue-600 text-white rounded-br-none':'bg-white border border-gray-200 text-gray-700 rounded-bl-none'} max-w-[85%] break-words shadow-sm">${msg.mensagem}</div></div>`; c.scrollTop = c.scrollHeight; if (!isHistory && !chatAberto && !me) { const btn = document.getElementById('chat-toggle-btn'); btn.classList.remove('bg-blue-600'); btn.classList.add('bg-orange-500', 'animate-bounce'); document.getElementById('badge-unread').classList.remove('hidden'); } }

// Funções Header (CEP)
function buscarCEPHeader() {
    const val = document.getElementById('quick-cep').value;
    if(val.length >= 8) { document.getElementById('cep-input').value = val; buscarCEP(); document.getElementById('quick-cep').value = ''; document.getElementById('modal-cep').classList.remove('hidden'); }
}
async function buscarCEP() {
    const cep = document.getElementById('cep-input').value.replace(/\D/g, ''); 
    const resArea = document.getElementById('cep-resultado'); 
    const loading = document.getElementById('cep-loading');
    if(cep.length !== 8) return Swal.fire('Atenção', 'Digite um CEP válido', 'warning');
    resArea.classList.add('hidden'); loading.classList.remove('hidden');
    try { 
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); 
        const data = await res.json(); 
        loading.classList.add('hidden');
        if(data.erro) return Swal.fire('Não Encontrado', 'CEP não existe', 'info');
        document.getElementById('cep-logradouro').innerText = data.logradouro || '---'; 
        document.getElementById('cep-bairro').innerText = data.bairro || '---'; 
        document.getElementById('cep-localidade').innerText = `${data.localidade}-${data.uf}`;
        document.getElementById('cep-display-num').innerText = cep.replace(/^(\d{5})(\d{3})/, "$1-$2");
        resArea.classList.remove('hidden');
    } catch(e) { loading.classList.add('hidden'); Swal.fire('Erro', 'Falha na conexão', 'error'); }
}

// --- CALCULADORA UNIVERSAL ---
let modoCalculadora = 'intervalo'; // 'intervalo' ou 'soma'

function mudarModoCalculadora(modo) {
    modoCalculadora = modo;
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

    if (modoCalculadora === 'intervalo') {
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

    // 1. Calcula a Data Futura
    const dataFutura = new Date(dataBase);
    dataFutura.setDate(dataFutura.getDate() + diasParaSomar);

    // 2. Prepara variáveis para comparação (Zerando horas para evitar erros)
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    const dataComparacao = new Date(dataFutura);
    dataComparacao.setHours(0,0,0,0);

    // 3. Formatação
    const dia = String(dataFutura.getDate()).padStart(2, '0');
    const mes = String(dataFutura.getMonth() + 1).padStart(2, '0');
    const ano = dataFutura.getFullYear();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemanaTexto = diasSemana[dataFutura.getDay()];

    // 4. Elementos da Tela
    const box = document.getElementById('box-resultado-soma');
    const label = document.getElementById('label-resultado-soma');
    const textoData = document.getElementById('res-data-futura');
    const textoSemana = document.getElementById('res-dia-semana');

    // Limpa classes anteriores
    box.className = "border-2 rounded-3xl p-8 flex flex-col justify-center items-center text-center shadow-sm transition-colors duration-300";
    label.className = "text-xs font-bold uppercase tracking-widest mb-2";
    textoData.className = "text-4xl md:text-5xl font-black mb-2 font-mono";
    textoSemana.className = "text-sm font-bold px-3 py-1 rounded-lg";

    // 5. Lógica Vencido vs Futuro
    if (dataComparacao < hoje) {
        // VENCIDO (VERMELHO)
        box.classList.add('bg-red-50', 'border-red-100');
        label.classList.add('text-red-500');
        label.innerText = "⚠️ Boleto Vencido"; 
        textoData.classList.add('text-red-700');
        textoSemana.classList.add('text-red-600', 'bg-red-100');
    } else {
        // FUTURO (VERDE)
        box.classList.add('bg-emerald-50', 'border-emerald-100');
        label.classList.add('text-emerald-500');
        label.innerText = "A data futura será";
        textoData.classList.add('text-emerald-700');
        textoSemana.classList.add('text-emerald-600', 'bg-emerald-100');
    }

    // Define valores
    textoData.innerText = `${dia}/${mes}/${ano}`;
    textoSemana.innerText = diaSemanaTexto;

    // Exibe
    document.getElementById('resultado-soma').classList.remove('hidden');
    document.getElementById('resultado-intervalo').classList.add('hidden');
}
