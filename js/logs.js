// Local: js/logs.js

let logsSubscription = null;
let filtroCategoriaAtual = 'TODOS';
let termoBuscaAtual = '';

// Inicia o carregamento (reseta filtros para o padrão)
async function carregarLogs() {
    filtroCategoriaAtual = 'TODOS';
    termoBuscaAtual = '';
    
    // Reseta visual dos botões
    document.querySelectorAll('.btn-filtro-log').forEach(btn => {
        if(btn.dataset.cat === 'TODOS') {
            btn.classList.remove('bg-slate-100', 'text-slate-600');
            btn.classList.add('bg-slate-800', 'text-white');
        } else {
            btn.classList.add('bg-slate-100', 'text-slate-600');
            btn.classList.remove('bg-slate-800', 'text-white');
        }
    });

    executarConsultaLogs();

    if (!logsSubscription) {
        logsSubscription = _supabase.channel('logs-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
                // Só atualiza em tempo real se não houver busca ativa para não atrapalhar
                if(filtroCategoriaAtual === 'TODOS' && termoBuscaAtual === '') {
                    executarConsultaLogs();
                }
            })
            .subscribe();
    }
}

// Chamado pelos botões de categoria
function filtrarPorCategoriaLog(cat) {
    filtroCategoriaAtual = cat;

    // Atualiza classes visuais
    document.querySelectorAll('.btn-filtro-log').forEach(btn => {
        if(btn.dataset.cat === cat) {
            btn.classList.remove('bg-slate-100', 'text-slate-600');
            btn.classList.add('bg-slate-800', 'text-white');
        } else {
            btn.classList.add('bg-slate-100', 'text-slate-600');
            btn.classList.remove('bg-slate-800', 'text-white');
        }
    });

    executarConsultaLogs();
}

// Chamado pela barra de busca global (via app.js)
function filtrarLogs(termo) {
    termoBuscaAtual = termo;
    executarConsultaLogs();
}

// Função central que busca no banco considerando TODOS os filtros
async function executarConsultaLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;

    container.innerHTML = '<div class="col-span-full py-10 text-center text-blue-500 flex flex-col items-center gap-2 animate-pulse"><i class="fas fa-circle-notch fa-spin text-2xl"></i><span class="text-xs font-bold uppercase">Carregando histórico...</span></div>';

    try {
        let query = _supabase
            .from('view_logs_detalhados') 
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(500);

        // 1. Aplica filtro de Categoria (se não for TODOS)
        if (filtroCategoriaAtual !== 'TODOS') {
            // Tratamento especial para "COPIAR" que inclui ranking
            if (filtroCategoriaAtual === 'COPIAR') {
                query = query.in('acao', ['COPIAR', 'COPIAR_RANK']);
            } else {
                query = query.eq('acao', filtroCategoriaAtual);
            }
        }

        // 2. Aplica busca por Texto (se houver)
        if (termoBuscaAtual && termoBuscaAtual.trim() !== '') {
            const t = termoBuscaAtual.trim();
            // Busca no nome, usuario ou detalhe
            query = query.or(`nome_real.ilike.%${t}%,username.ilike.%${t}%,detalhe.ilike.%${t}%`);
        }

        const { data, error } = await query;

        if (error) {
            if(error.code === '42P01') throw new Error("VIEW_MISSING");
            throw error;
        }

        renderizarLogs(data);

    } catch (e) {
        console.error("Erro Logs:", e);
        if(e.message === "VIEW_MISSING") {
            container.innerHTML = '<div class="col-span-full text-center text-orange-500 bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm"><b>Atualização Necessária:</b><br>Execute o script SQL no Supabase.</div>';
        } else {
            container.innerHTML = '<div class="col-span-full text-center text-red-400 text-sm">Falha na conexão com histórico.</div>';
        }
    }
}

function renderizarLogs(lista) {
    const container = document.getElementById('container-logs-agrupados');
    
    if(!lista || !lista.length) { 
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center"><i class="far fa-clock text-4xl mb-3 text-slate-200"></i><p class="text-sm">Nenhum registro encontrado para este filtro.</p></div>'; 
        return; 
    }
    
    const grupos = {};
    
    lista.forEach(log => {
        const dataObj = new Date(log.data_hora);
        const dataExtensa = dataObj.toLocaleDateString('pt-BR', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        if(!grupos[dataExtensa]) grupos[dataExtensa] = [];
        grupos[dataExtensa].push(log);
    });

    container.innerHTML = Object.keys(grupos).map(dataKey => {
        const tituloData = dataKey.charAt(0).toUpperCase() + dataKey.slice(1);
        const itensHtml = grupos[dataKey].map(log => criarCardLog(log)).join('');
        
        return `
            <div class="col-span-full mb-8 animate-fade-in">
                <div class="flex items-center gap-3 mb-4 pl-1">
                    <div class="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><i class="far fa-calendar-alt text-xs"></i></div>
                    <span class="text-sm font-black text-slate-700 uppercase tracking-wide">${tituloData}</span>
                    <div class="h-px bg-slate-100 flex-1 ml-2"></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${itensHtml}
                </div>
            </div>
        `;
    }).join('');
}

function criarCardLog(log) {
    const dataObj = new Date(log.data_hora);
    const horaLocal = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const configs = {
        'LOGIN':       { cor: 'blue',   bg: 'bg-blue-50',     icon: 'fa-sign-in-alt', texto: 'Acesso' },
        'COPIAR':      { cor: 'emerald',bg: 'bg-emerald-50',  icon: 'fa-copy',        texto: 'Cópia' },
        'COPIAR_RANK': { cor: 'emerald',bg: 'bg-emerald-50',  icon: 'fa-copy',        texto: 'Cópia' },
        'CRIAR':       { cor: 'purple', bg: 'bg-purple-50',   icon: 'fa-plus',        texto: 'Criação' },
        'EDITAR':      { cor: 'amber',  bg: 'bg-amber-50',    icon: 'fa-pen',         texto: 'Edição' },
        'EXCLUIR':     { cor: 'red',    bg: 'bg-red-50',      icon: 'fa-trash-alt',   texto: 'Exclusão' },
        'LIMPEZA':     { cor: 'gray',   bg: 'bg-slate-100',   icon: 'fa-broom',       texto: 'Limpeza' }
    };

    const cfg = configs[log.acao] || { cor: 'slate', bg: 'bg-slate-50', icon: 'fa-info', texto: log.acao };
    
    const nome = log.nome_real || log.username || 'Sistema';
    
    let resumoDetalhe = 'Clique para ver detalhes';
    if(log.detalhe) {
        if(!isNaN(log.detalhe)) resumoDetalhe = `Frase ID #${log.detalhe}`;
        else resumoDetalhe = log.detalhe.length > 25 ? log.detalhe.substring(0, 25) + '...' : log.detalhe;
    }

    const logSafe = JSON.stringify(log).replace(/"/g, '&quot;');

    return `
    <div onclick='abrirModalLogDireto(${logSafe})' 
         class="group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-${cfg.cor}-200 transition-all duration-300 cursor-pointer relative overflow-hidden">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-${cfg.cor}-500"></div>
        <div class="flex justify-between items-start mb-3 pl-3">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full ${cfg.bg} text-${cfg.cor}-600 flex items-center justify-center border border-${cfg.cor}-100">
                    <i class="fas ${cfg.icon} text-xs"></i>
                </div>
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${cfg.texto}</p>
                    <p class="text-xs font-black text-slate-700">${nome}</p>
                </div>
            </div>
            <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">${horaLocal}</span>
        </div>
        <div class="pl-3">
            <p class="text-xs text-slate-500 font-medium truncate bg-slate-50 p-2 rounded-lg border border-slate-50 group-hover:bg-white group-hover:border-${cfg.cor}-100 transition-colors">
                ${resumoDetalhe}
            </p>
        </div>
    </div>
    `;
}

function abrirModalLogDireto(log) {
    if(!log) return;

    const dataObj = new Date(log.data_hora);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR');

    const configs = {
        'LOGIN': { cor: 'blue', titulo: 'Acesso ao Sistema', icon: 'fa-sign-in-alt' },
        'COPIAR': { cor: 'emerald', titulo: 'Cópia de Frase', icon: 'fa-copy' },
        'COPIAR_RANK': { cor: 'emerald', titulo: 'Cópia de Frase', icon: 'fa-copy' },
        'CRIAR': { cor: 'purple', titulo: 'Nova Frase Criada', icon: 'fa-plus-circle' },
        'EDITAR': { cor: 'amber', titulo: 'Edição de Frase', icon: 'fa-pen' },
        'EXCLUIR': { cor: 'red', titulo: 'Exclusão de Frase', icon: 'fa-trash' },
        'LIMPEZA': { cor: 'gray', titulo: 'Limpeza Automática', icon: 'fa-broom' }
    };
    const cfg = configs[log.acao] || { cor: 'slate', titulo: log.acao, icon: 'fa-info' };

    const header = document.getElementById('header-modal-log');
    header.className = `p-6 text-white flex justify-between items-center shadow-lg bg-${cfg.cor}-600`;
    
    document.getElementById('modal-log-titulo').innerText = cfg.titulo;
    document.getElementById('modal-log-icon').innerHTML = `<i class="fas ${cfg.icon}"></i>`;
    document.getElementById('modal-log-data').innerText = dataFormatada;
    
    const nome = log.nome_real || log.username;
    document.getElementById('modal-log-user').innerText = nome;
    document.getElementById('modal-log-avatar').innerText = nome.charAt(0).toUpperCase();
    
    const isAdm = log.perfil_usuario === 'admin';
    document.getElementById('modal-log-badge').innerHTML = isAdm 
        ? `<span class="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded shadow-sm">ADMIN</span>`
        : `<span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">COLAB</span>`;

    let textoDetalhe = log.detalhe;
    if(!isNaN(log.detalhe)) textoDetalhe = `Interação com a frase de ID: #${log.detalhe}`;
    
    document.getElementById('modal-log-desc').innerText = textoDetalhe || 'Sem detalhes adicionais.';
    document.getElementById('modal-log-detalhe').classList.remove('hidden');
}
