// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;
    
    container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando atividades...</div>';

    try {
        // 1. Busca Usuários para mapear Nomes
        const { data: usuariosData } = await _supabase.from('usuarios').select('username, nome');
        const mapaNomes = {};
        if (usuariosData) usuariosData.forEach(u => mapaNomes[u.username] = u.nome || u.username);

        // 2. Busca Logs
        const { data: logs, error } = await _supabase
            .from('logs')
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(100);

        if (error) throw error;

        // 3. Renderiza com Nomes Reais
        renderizarLogs(logs, mapaNomes);

        // Realtime
        if (!logsSubscription) {
            logsSubscription = _supabase.channel('logs-realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, payload => {
                    const novoLog = payload.new;
                    adicionarLogRealtime(novoLog, mapaNomes);
                })
                .subscribe();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="col-span-full text-center text-red-400">Erro ao carregar logs.</div>';
    }
}

function renderizarLogs(lista, mapaNomes) {
    const container = document.getElementById('container-logs-agrupados');
    if(!lista.length) {
        container.innerHTML = '<div class="col-span-full text-center text-slate-400">Nenhuma atividade recente.</div>';
        return;
    }
    
    // Agrupa por dia (hoje, ontem, data)
    const grupos = {};
    lista.forEach(log => {
        const dataObj = new Date(log.data_hora);
        const dataStr = dataObj.toLocaleDateString('pt-BR');
        if(!grupos[dataStr]) grupos[dataStr] = [];
        grupos[dataStr].push(log);
    });

    container.innerHTML = Object.keys(grupos).map(data => {
        const itens = grupos[data].map(log => criarCardLog(log, mapaNomes)).join('');
        return `
            <div class="col-span-full mb-2">
                <span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">${formatarDataRelativa(data)}</span>
            </div>
            ${itens}
        `;
    }).join('');
}

function criarCardLog(log, mapaNomes) {
    const hora = new Date(log.data_hora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    // Mapeamento de Cores e Ícones
    const configs = {
        'LOGIN': { cor: 'blue', icon: 'fa-sign-in-alt', texto: 'Acesso ao sistema' },
        'COPIAR': { cor: 'green', icon: 'fa-copy', texto: 'Copiou frase' },
        'COPIAR_RANK': { cor: 'green', icon: 'fa-copy', texto: 'Copiou frase' },
        'CRIAR': { cor: 'purple', icon: 'fa-plus-circle', texto: 'Criou nova frase' },
        'EDITAR': { cor: 'yellow', icon: 'fa-pen', texto: 'Editou frase' },
        'EXCLUIR': { cor: 'red', icon: 'fa-trash', texto: 'Excluiu frase' },
        'LIMPEZA': { cor: 'red', icon: 'fa-broom', texto: 'Limpeza automática' }
    };

    const cfg = configs[log.acao] || { cor: 'gray', icon: 'fa-info-circle', texto: log.acao };
    const nomeReal = mapaNomes[log.usuario] || log.usuario; // AQUI ENTRA O NOME
    const iniciais = nomeReal.substring(0, 2).toUpperCase();

    // Se for ação de frase, tenta mostrar o ID de forma bonita
    let detalheHtml = log.detalhe;
    if (['COPIAR', 'COPIAR_RANK', 'EDITAR', 'EXCLUIR'].includes(log.acao) && !isNaN(log.detalhe)) {
        detalheHtml = `Frase <span class="font-mono bg-slate-100 px-1 rounded text-slate-600">#${log.detalhe}</span>`;
    }

    return `
    <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-${cfg.cor}-500 hover:shadow-md transition animate-fade-in">
        <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center" title="${log.usuario}">
                    ${iniciais}
                </div>
                <span class="font-bold text-xs text-slate-700">${nomeReal}</span>
            </div>
            <span class="text-[10px] font-mono text-slate-400">${hora}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-600">
            <i class="fas ${cfg.icon} text-${cfg.cor}-500"></i>
            <span>${cfg.texto}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-1 pl-5 truncate">${detalheHtml}</p>
    </div>
    `;
}

function formatarDataRelativa(dataStr) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const ontem = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');
    if(dataStr === hoje) return 'Hoje';
    if(dataStr === ontem) return 'Ontem';
    return dataStr;
}

// Pequeno helper para quando entra um log novo via Realtime
function adicionarLogRealtime(log, mapaNomes) {
    const container = document.getElementById('container-logs-agrupados');
    if(container) {
        // Recarrega tudo para manter a ordem e agrupamento corretos sem complicar o DOM
        // Como o realtime é raro, não tem problema de performance
        carregarLogs(); 
    }
}

function filtrarLogs(termo) {
    const cards = document.querySelectorAll('#container-logs-agrupados > div.bg-white');
    cards.forEach(card => {
        const texto = card.innerText.toLowerCase();
        if(texto.includes(termo)) card.classList.remove('hidden');
        else card.classList.add('hidden');
    });
}
