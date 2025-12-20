// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;
    
    // Loading Limpo
    if(container.innerHTML === '') {
        container.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400 animate-pulse flex flex-col items-center gap-2"><i class="fas fa-satellite-dish fa-2x"></i><span class="text-xs font-bold uppercase tracking-widest">Sincronizando...</span></div>';
    }

    try {
        // --- BUSCA INTELIGENTE ---
        // Buscamos direto da VIEW que criamos. Ela já traz se é Admin ou Colab.
        const { data: logs, error } = await _supabase
            .from('view_logs_detalhados') 
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(100);

        if (error) {
            // Se der erro 42P01, significa que a View não foi criada no banco
            if(error.code === '42P01') throw new Error("VIEW_MISSING");
            throw error;
        }

        renderizarLogs(logs);

        // --- REALTIME PRECISO ---
        // Monitoramos a tabela original. Quando algo muda, recarregamos a lista suavemente.
        if (!logsSubscription) {
            logsSubscription = _supabase.channel('logs-realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
                    carregarLogs(); 
                })
                .subscribe();
        }

    } catch (e) {
        console.error("Erro Logs:", e);
        if(e.message === "VIEW_MISSING") {
            container.innerHTML = '<div class="col-span-full text-center text-orange-500 bg-orange-50 p-6 rounded-xl border border-orange-100 text-sm"><b>⚠ Ação Necessária no Banco:</b><br>Por favor, execute o script SQL "view_logs_detalhados" no Supabase para ativar o novo log inteligente.</div>';
        } else {
            container.innerHTML = '<div class="col-span-full text-center text-red-400 text-sm">Falha na conexão.</div>';
        }
    }
}

function renderizarLogs(lista) {
    const container = document.getElementById('container-logs-agrupados');
    
    if(!lista || !lista.length) { 
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-12 flex flex-col items-center"><i class="far fa-folder-open text-4xl mb-3 text-slate-200"></i><p class="text-xs uppercase font-bold tracking-wide">Sem atividades recentes</p></div>'; 
        return; 
    }
    
    // 1. Agrupar por Data (Removemos as horas da visualização macro)
    const grupos = {};
    lista.forEach(log => {
        const dataObj = new Date(log.data_hora);
        // Formato: "Sexta-feira, 20 de Dezembro"
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
        
        if(!grupos[dataFormatada]) grupos[dataFormatada] = [];
        grupos[dataFormatada].push(log);
    });

    // 2. Gerar HTML da Timeline
    container.innerHTML = Object.keys(grupos).map(dataExtensa => {
        // Capitaliza a primeira letra (ex: "sexta" -> "Sexta")
        const dataTitulo = dataExtensa.charAt(0).toUpperCase() + dataExtensa.slice(1);
        
        const itensHtml = grupos[dataExtensa].map(log => criarLinhaLog(log)).join('');
        
        return `
            <div class="col-span-full mb-8">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span class="text-xs font-black text-slate-400 uppercase tracking-widest">
                        ${dataTitulo}
                    </span>
                    <div class="h-px bg-slate-100 flex-1"></div>
                </div>
                
                <div class="grid grid-cols-1 gap-3 pl-3 border-l-2 border-slate-50">
                    ${itensHtml}
                </div>
            </div>
        `;
    }).join('');
}

function criarLinhaLog(log) {
    // Configurações Visuais
    const configs = {
        'LOGIN':       { cor: 'blue',   icon: 'fa-door-open',    texto: 'Acessou o sistema' },
        'COPIAR':      { cor: 'green',  icon: 'fa-copy',         texto: 'Copiou frase' },
        'COPIAR_RANK': { cor: 'green',  icon: 'fa-copy',         texto: 'Copiou frase' },
        'CRIAR':       { cor: 'purple', icon: 'fa-plus',         texto: 'Criou nova frase' },
        'EDITAR':      { cor: 'yellow', icon: 'fa-pen',          texto: 'Editou frase' },
        'EXCLUIR':     { cor: 'red',    icon: 'fa-trash-alt',    texto: 'Excluiu frase' },
        'LIMPEZA':     { cor: 'gray',   icon: 'fa-broom',        texto: 'Limpeza automática' }
    };

    const cfg = configs[log.acao] || { cor: 'gray', icon: 'fa-info', texto: log.acao };
    
    // Identificação do Usuário
    const nome = log.nome_real || log.username || 'Desconhecido';
    const perfil = log.perfil_usuario || 'user'; 
    const isAdm = perfil === 'admin';

    // BADGES (O Visual que pediu: Admin vs Colaborador)
    const badgePerfil = isAdm 
        ? `<span class="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ml-2 shadow-sm shadow-indigo-200">Admin</span>`
        : `<span class="bg-slate-200 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ml-2">Colaborador</span>`;

    // Detalhe (ID da Frase)
    let detalheVisual = '';
    if (log.detalhe && !isNaN(log.detalhe)) {
        detalheVisual = `<div class="ml-auto flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span class="text-[9px] font-bold text-slate-400 uppercase">ID</span>
                            <span class="text-xs font-mono font-bold text-slate-600">#${log.detalhe}</span>
                         </div>`;
    } else if (log.detalhe) {
        detalheVisual = `<span class="ml-auto text-[10px] text-slate-400 italic truncate max-w-[150px] bg-slate-50 px-2 py-1 rounded">${log.detalhe}</span>`;
    }

    // Cores dinâmicas para o ícone
    const corIcone = `text-${cfg.cor}-500`;
    const bgIcone = `bg-${cfg.cor}-50`;

    return `
    <div class="group bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition flex items-center gap-4 animate-fade-in relative overflow-hidden">
        
        <div class="w-10 h-10 rounded-full ${bgIcone} flex items-center justify-center shrink-0">
            <i class="fas ${cfg.icon} ${corIcone} text-sm"></i>
        </div>

        <div class="flex flex-col min-w-0">
            <div class="flex items-center">
                <span class="text-sm font-bold text-slate-700 truncate">${nome}</span>
                ${badgePerfil}
            </div>
            <p class="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                ${cfg.texto}
            </p>
        </div>

        ${detalheVisual}
    </div>
    `;
}

// Filtro simples
function filtrarLogs(termo) {
    const cards = document.querySelectorAll('#container-logs-agrupados .group');
    cards.forEach(card => {
        if(card.innerText.toLowerCase().includes(termo)) card.classList.remove('hidden');
        else card.classList.add('hidden');
    });
}
