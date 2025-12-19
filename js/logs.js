// Local: js/logs.js

let logsSubscription = null;
let cacheNomesLogs = {}; // Cache de nomes
let logsPorUsuario = {}; // Armazena logs agrupados na memória

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
    // Referência ao container principal da view de logs
    const viewLogsSection = document.getElementById('view-logs');
    if (!viewLogsSection) return;

    // 1. Preparar o layout para o novo formato (Agrupado por Usuário)
    // Vamos substituir o grid de 3 colunas original por um container dinâmico
    let containerGeral = document.getElementById('container-logs-agrupados');
    
    if (!containerGeral) {
        // Limpa o conteúdo original (as 3 colunas fixas) e cria o novo container
        const conteudoOriginal = viewLogsSection.querySelector('.grid');
        if(conteudoOriginal) conteudoOriginal.classList.add('hidden'); // Esconde o original em vez de apagar
        
        containerGeral = document.createElement('div');
        containerGeral.id = 'container-logs-agrupados';
        containerGeral.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10';
        viewLogsSection.appendChild(containerGeral);
    }

    containerGeral.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10 animate-pulse">Carregando histórico completo...</p>';

    try {
        // 2. Carregar Nomes
        await carregarNomesParaCache();

        // 3. Busca TODOS os logs (Sem limite)
        const { data, error } = await _supabase
            .from('logs')
            .select('*')
            .order('data_hora', { ascending: false }); // Do mais recente para o mais antigo

        if (error) throw error;

        // 4. Agrupar logs em memória
        logsPorUsuario = {};
        data.forEach(log => {
            const userKey = log.usuario || 'Desconhecido';
            if (!logsPorUsuario[userKey]) logsPorUsuario[userKey] = [];
            logsPorUsuario[userKey].push(log);
        });

        // 5. Renderizar na tela
        renderizarLogsAgrupados();

        // 6. Inicia Realtime
        iniciarEscutaRealtime();

    } catch (e) {
        console.error("Erro ao carregar logs:", e);
        Swal.fire('Erro', 'Falha ao carregar logs.', 'error');
    }
}

function renderizarLogsAgrupados() {
    const container = document.getElementById('container-logs-agrupados');
    if (!container) return;
    
    container.innerHTML = ''; // Limpa loading

    // Ordenar usuários: Usuário logado primeiro, depois alfabético? Ou quem tem log mais recente?
    // Vamos ordenar por quem tem o log mais recente (já que a query veio ordenada por data)
    const usuariosOrdenados = Object.keys(logsPorUsuario).sort((a, b) => {
        // Pega a data do log mais recente de cada um
        const dataA = logsPorUsuario[a][0]?.data_hora || 0;
        const dataB = logsPorUsuario[b][0]?.data_hora || 0;
        return dataA < dataB ? 1 : -1; // Mais recente primeiro
    });

    if (usuariosOrdenados.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-400">Nenhum log encontrado.</p>';
        return;
    }

    usuariosOrdenados.forEach(userKey => {
        criarCardUsuario(userKey, logsPorUsuario[userKey], container);
    });
}

function criarCardUsuario(userKey, logs, containerPai) {
    const nomeExibicao = cacheNomesLogs[userKey] || userKey;
    const totalLogs = logs.length;
    
    // Cria o card do usuário
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px] animate-fade-in-down';
    card.id = `card-user-${userKey.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // Cabeçalho do Card
    card.innerHTML = `
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center shrink-0">
            <div class="flex items-center gap-2 overflow-hidden">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    ${userKey.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                    <h3 class="font-extrabold text-gray-700 text-sm truncate" title="${nomeExibicao}">${nomeExibicao}</h3>
                    <p class="text-[10px] text-gray-400 font-mono truncate">@${userKey}</p>
                </div>
            </div>
            <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-100 shrink-0">
                ${totalLogs}
            </span>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar" id="lista-logs-${userKey.replace(/[^a-zA-Z0-9]/g, '-')}">
            </div>
    `;

    containerPai.appendChild(card);

    // Preenche a lista de logs deste usuário
    const listaContainer = card.querySelector(`#lista-logs-${userKey.replace(/[^a-zA-Z0-9]/g, '-')}`);
    logs.forEach(log => {
        listaContainer.insertAdjacentHTML('beforeend', gerarHtmlLogItem(log));
    });
}

function gerarHtmlLogItem(log, destaque = false) {
    // Tradução e ícones
    const acaoOriginal = log.acao ? log.acao.toUpperCase() : '';
    const acaoLegivel = dicionarioAcoes[acaoOriginal] || acaoOriginal;
    
    let corTexto = 'text-gray-600';
    let icone = 'fa-circle';
    
    if (acaoOriginal.includes('LOGIN')) { corTexto = 'text-green-600'; icone = 'fa-key'; }
    else if (acaoOriginal.includes('CRIAR')) { corTexto = 'text-blue-600'; icone = 'fa-plus'; }
    else if (acaoOriginal.includes('EXCLUIR')) { corTexto = 'text-red-500'; icone = 'fa-trash'; }
    else if (acaoOriginal.includes('EDITAR')) { corTexto = 'text-orange-500'; icone = 'fa-pen'; }

    // --- CORREÇÃO DA DATA (UTC) ---
    // Usamos UTC para garantir que o dia 19 permaneça dia 19, independente do horário
    const dataObj = new Date(log.data_hora);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' });
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });

    const bgClass = destaque ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100';

    return `
        <div class="p-2 rounded-lg border ${bgClass} flex gap-2 items-start transition-colors">
            <div class="mt-1 text-[10px] ${corTexto} w-4 text-center shrink-0"><i class="fas ${icone}"></i></div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                    <p class="text-[10px] font-extrabold uppercase ${corTexto}">${acaoLegivel}</p>
                    <span class="text-[9px] font-mono text-gray-400" title="${dataObj.toISOString()}">${dataFormatada} ${horaFormatada}</span>
                </div>
                <p class="text-[10px] text-gray-500 leading-tight mt-0.5 break-words">${log.detalhe || ''}</p>
            </div>
        </div>
    `;
}

// --- REALTIME ---
function iniciarEscutaRealtime() {
    if (logsSubscription) _supabase.removeChannel(logsSubscription);

    logsSubscription = _supabase
        .channel('logs-realtime-grouped')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'logs' },
            async (payload) => {
                const newLog = payload.new;
                
                // Verifica se usuário existe no cache, senão busca
                if (!cacheNomesLogs[newLog.usuario]) await carregarNomesParaCache();
                
                // Atualiza estrutura de dados
                if (!logsPorUsuario[newLog.usuario]) logsPorUsuario[newLog.usuario] = [];
                logsPorUsuario[newLog.usuario].unshift(newLog); // Adiciona no início
                
                atualizarInterfaceRealtime(newLog);
            }
        )
        .subscribe();
}

function atualizarInterfaceRealtime(log) {
    const userKey = log.usuario;
    const safeId = userKey.replace(/[^a-zA-Z0-9]/g, '-');
    const listaId = `lista-logs-${safeId}`;
    const listaEl = document.getElementById(listaId);

    if (listaEl) {
        // Se o card do usuário já existe, adiciona no topo
        const html = gerarHtmlLogItem(log, true);
        listaEl.insertAdjacentHTML('afterbegin', html);
        
        // Atualiza contador
        const cardHeader = listaEl.parentElement.querySelector('.bg-blue-50');
        if(cardHeader) {
            const count = parseInt(cardHeader.innerText) + 1;
            cardHeader.innerText = count;
        }
    } else {
        // Se o card não existe (primeiro log do usuário), recarrega tudo para criar o card
        // ou cria dinamicamente (para simplificar, recarregamos a view se for usuário novo)
        const container = document.getElementById('container-logs-agrupados');
        if(container) {
             criarCardUsuario(userKey, [log], container);
             // Move o card novo para o começo (opcional)
             const cardNovo = document.getElementById(`card-user-${safeId}`);
             if(cardNovo) container.prepend(cardNovo);
        }
    }
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

// Estilos extras para scrollbar fina nos cards
const style = document.createElement('style');
style.innerHTML = `
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`;
document.head.appendChild(style);
