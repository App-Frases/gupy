// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;
    
    if(container.innerHTML === '') {
        container.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 animate-pulse flex flex-col items-center gap-2"><i class="fas fa-satellite-dish fa-2x"></i><span class="text-xs font-bold uppercase tracking-widest">Sincronizando timeline...</span></div>';
    }

    try {
        const { data: logs, error } = await _supabase
            .from('view_logs_detalhados') 
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(100);

        if (error) {
            if(error.code === '42P01') throw new Error("VIEW_MISSING");
            throw error;
        }

        renderizarLogs(logs);

        if (!logsSubscription) {
            logsSubscription = _supabase.channel('logs-realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
                    carregarLogs(); // Recarrega ao vivo
                })
                .subscribe();
        }

    } catch (e) {
        console.error("Erro Logs:", e);
        if(e.message === "VIEW_MISSING") {
            container.innerHTML = '<div class="col-span-full text-center text-orange-500 bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm"><b>Atualização Necessária:</b><br>Execute o novo script SQL no Supabase para corrigir as datas.</div>';
        } else {
            container.innerHTML = '<div class="col-span-full text-center text-red-400 text-sm">Falha na conexão com histórico.</div>';
        }
    }
}

function renderizarLogs(lista) {
    const container = document.getElementById('container-logs-agrupados');
    
    if(!lista || !lista.length) { 
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center"><i class="far fa-clock text-4xl mb-3 text-slate-200"></i><p class="text-sm">Sem registros recentes.</p></div>'; 
        return; 
    }
    
    // Agrupa por data (Considerando o Fuso Horário Local do Usuário)
    const grupos = {};
    
    lista.forEach(log => {
        // O segredo está aqui: o construtor Date() lê o UTC do banco e converte para local automaticamente
        const dataObj = new Date(log.data_hora);
        
        // Formata para "Sexta-feira, 19 de Dezembro" usando o local do navegador
        const dataExtensa = dataObj.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        });
        
        if(!grupos[dataExtensa]) grupos[dataExtensa] = [];
        grupos[dataExtensa].push(log);
    });

    container.innerHTML = Object.keys(grupos).map(dataKey => {
        // Capitaliza (ex: "sexta" -> "Sexta")
        const tituloData = dataKey.charAt(0).toUpperCase() + dataKey.slice(1);
        const itensHtml = grupos[dataKey].map(log => criarLinhaLog(log)).join('');
        
        return `
            <div class="col-span-full mb-8 animate-fade-in">
                <div class="flex items-center gap-3 mb-4 pl-1">
                    <div class="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                        <i class="far fa-calendar-alt text-xs"></i>
                    </div>
                    <span class="text-sm font-black text-slate-700 uppercase tracking-wide">
                        ${tituloData}
                    </span>
                    <div class="h-px bg-slate-100 flex-1 ml-2"></div>
                </div>
                
                <div class="grid grid-cols-1 gap-3 relative">
                    <div class="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100 -z-10"></div>
                    ${itensHtml}
                </div>
            </div>
        `;
    }).join('');
}

function criarLinhaLog(log) {
    // Pega a hora local para mostrar no card (opcional, mas bom para precisão)
    const dataObj = new Date(log.data_hora);
    const horaLocal = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const configs = {
        'LOGIN':       { cor: 'blue',   bg: 'bg-blue-50',     icon: 'fa-sign-in-alt', texto: 'Acesso realizado' },
        'COPIAR':      { cor: 'emerald',bg: 'bg-emerald-50',  icon: 'fa-copy',        texto: 'Copiou frase' },
        'COPIAR_RANK': { cor: 'emerald',bg: 'bg-emerald-50',  icon: 'fa-copy',        texto: 'Copiou frase' },
        'CRIAR':       { cor: 'purple', bg: 'bg-purple-50',   icon: 'fa-plus',        texto: 'Criou nova frase' },
        'EDITAR':      { cor: 'amber',  bg: 'bg-amber-50',    icon: 'fa-pen',         texto: 'Editou frase' },
        'EXCLUIR':     { cor: 'red',    bg: 'bg-red-50',      icon: 'fa-trash-alt',   texto: 'Excluiu frase' },
        'LIMPEZA':     { cor: 'gray',   bg: 'bg-slate-100',   icon: 'fa-broom',       texto: 'Limpeza automática' }
    };

    const cfg = configs[log.acao] || { cor: 'slate', bg: 'bg-slate-50', icon: 'fa-info', texto: log.acao };
    
    // Identificação
    const nome = log.nome_real || log.username || 'Sistema';
    const isAdm = log.perfil_usuario === 'admin';

    // BADGES - Distinção Visual Clara
    const badgePerfil = isAdm 
        ? `<span class="bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 border border-slate-600 shadow-sm" title="Administrador">ADMIN</span>`
        : `<span class="bg-white text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 border border-slate-200" title="Colaborador">COLAB</span>`;

    // Detalhe Inteligente
    let detalheVisual = '';
    if (log.detalhe && !isNaN(log.detalhe)) {
        // ID da frase
        detalheVisual = `<div class="ml-auto bg-white px-2 py-1 rounded border border-slate-100 text-[10px] font-mono font-bold text-slate-500 shadow-sm">ID:${log.detalhe}</div>`;
    } else if (log.detalhe) {
        detalheVisual = `<span class="ml-auto text-[10px] text-slate-400 italic truncate max-w-[120px]">${log.detalhe}</span>`;
    }

    // Classes Tailwind montadas
    const iconClass = `text-${cfg.cor}-500`;
    const borderHover = `hover:border-${cfg.cor}-300`;

    return `
    <div class="group bg-white p-3 rounded-xl border border-slate-100 shadow-sm ${borderHover} transition-all duration-200 flex items-center gap-3 z-10 relative">
        
        <div class="w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 border border-white shadow-sm">
            <i class="fas ${cfg.icon} ${iconClass} text-xs"></i>
        </div>

        <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center">
                <span class="text-xs font-extrabold text-slate-700 truncate">${nome}</span>
                ${badgePerfil}
                <span class="text-[10px] text-slate-300 font-mono ml-auto mr-2 md:mr-0 md:ml-2">${horaLocal}</span>
            </div>
            <p class="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                ${cfg.texto}
            </p>
        </div>

        <div class="hidden sm:block">
            ${detalheVisual}
        </div>
    </div>
    `;
}

function filtrarLogs(termo) {
    const cards = document.querySelectorAll('#container-logs-agrupados .group');
    cards.forEach(card => {
        if(card.innerText.toLowerCase().includes(termo)) card.classList.remove('hidden');
        else card.classList.add('hidden');
    });
}
