// Local: js/app.js

const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
            
            if(usuarioLogado.primeiro_acesso) {
                    document.getElementById('login-flow').classList.add('hidden');
                    document.getElementById('first-access-modal').classList.remove('hidden');
            } else {
                    entrarNoSistema();
            }
        } else Swal.fire('Erro', 'Dados incorretos', 'warning');
    } catch (e) { Swal.fire('Erro', 'Conexão falhou', 'error'); }
}

function entrarNoSistema() {
    try {
        const loginFlow = document.getElementById('login-flow');
        const appFlow = document.getElementById('app-flow');
        if(loginFlow) loginFlow.classList.add('hidden');
        if(appFlow) appFlow.classList.remove('hidden');
        
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
        registrarLog('LOGIN', 'Acesso realizado'); 
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
    entrarNoSistema();
}

function logout() { localStorage.removeItem('gupy_session'); location.reload(); }

async function registrarLog(acao, detalhe) { 
    if(usuarioLogado) {
        await _supabase.from('logs').insert([{
            usuario: usuarioLogado.username, 
            acao, 
            detalhe,
            data_hora: new Date().toISOString()
        }]); 
    }
}

// --- NAVEGAÇÃO E UTILS ---

function navegar(pagina) {
    if (usuarioLogado.perfil !== 'admin' && (pagina === 'logs' || pagina === 'equipe' || pagina === 'dashboard')) pagina = 'biblioteca';
    abaAtiva = pagina;
    
    // Esconde todas as sections
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden')); 
    // Mostra a selecionada
    const targetView = document.getElementById(`view-${pagina}`);
    if(targetView) targetView.classList.remove('hidden');
    
    // Atualiza classes dos botões do menu
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active-nav'));
    const btnAtivo = document.getElementById(`menu-${pagina}`);
    if(btnAtivo) btnAtivo.classList.add('active-nav');
    
    // Controle da Barra de Filtros e Botões de Ação
    const filterBar = document.getElementById('filter-bar');
    if(filterBar) filterBar.classList.toggle('hidden', pagina !== 'biblioteca' && pagina !== 'equipe' && pagina !== 'logs');
    
    const btns = ['btn-add-global', 'btn-add-member', 'btn-refresh-logs'];
    // Reseta todos para hidden
    btns.forEach(b => document.getElementById(b)?.classList.add('hidden'));
    btns.forEach(b => document.getElementById(b)?.classList.remove('flex')); // Garante que tira o flex se tiver
    
    if (pagina === 'biblioteca') {
        const btn = document.getElementById('btn-add-global');
        if(btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); } // CORRIGIDO: Exibe com flex para alinhar ícone
        carregarFrases();
    } else if (pagina === 'equipe') {
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
    if(inputBusca) { inputBusca.value = ''; inputBusca.disabled = (pagina === 'dashboard'); }
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

function normalizar(t) { return t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""; }
function formatarTextoBonito(t, tipo) { if (!t) return ""; let l = t.trim().replace(/\s+/g, ' '); if (tipo === 'titulo') return l.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()); return l.charAt(0).toUpperCase() + l.slice(1); }

// --- HEADER UTILS (Idade e CEP Corrigidos) ---

function calcularIdadeHeader() {
    const val = document.getElementById('quick-idade').value;
    if(val.length === 10) { document.getElementById('nasc-input').value = val; calcularIdade(); document.getElementById('quick-idade').value = ''; document.getElementById('modal-idade').classList.remove('hidden'); }
}
function buscarCEPHeader() {
    const val = document.getElementById('quick-cep').value;
    if(val.length >= 8) { document.getElementById('cep-input').value = val; buscarCEP(); document.getElementById('quick-cep').value = ''; document.getElementById('modal-cep').classList.remove('hidden'); }
}

// CORREÇÃO DA BUSCA CEP
async function buscarCEP() {
    const cepInput = document.getElementById('cep-input');
    const cep = cepInput.value.replace(/\D/g, ''); 
    const resArea = document.getElementById('cep-resultado'); 
    const loading = document.getElementById('cep-loading');
    
    if(cep.length !== 8) return Swal.fire('Atenção', 'Digite um CEP válido com 8 números', 'warning');
    
    resArea.classList.add('hidden'); 
    loading.classList.remove('hidden');
    
    try { 
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); 
        const data = await res.json(); 
        loading.classList.add('hidden');
        
        if(data.erro) { 
            Swal.fire('Não Encontrado', 'Este CEP não existe na base de dados.', 'info'); 
            return; 
        }
        
        document.getElementById('cep-logradouro').innerText = data.logradouro || '---'; 
        document.getElementById('cep-bairro').innerText = data.bairro || '---'; 
        document.getElementById('cep-localidade').innerText = `${data.localidade}-${data.uf}`;
        document.getElementById('cep-display-num').innerText = cep.replace(/^(\d{5})(\d{3})/, "$1-$2");
        
        resArea.classList.remove('hidden');
    } catch(e) { 
        loading.classList.add('hidden'); 
        Swal.fire('Erro', 'Falha ao consultar servidor de CEP.', 'error'); 
    }
}

// CORREÇÃO DA CALCULADORA DE IDADE (Lógica Robusta)
function calcularIdade() {
    const val = document.getElementById('nasc-input').value; 
    const parts = val.split('/'); 
    if(parts.length !== 3) return Swal.fire('Erro', 'Data inválida. Use DD/MM/AAAA', 'warning');
    
    const dia = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10) - 1; // Meses em JS são 0-11
    const ano = parseInt(parts[2], 10);
    
    const dNasc = new Date(ano, mes, dia);
    const hoje = new Date(); 
    
    // Zera horas para comparação justa
    dNasc.setHours(0,0,0,0); 
    hoje.setHours(0,0,0,0);
    
    if (isNaN(dNasc.getTime()) || dNasc > hoje) return Swal.fire('Erro', 'Data inválida ou futura', 'warning');
    
    // Cálculo preciso de idade
    let anos = hoje.getFullYear() - dNasc.getFullYear();
    let meses = hoje.getMonth() - dNasc.getMonth();
    let dias = hoje.getDate() - dNasc.getDate();

    if (dias < 0) {
        meses--;
        // Pega o último dia do mês anterior para saber quantos dias somar
        dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }
    
    const totalDias = Math.floor((hoje - dNasc) / (1000 * 60 * 60 * 24));

    document.getElementById('data-nasc-display').innerText = `Nascido em: ${val}`;
    document.getElementById('res-total-dias').innerText = totalDias.toLocaleString('pt-BR'); 
    document.getElementById('res-anos').innerText = anos;
    document.getElementById('res-meses').innerText = meses;
    document.getElementById('res-dias').innerText = dias;
    
    document.getElementById('idade-resultado-box').classList.remove('hidden');
}

function mascaraData(i) { let v = i.value.replace(/\D/g, ""); if(v.length>2) v=v.substring(0,2)+"/"+v.substring(2); if(v.length>5) v=v.substring(0,5)+"/"+v.substring(5,9); i.value = v; }
function fecharModalCEP() { document.getElementById('modal-cep').classList.add('hidden'); }
function fecharModalIdade() { document.getElementById('modal-idade').classList.add('hidden'); }
function fecharModalFrase() { document.getElementById('modal-frase').classList.add('hidden'); }
function fecharModalUsuario() { document.getElementById('modal-usuario').classList.add('hidden'); }

// CHAT
async function carregarNomesChat() {
    const { data } = await _supabase.from('usuarios').select('username, nome');
    if(data) data.forEach(u => cacheNomesChat[u.username] = u.nome || u.username);
}
function iniciarHeartbeat() { const beat = async () => { await _supabase.from('usuarios').update({ultimo_visto: new Date().toISOString()}).eq('id', usuarioLogado.id); updateOnline(); }; beat(); setInterval(beat, 15000); }
async function updateOnline() { const {data} = await _supabase.from('usuarios').select('username').gt('ultimo_visto', new Date(Date.now()-60000).toISOString()); if(data){ document.getElementById('online-count').innerText = `${data.length} Online`; document.getElementById('online-users-list').innerText = data.map(u=>u.username).join(', '); document.getElementById('badge-online').classList.toggle('hidden', data.length<=1); }}

function toggleChat() { 
    const w = document.getElementById('chat-window'); 
    chatAberto = !chatAberto; 
    w.className = chatAberto ? "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-open" : "absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col chat-widget chat-closed"; 
    if(chatAberto){ 
        document.getElementById('online-users-list').classList.remove('hidden'); 
        iniciarChat(); 
        const btn = document.getElementById('chat-toggle-btn');
        btn.classList.remove('bg-orange-500', 'animate-bounce'); btn.classList.add('bg-blue-600');
        document.getElementById('badge-unread').classList.add('hidden');
    } 
}

function iniciarChat() { 
    _supabase.from('chat_mensagens').select('*').order('created_at',{ascending:true}).limit(50).then(({data})=>{if(data)data.forEach(m => addMsg(m, true))}); 
    _supabase.channel('chat').on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_mensagens'},p=>addMsg(p.new, false)).subscribe(); 
}

async function enviarMensagem() { const i = document.getElementById('chat-input'); if(i.value.trim()){ await _supabase.from('chat_mensagens').insert([{usuario:usuarioLogado.username, mensagem:i.value.trim(), perfil:usuarioLogado.perfil}]); i.value=''; } }

function addMsg(msg, isHistory) { 
    const c = document.getElementById('chat-messages'); 
    const me = msg.usuario === usuarioLogado.username; 
    const nomeMostrar = cacheNomesChat[msg.usuario] || msg.usuario;
    c.innerHTML += `<div class="flex flex-col ${me?'items-end':'items-start'} mb-2"><span class="text-[9px] text-gray-400 font-bold ml-1">${me?'':nomeMostrar}</span><div class="px-3 py-2 rounded-xl ${me?'bg-blue-600 text-white rounded-br-none':'bg-white border border-gray-200 text-gray-700 rounded-bl-none'} max-w-[85%] break-words shadow-sm">${msg.mensagem}</div></div>`; 
    c.scrollTop = c.scrollHeight; 
    if (!isHistory && !chatAberto && !me) {
        const btn = document.getElementById('chat-toggle-btn');
        btn.classList.remove('bg-blue-600'); btn.classList.add('bg-orange-500', 'animate-bounce');
        document.getElementById('badge-unread').classList.remove('hidden');
    }
}
