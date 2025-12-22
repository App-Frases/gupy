// Configurações do Supabase
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;

// Tornar a função global anexando ao objeto window
window.fazerLogin = async function() {
    console.log("Tentativa de login iniciada...");
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;

    try {
        const { data, error } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('username', u)
            .eq('senha', p);
        
        if (error) throw error;

        if (data && data.length) {
            usuarioLogado = data[0];
            if (usuarioLogado.ativo === false) {
                return Swal.fire('Bloqueado', 'Sua conta está inativa.', 'error');
            }
            
            localStorage.setItem('gupy_session', JSON.stringify(usuarioLogado));
            
            // Registra o log de acesso
            if (typeof registrarLog === 'function') {
                await registrarLog('LOGIN', 'Acesso realizado');
            }
            
            entrarNoSistema();
        } else {
            Swal.fire('Erro', 'Usuário ou senha incorretos.', 'warning');
        }
    } catch (e) {
        console.error("Erro no login:", e);
        Swal.fire('Erro', 'Falha na conexão ou chave inválida.', 'error');
    }
};

function entrarNoSistema() {
    const loginFlow = document.getElementById('login-flow');
    const appFlow = document.getElementById('app-flow');
    
    if (loginFlow) loginFlow.classList.add('hidden');
    if (appFlow) appFlow.classList.remove('hidden');
    
    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay && usuarioLogado) {
        nameDisplay.innerText = usuarioLogado.nome || usuarioLogado.username;
    }
    
    const adminMenu = document.getElementById('admin-menu-items');
    if (adminMenu && usuarioLogado.perfil === 'admin') {
        adminMenu.classList.remove('hidden');
    }

    // Inicializa os módulos secundários
    if (typeof carregarFrases === 'function') carregarFrases();
    if (typeof iniciarChat === 'function') iniciarChat();
}

// Utilitário de Log
async function registrarLog(acao, detalhe) {
    if (!usuarioLogado) return;
    try {
        await _supabase.from('logs').insert([{
            usuario: usuarioLogado.username,
            acao: acao,
            detalhe: String(detalhe)
        }]);
    } catch (e) { console.error("Erro ao registrar log:", e); }
}

// Utilitários de Texto
function normalizar(t) { return t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""; }
function formatarTextoBonito(t, tipo) { 
    if (!t) return ""; 
    let l = t.trim(); 
    if (tipo === 'titulo') return l.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()); 
    return l.charAt(0).toUpperCase() + l.slice(1); 
}

// Verificação de sessão ao carregar página
window.addEventListener('DOMContentLoaded', () => {
    const session = localStorage.getItem('gupy_session');
    if (session) {
        usuarioLogado = JSON.parse(session);
        entrarNoSistema();
    }
});

function logout() {
    localStorage.removeItem('gupy_session');
    location.reload();
}
