// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;
    
    // Mostra loading apenas na primeira carga, não no realtime
    if(container.innerHTML === '') {
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando atividades...</div>';
    }

    try {
        // --- MELHORIA: Busca direta na VIEW otimizada ---
        // Agora o banco já nos entrega o 'nome_real', não precisamos buscar usuários separadamente.
        const { data: logs, error } = await _supabase
            .from('view_logs_detalhados') // Usamos a View criada no SQL
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(100);

        if (error) throw error;

        renderizarLogs(logs);

        // Realtime: Monitora a tabela original 'logs' (views não suportam realtime direto facilmente)
        if (!logsSubscription) {
            logsSubscription = _supabase.channel('logs-realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
                    // Quando entra um log novo, recarregamos a lista suavemente
                    carregarLogs(); 
                })
                .subscribe();
        }

    } catch (e) {
        console.error("Erro Logs:", e);
        // Se a View não existir (caso não tenha rodado o SQL), tenta fallback ou mostra erro
        if(e.code === '42P01') { // Erro: relation does not exist
             container.innerHTML = '<div class="col-span-full text-center text-red-400 p-4 border border-red-200 rounded-lg bg-red-50"><b>Atenção:</b> Execute o script SQL de melhoria no Supabase para criar a "view_logs_detalhados".</div>';
        } else {
             container.innerHTML = '<div class="col-span-full text-center text-red-400">Erro ao carregar histórico. Verifique sua conexão.</div>';
        }
    }
}

function renderizarLogs(lista) {
    const container = document.getElementById('container-logs-agrupados');
    if(!lista || !lista.length) { 
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10">Nenhuma atividade recente.</div>'; 
        return; 
    }
    
    // Agrupa logs por Data
    const grupos = {};
    lista.forEach(log => {
        const dataObj = new Date(log.data_hora);
        const dataStr = dataObj.toLocaleDateString('pt-BR'); // Ex: 20/12/2025
        if(!grupos[dataStr]) grupos[dataStr] = [];
        grupos[dataStr].push(log);
    });

    // Gera o HTML
    container.innerHTML = Object.keys(grupos).map(data => {
        const itens = grupos[data].map(log => criarCardLog(log)).join('');
        return `
            <div class="col-span-full mb-2 mt-2">
                <span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-slate-300">
                    <i class="far fa-calendar-alt mr-1"></i> ${formatarDataRelativa(data)}
                </span>
            </div>
            ${itens}
        `;
    }).join('');
}

function criarCardLog(log) {
    const hora = new Date(log.data_hora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    // Configurações Visuais
    const configs = {
        'LOGIN': { cor: 'blue', icon: 'fa-sign-in-alt', texto: 'Acesso ao sistema' },
        'COPIAR': { cor: 'emerald', icon: 'fa-copy', texto: 'Copiou frase' },
        'COPIAR_RANK': { cor: 'emerald', icon: 'fa-copy', texto: 'Copiou frase' }, // Compatibilidade
        'CRIAR': { cor: 'purple', icon: 'fa-plus-circle', texto: 'Criou nova frase' },
        'EDITAR': { cor: 'amber', icon: 'fa-pen', texto: 'Editou frase' },
        'EXCLUIR': { cor: 'red', icon: 'fa-trash', texto: 'Excluiu frase' },
        'LIMPEZA': { cor: 'gray', icon: 'fa-broom', texto: 'Limpeza automática' }
    };

    const cfg = configs[log.acao] || { cor: 'gray', icon: 'fa-info-circle', texto: log.acao };
    
    // Usa o nome real vindo da View, ou o username se não tiver nome
    const nomeExibicao = log.nome_real || log.username || 'Desconhecido';
    const iniciais = nomeExibicao.substring(0, 2).toUpperCase();

    // Formata o detalhe (ID da frase ou texto extra)
    let detalheHtml = log.detalhe || '';
    // Se for um ID numérico de frase, deixa bonito
    if (['COPIAR', 'COPIAR_RANK', 'EDITAR', 'EXCLUIR'].includes(log.acao) && !isNaN(log.detalhe)) {
        detalheHtml = `Frase <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">#${log.detalhe}</span>`;
    }

    // Cores Tailwind dinâmicas (para garantir que funcionam, usamos classes completas ou style inline se necessário, mas classes padrão funcionam bem)
    const corBorder = `border-${cfg.cor}-500`;
    const corIcon = `text-${cfg.cor}-500`;

    return `
    <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 ${corBorder} hover:shadow-md transition animate-fade-in flex flex-col gap-2 relative overflow-hidden">
        <div class="flex justify-between items-start">
            <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center border border-slate-200" title="${log.username}">
                    ${iniciais}
                </div>
                <div>
                    <p class="font-bold text-xs text-slate-700 leading-tight">${nomeExibicao}</p>
                    <p class="text-[9px] text-slate-400">@${log.username}</p>
                </div>
            </div>
            <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">${hora}</span>
        </div>
        
        <div class="flex items-center gap-2 text-xs text-slate-600 mt-1 pl-1">
            <i class="fas ${cfg.icon} ${corIcon}"></i>
            <span class="font-medium">${cfg.texto}</span>
        </div>
        
        ${detalheHtml ? `<p class="text-[11px] text-slate-500 mt-0.5 pl-7 border-l-2 border-slate-100 ml-1 py-0.5 truncate">${detalheHtml}</p>` : ''}
    </div>
    `;
}

function formatarDataRelativa(dataStr) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    // Truque para pegar "ontem" corretamente independente do fuso
    const dHoje = new Date();
    const dOntem = new Date(dHoje);
    dOntem.setDate(dHoje.getDate() - 1);
    const ontem = dOntem.toLocaleDateString('pt-BR');

    if(dataStr === hoje) return 'Hoje';
    if(dataStr === ontem) return 'Ontem';
    return dataStr;
}

function filtrarLogs(termo) {
    const cards = document.querySelectorAll('#container-logs-agrupados > div.bg-white'); // Seleciona apenas os cards, não os cabeçalhos de data
    cards.forEach(card => {
        if(card.innerText.toLowerCase().includes(termo)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}
