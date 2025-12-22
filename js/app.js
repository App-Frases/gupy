// Configurações do Supabase
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
// SUBSTITUA PELA SUA CHAVE 'ANON' 'PUBLIC' REAL DO PAINEL DO SUPABASE
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E'; 

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;
let chatAberto = false;
let cacheNomesChat = {};

// Login Globalizado
window.fazerLogin = async function() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;

    try {
        const { data, error } = await _supabase.from('usuarios').select('*').eq('username', u).eq('senha', p);
        
        if (error) throw error;

        if (data && data.length) {
            usuarioLogado = data[0];
            if (usuarioLogado.ativo === false) return Swal.fire('Bloqueado', 'Conta inativa.', 'error');
            
            localStorage.setItem('gupy_session', JSON.stringify(usuarioLogado));
            await registrarLog('LOGIN', 'Acesso realizado');
            entrarNoSistema();
        } else {
            Swal.fire('Erro', 'Usuário ou senha incorretos.', 'warning');
        }
    } catch (e) {
        console.error("Erro no login:", e);
        Swal.fire('Erro', 'Chave de API inválida ou falha de conexão.', 'error');
    }
};

function entrarNoSistema() {
    document.getElementById('login-flow').classList.add('hidden');
    document.getElementById('app-flow').classList.remove('hidden');
    document.getElementById('user-name-display').innerText = usuarioLogado.nome || usuarioLogado.username;
    
    if (usuarioLogado.perfil === 'admin') {
        document.getElementById('admin-menu-items').classList.remove('hidden');
    }

    iniciarChat();
    carregarFrases(); // Inicia biblioteca
}

// Lógica de Registro de Log
async function registrarLog(acao, detalhe) {
    if (!usuarioLogado) return;
    await _supabase.from('logs').insert([{
        usuario: usuarioLogado.username,
        acao: acao,
        detalhe: String(detalhe)
    }]);
}

// Chat em Tempo Real
function iniciarChat() {
    const msgContainer = document.getElementById('chat-messages');
    if (!msgContainer) return;

    _supabase.from('chat_mensagens').select('*').order('created_at', { ascending: true }).limit(50)
    .then(({ data }) => {
        msgContainer.innerHTML = '';
        if (data) data.forEach(m => addMsg(m));
    });

    _supabase.channel('public:chat_mensagens')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, payload => {
        addMsg(payload.new);
    }).subscribe();
}

window.enviarMensagem = async function() {
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if (!texto) return;

    await _supabase.from('chat_mensagens').insert([{
        usuario: usuarioLogado.username,
        mensagem: texto,
        perfil: usuarioLogado.perfil
    }]);
    input.value = '';
};

function addMsg(msg) {
    const c = document.getElementById('chat-messages');
    if (!c) return;
    const me = msg.usuario === usuarioLogado.username;
    const msgHtml = `<div class="flex flex-col ${me ? 'items-end' : 'items-start'} mb-2">
        <span class="text-[9px] text-slate-400 font-bold px-1">${me ? '' : msg.usuario}</span>
        <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${me ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}">
            ${msg.mensagem}
        </div>
    </div>`;
    c.insertAdjacentHTML('beforeend', msgHtml);
    c.scrollTop = c.scrollHeight;
}

// Utilitários de Texto
function normalizar(t) { return t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""; }
function formatarTextoBonito(t, tipo) { if (!t) return ""; let l = t.trim(); if (tipo === 'titulo') return l.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()); return l.charAt(0).toUpperCase() + l.slice(1); }
