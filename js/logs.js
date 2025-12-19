// Local: js/logs.js

let logsSubscription = null;
let cacheNomesLogs = {}; // Armazena: { "joao.silva": "João Silva", ... }

// --- DICIONÁRIO DE TRADUÇÃO (Códigos -> Texto Humano) ---
const dicionarioAcoes = {
    'LOGIN': '🔑 Entrou no Sistema',
    'ACESSO': '👋 Acessou',
    'COPIAR_RANK': '📋 Copiou uma frase',
    'CRIAR': '✨ Criou novo registro',
    'CRIAR_USER': '👤 Cadastrou usuário',
    'EDITAR': '✏️ Editou informações',
    'EDITAR_USER': '🔧 Alterou usuário',
    'EXCLUIR': '🗑️ Removeu registro',
    'EXCLUIR_USER': '🚫 Removeu usuário',
    'IMPORTACAO': '📂 Importou planilha',
    'LIMPEZA': '🧹 Padronizou frases'
};

async function carregarLogs() {
    const containerAcessos = document.getElementById('col-acessos');
    const containerUso = document.getElementById('col-uso');
    const containerAuditoria = document.getElementById('col-auditoria');

    // Estado de "Carregando..."
    const loadingHTML = '<p class="text-center text-gray-300 text-xs py-10 animate-pulse">Carregando histórico...</p>';
    if(containerAcessos) containerAcessos.innerHTML = loadingHTML;
    if(containerUso) containerUso.innerHTML = loadingHTML;
    if(containerAuditoria) containerAuditoria.innerHTML = loadingHTML;

    try {
        // 1. Primeiro, carregamos os NOMES REAIS dos usuários para o cache
        await carregarNomesParaCache();

        // 2. Busca os últimos 50 logs
        const { data, error } = await _supabase
            .from('logs')
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Limpa os containers antes de preencher
        limparContainers();

        // Distribui os logs históricos
        data.forEach(log => adicionarLogNaTela(log, false)); 

        // 3. Inicia a escuta em tempo real
        iniciarEscutaRealtime();

    } catch (e) {
        console.error("Erro ao carregar logs:", e);
        Swal.fire('Erro', 'Não foi possível carregar o histórico.', 'error');
    }
}

// Função auxiliar para buscar nomes reais
async function carregarNomesParaCache() {
    const { data } = await _supabase.from('usuarios').select('username, nome');
    if (data) {
        data.forEach(u => {
            // Se tiver nome, usa o nome. Se não, usa o username formatado.
            cacheNomesLogs[u.username] = u.nome || formatarNome(u.username);
        });
    }
}

function formatarNome(user) {
    if(!user) return 'Desconhecido';
    return user.charAt(0).toUpperCase() + user.slice(1);
}

function limparContainers() {
    const ids = ['col-acessos', 'col-uso', 'col-auditoria'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '';
    });
}

// --- REALTIME ---
function iniciarEscutaRealtime() {
    if (logsSubscription) return;

    logsSubscription = _supabase
        .channel('tabela-logs-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'logs' },
            async (payload) => {
                // Se chegar um log de um usuário novo que não está no cache, tenta buscar rapidinho
                if (!cacheNomesLogs[payload.new.usuario]) {
                    await carregarNomesParaCache();
                }
                adicionarLogNaTela(payload.new, true);
            }
        )
        .subscribe();
}

// --- RENDERIZAÇÃO (Agora com Nomes e Tradução) ---
function adicionarLogNaTela(log, animar = false) {
    // 1. Traduzir Ação
    const acaoOriginal = log.acao ? log.acao.toUpperCase() : '';
    // Tenta pegar do dicionário, se não existir, formata o original
    const acaoLegivel = dicionarioAcoes[acaoOriginal] || acaoOriginal.replace('_', ' ');

    // 2. Traduzir Nome do Usuário
    // Usa o cache. Se não achar, usa o ID original
    const nomeExibicao = cacheNomesLogs[log.usuario] || log.usuario;

    // 3. Definir Categoria e Ícone
    let containerId = 'col-auditoria'; 
    let icone = 'fa-info-circle';
    let corIcone = 'text-gray-400';
    let corBg = 'bg-gray-50';

    if (acaoOriginal.includes('LOGIN') || acaoOriginal.includes('ACESSO')) {
        containerId = 'col-acessos';
        icone = 'fa-key';
        corIcone = 'text-green-500';
        corBg = 'bg-green-50';
    } 
    else if (acaoOriginal.includes('COPIAR')) {
        containerId = 'col-uso';
        icone = 'fa-copy';
        corIcone = 'text-blue-500';
        corBg = 'bg-blue-50';
    } 
    else if (['CRIAR', 'EDITAR', 'EXCLUIR', 'IMPORTACAO', 'LIMPEZA'].some(k => acaoOriginal.includes(k))) {
        containerId = 'col-auditoria';
        icone = 'fa-exclamation-triangle';
        corIcone = 'text-orange-500';
        corBg = 'bg-orange-50';
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // 4. Formatação de Data Correta (Locale do Navegador)
    const dataObj = new Date(log.data_hora);
    
    // Força o formato brasileiro: DD/MM às HH:mm
    const diaMes = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const horaMin = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Cálculo de tempo relativo (ex: "há 5 min")
    const diffMinutos = Math.floor((new Date() - dataObj) / 60000);
    let tempoDisplay;
    
    if (diffMinutos < 1) tempoDisplay = 'Agora mesmo';
    else if (diffMinutos < 60) tempoDisplay = `há ${diffMinutos} min`;
    else tempoDisplay = `${diaMes} às ${horaMin}`;

    // HTML do Card
    const animClasses = animar ? 'animate-fade-in-down border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent';

    const html = `
        <div class="p-3 rounded-lg border border-gray-100 bg-white shadow-sm flex gap-3 items-start transition-all hover:bg-gray-50 ${animClasses}">
            <div class="mt-1 w-8 h-8 rounded-full ${corBg} flex items-center justify-center shrink-0">
                <i class="fas ${icone} ${corIcone} text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <p class="text-xs font-bold text-gray-800 truncate" title="${log.usuario}">${nomeExibicao}</p>
                    <span class="text-[9px] font-mono text-gray-400 whitespace-nowrap ml-2" title="${dataObj.toLocaleString()}">${tempoDisplay}</span>
                </div>
                <p class="text-[10px] font-bold uppercase text-blue-600 mt-0.5 tracking-wide">${acaoLegivel}</p>
                <p class="text-xs text-gray-500 leading-tight mt-1 break-words">${log.detalhe || ''}</p>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);

    if (container.children.length > 50) {
        container.lastElementChild.remove();
    }
}

// Estilo de animação
const styleLogs = document.createElement('style');
styleLogs.innerHTML = `
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
    animation: fadeInDown 0.5s ease-out forwards;
}
`;
document.head.appendChild(styleLogs);
