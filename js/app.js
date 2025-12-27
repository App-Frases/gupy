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
            
            // Marca o login de hoje para não duplicar log na cópia
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
        document.getElementById('btn-clear-search').classList.add('hidden');
        inputBusca.disabled = (pagina === 'dashboard'); 
        if(pagina === 'biblioteca') inputBusca.placeholder = "🔎 Pesquisar frases...";
        else if(pagina === 'equipe') inputBusca.placeholder = "🔎 Buscar membro...";
        else if(pagina === 'logs') inputBusca.placeholder = "🔎 Filtrar histórico...";
        else inputBusca.placeholder = "Pesquisar...";
    }
}

function debounceBusca() { 
    // Controle Visual do Botão "X"
    const input = document.getElementById('global-search');
    const btnLimpar = document.getElementById('btn-clear-search');
    
    if (input.value.trim().length > 0) {
        btnLimpar.classList.remove('hidden');
    } else {
        btnLimpar.classList.add('hidden');
    }

    clearTimeout(debounceTimer); 
    debounceTimer = setTimeout(() => {
        const termo = input.value.toLowerCase();
        if (abaAtiva === 'biblioteca' && typeof aplicarFiltros === 'function') aplicarFiltros();
        if (abaAtiva === 'equipe' && typeof filtrarEquipe === 'function') filtrarEquipe(termo);
        if (abaAtiva === 'logs' && typeof filtrarLogs === 'function') filtrarLogs(termo);
    }, 300); 
}

function limparBuscaGlobal() {
    const input = document.getElementById('global-search');
    input.value = '';
    document.getElementById('btn-clear-search').classList.add('hidden');
    
    if (abaAtiva === 'biblioteca' && typeof aplicarFiltros === 'function') aplicarFiltros();
    if (abaAtiva === 'equipe' && typeof filtrarEquipe === 'function') filtrarEquipe('');
    if (abaAtiva === 'logs' && typeof filtrarLogs === 'function') filtrarLogs('');
    
    input.focus(); 
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
