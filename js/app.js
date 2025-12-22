// Local: js/app.js

// Configurações Globais
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'SUA_CHAVE_AQUI'; // Use a chave que te passei anteriormente
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;
let chatAberto = false;
let cacheNomesChat = {}; 

// Esta função deve estar fora de qualquer bloco para ser "visível" pelo HTML
async function fazerLogin() {
    console.log("Tentativa de login iniciada...");
    const u = document.getElementById('login-user').value; 
    const p = document.getElementById('login-pass').value;

    try { 
        const { data, error } = await _supabase.from('usuarios').select('*').eq('username', u).eq('senha', p);
        
        if (error) throw error;
        
        if (data && data.length) { 
            const usuario = data[0];
            if (usuario.ativo === false) return Swal.fire('Bloqueado', 'Sua conta está inativa.', 'error');
            
            usuarioLogado = usuario; 
            localStorage.setItem('gupy_session', JSON.stringify(usuarioLogado)); 
            
            // Registra log apenas no clique real de login
            await registrarLog('LOGIN', 'Acesso realizado via formulário'); 
            
            entrarNoSistema();
        } else {
            Swal.fire('Erro', 'Usuário ou senha incorretos.', 'warning');
        }
    } catch (e) { 
        console.error("Erro no login:", e);
        Swal.fire('Erro', 'Falha na conexão com o servidor.', 'error'); 
    }
}

function entrarNoSistema() {
    document.getElementById('login-flow').classList.add('hidden');
    document.getElementById('app-flow').classList.remove('hidden');
    
    // Configura interface básica
    document.getElementById('user-name-display').innerText = usuarioLogado.nome || usuarioLogado.username;
    
    if (usuarioLogado.perfil === 'admin') {
        document.getElementById('admin-menu-items').classList.remove('hidden');
    }

    // Inicia o Chat e o Realtime
    iniciarChat();
    carregarFrases(); // Inicia biblioteca
}

// --- LÓGICA DO CHAT ---

function iniciarChat() {
    const msgContainer = document.getElementById('chat-messages');
    if(!msgContainer) return;

    // 1. Carrega histórico (Últimas 50)
    _supabase.from('chat_mensagens').select('*').order('created_at', {ascending: true}).limit(50)
    .then(({data}) => {
        msgContainer.innerHTML = '';
        if(data) data.forEach(m => addMsg(m, true));
    });

    // 2. Escuta novas mensagens (Realtime)
    _supabase.channel('custom-filter-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, payload => {
        addMsg(payload.new, false);
    })
    .subscribe();
}

async function enviarMensagem() {
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if(!texto) return;

    const { error } = await _supabase.from('chat_mensagens').insert([{
        usuario: usuarioLogado.username,
        mensagem: texto,
        perfil: usuarioLogado.perfil
    }]);

    if(!error) input.value = '';
}

function addMsg(msg, isHistory) {
    const c = document.getElementById('chat-messages');
    if(!c) return;

    const me = msg.usuario === usuarioLogado.username;
    const msgHtml = `
        <div class="flex flex-col ${me ? 'items-end' : 'items-start'} mb-2 animate-fade-in">
            <span class="text-[9px] text-slate-400 font-bold px-1">${me ? '' : msg.usuario}</span>
            <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm 
                ${me ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}">
                ${msg.mensagem}
            </div>
        </div>`;
    
    c.insertAdjacentHTML('beforeend', msgHtml);
    c.scrollTop = c.scrollHeight;
}

// Função de Log Global
async function registrarLog(acao, detalhe) { 
    if(!usuarioLogado) return;
    await _supabase.from('logs').insert([{
        usuario: usuarioLogado.username, 
        acao: acao, 
        detalhe: detalhe
    }]); 
}
