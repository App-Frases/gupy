// Local: js/logs.js

let logsSubscription = null;
let cacheNomesLogs = {}; // Cache de nomes { "joao.silva": "João Silva" }
let logsPorUsuario = {}; // Armazena TODOS os logs agrupados na memória: { "joao": [...logs] }

// --- DICIONÁRIO DE TRADUÇÃO ---
const dicionarioAcoes = {
    'LOGIN': '🔑 Entrou',
    'ACESSO': '👋 Acessou',
    'COPIAR_RANK': '📋 Copiou',
    'CRIAR': '✨ Criou',
    'CRIAR_USER': '👤 Add User',
    'EDITAR': '✏️ Editou',
    'EDITAR_USER': '🔧 Alt. User',
    'EXCLUIR': '🗑️ Removeu',
    'EXCLUIR_USER': '🚫 Del User',
    'IMPORTACAO': '📂 Importou',
    'LIMPEZA': '🧹 Limpeza'
};

async function carregarLogs() {
    const viewLogsSection = document.getElementById('view-logs');
    if (!viewLogsSection) return;

    // 1. Preparar o layout
    let containerGeral = document.getElementById('container-logs-agrupados');
    
    if (!containerGeral) {
        const conteudoOriginal = viewLogsSection.querySelector('.grid');
        if(conteudoOriginal) conteudoOriginal.classList.add('hidden');
        
        containerGeral = document.createElement('div');
        containerGeral.id = 'container-logs-agrupados';
        // Ajuste no grid para comportar bem os cards
        containerGeral.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10';
        viewLogsSection.appendChild(containerGeral);
    }

    containerGeral.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10 animate-pulse">Sincronizando atividades...</p>';

    try {
        // 2. Carregar Nomes
        await carregarNomesParaCache();

        // 3. Busca TODOS os logs ordenados por data (limite alto para garantir histórico)
        const { data, error } = await _supabase
            .from('logs')
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(200); // Traz os últimos 200 logs gerais para compor os painéis

        if (error) throw error;

        // 4. Agrupar logs em memória
        logsPorUsuario = {};
        data.forEach(log => {
            const userKey = log.usuario || 'Desconhecido';
            if (!logsPorUsuario[userKey]) logsPorUsuario[userKey] = [];
            logsPorUsuario[userKey].push(log);
        });

        // 5. Renderizar (Padrão: Top 5 Recentes)
        filtrarLogs(''); 

        // 6. Inicia Realtime
        iniciarEscutaRealtime();

    } catch (e) {
        console.error("Erro ao carregar logs:", e);
        // Swal.fire('Erro', 'Falha ao carregar logs.', 'error'); // Opcional: Silenciar erro visual se não for crítico
    }
}

// --- FUNÇÃO CENTRAL DE RENDERIZAÇÃO ---
function filtrarLogs(termo = '') {
    const container = document.getElementById('container-logs-agrupados');
    if (!container) return;
    
    // Se estivermos fazendo apenas uma atualização de realtime (sem busca digitada),
    // queremos preservar o estado visual para não piscar tudo, mas neste caso
    // a prioridade é reordenar. Vamos limpar e redesenhar.
    container.innerHTML = '';
    const termoLower = termo.toLowerCase().trim();

    // 1. Ordena usuários por atividade mais recente (Timestamp do log mais novo)
    // Isso garante que quem fez algo AGORA vá para o topo da lista
    const usuariosOrdenados = Object.keys(logsPorUsuario).sort((a, b) => {
        const logA = logsPorUsuario[a][0];
        const logB = logsPorUsuario[b][0];
        
        const dataA = logA ? new Date(logA.data_hora).getTime() : 0;
        const dataB = logB ? new Date(logB.data_hora).getTime() : 0;
        
        return dataB - dataA; // Decrescente (Maior data primeiro)
    });

    let usuariosParaExibir = [];

    if (!termoLower) {
        // CENÁRIO 1: Sem busca -> Mostra EXATAMENTE os Top 5 mais recentes
        usuariosParaExibir = usuariosOrdenados.slice(0, 5);
    } else {
        // CENÁRIO 2: Com busca -> Filtra
        usuariosParaExibir = usuariosOrdenados.filter(userKey => {
            const nomeReal = (cacheNomesLogs[userKey] || '').toLowerCase();
            const username = userKey.toLowerCase();
            if (nomeReal.includes(termoLower) || username.includes(termoLower)) return true;
            return logsPorUsuario[userKey].some(log => {
                const detalhe = (log.detalhe || '').toLowerCase();
                const acao = (log.acao || '').toLowerCase();
                return detalhe.includes(termoLower) || acao.includes(termoLower);
            });
        });
    }

    if (usuariosParaExibir.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-400 mt-10">Nenhuma atividade recente encontrada.</p>';
        return;
    }

    // Renderiza os cards
    usuariosParaExibir.forEach((userKey, index) => {
        // O primeiro da lista ganha um destaque sutil de "Mais Recente"
        criarCardUsuario(userKey, logsPorUsuario[userKey], container, index === 0 && !termoLower);
    });
}

function criarCardUsuario(userKey, logs, containerPai, isTop1) {
    const nomeExibicao = cacheNomesLogs[userKey] || userKey;
    const totalLogs = logs.length;
    
    const card = document.createElement('div');
    // Adiciona animação de entrada
    card.className = `bg-white rounded-2xl shadow-sm border ${isTop1 ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-200'} overflow-hidden flex flex-col h-[500px] animate-fade-in-down transition-all duration-300`;
    card.id = `card-user-${userKey.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // Cabeçalho
    card.innerHTML = `
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center shrink-0">
            <div class="flex items-center gap-2 overflow-hidden">
                <div class="w-8 h-8 rounded-full ${isTop1 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                    ${userKey.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                    <h3 class="font-extrabold text-gray-700 text-sm truncate flex items-center gap-1">
                        ${nomeExibicao}
                        ${isTop1 ? '<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" title="Ativo Agora"></span>' : ''}
                    </h3>
                    <p class="text-[10px] text-gray-400 font-mono truncate">@${userKey}</p>
                </div>
            </div>
            <span class="text-[10px] font-bold bg-white text-gray-500 px-2 py-1 rounded-full border border-gray-200 shrink-0 shadow-sm">
                ${totalLogs}
            </span>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            ${logs.map((log, i) => gerarHtmlLogItem(log, i === 0)).join('')}
        </div>
    `;

    containerPai.appendChild(card);
}

function gerarHtmlLogItem(log, destaque = false) {
    const acaoOriginal = log.acao ? log.acao.toUpperCase() : '';
    const acaoLegivel = dicionarioAcoes[acaoOriginal] || acaoOriginal;
    
    let corTexto = 'text-gray-600';
    let icone = 'fa-circle';
    
    if (acaoOriginal.includes('LOGIN')) { corTexto = 'text-green-600'; icone = 'fa-key'; }
    else if (acaoOriginal.includes('COPIAR')) { corTexto = 'text-blue-600'; icone = 'fa-copy'; } // Copiar Rank
    else if (acaoOriginal.includes('CRIAR')) { corTexto = 'text-purple-600'; icone = 'fa-plus'; }
    else if (acaoOriginal.includes('EXCLUIR')) { corTexto = 'text-red-500'; icone = 'fa-trash'; }
    else if (acaoOriginal.includes('EDITAR')) { corTexto = 'text-orange-500'; icone = 'fa-pen'; }

    // DATA APENAS (UTC Fix)
    const dataObj = new Date(log.data_hora);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { 
        timeZone: 'UTC', 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit' 
    });

    // Se for o log mais recente (destaque), colocamos um fundo leve
    const bgClass = destaque ? 'bg-blue-50/60 border-blue-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100';

    return `
        <div class="p-2 rounded-lg border ${bgClass} flex gap-2 items-start transition-colors">
            <div class="mt-1 text-[10px] ${corTexto} w-4 text-center shrink-0"><i class="fas ${icone}"></i></div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                    <p class="text-[10px] font-extrabold uppercase ${corTexto}">${acaoLegivel}</p>
                    <span class="text-[9px] font-mono text-gray-400" title="Data">${dataFormatada}</span>
                </div>
                <p class="text-[10px] text-gray-500 leading-tight mt-0.5 break-words">${log.detalhe || ''}</p>
            </div>
        </div>
    `;
}

// --- REALTIME: O CORAÇÃO DA ATUALIZAÇÃO ---
function iniciarEscutaRealtime() {
    if (logsSubscription) _supabase.removeChannel(logsSubscription);

    logsSubscription = _supabase
        .channel('logs-realtime-global')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'logs' },
            async (payload) => {
                const newLog = payload.new;
                
                // 1. Garante que temos o nome do usuário
                if (!cacheNomesLogs[newLog.usuario]) await carregarNomesParaCache();
                
                // 2. Atualiza a ESTRUTURA DE DADOS em memória
                if (!logsPorUsuario[newLog.usuario]) logsPorUsuario[newLog.usuario] = [];
                // Insere no começo do array (unshift) para ser o mais recente desse usuário
                logsPorUsuario[newLog.usuario].unshift(newLog); 
                
                // 3. ATUALIZAÇÃO CRÍTICA:
                // Verificamos se há busca ativa. Se NÃO houver, chamamos filtrarLogs('')
                // Isso força o RE-CÁLCULO da ordem. Se a Samária estava em 10º, agora ela vai para 1º
                // e o renderizador vai desenhar os Top 5 novamente, incluindo ela.
                const searchInput = document.getElementById('global-search');
                const termo = searchInput ? searchInput.value : '';

                filtrarLogs(termo);
            }
        )
        .subscribe();
}

// --- AUXILIARES ---
async function carregarNomesParaCache() {
    const { data } = await _supabase.from('usuarios').select('username, nome');
    if (data) data.forEach(u => cacheNomesLogs[u.username] = u.nome || formatarNome(u.username));
}

function formatarNome(user) {
    if(!user) return 'Desconhecido';
    return user.charAt(0).toUpperCase() + user.slice(1);
}

// Estilos extras
const styleLogs = document.createElement('style');
styleLogs.innerHTML = `
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
    animation: fadeInDown 0.4s ease-out forwards;
}
`;
document.head.appendChild(styleLogs);
