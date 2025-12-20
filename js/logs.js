// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const container = document.getElementById('container-logs-agrupados');
    if(!container) return;
    
    // Loading discreto
    if(container.innerHTML === '') {
        container.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 animate-pulse flex flex-col items-center gap-2"><i class="fas fa-satellite-dish fa-2x"></i><span class="text-xs font-bold uppercase tracking-widest">Sincronizando atividades...</span></div>';
    }

    try {
        // Busca na View Otimizada (que já traz nomes e perfis)
        const { data: logs, error } = await _supabase
            .from('view_logs_detalhados') 
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(100);

        if (error) {
            // Fallback caso a view ainda não exista
            if(error.code === '42P01') throw new Error("VIEW_MISSING");
            throw error;
        }

        renderizarLogs(logs);

        // Monitoramento em Tempo Real (Realtime)
        if (!logsSubscription) {
            logsSubscription = _supabase.channel('logs-realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
                    // Atualiza silenciosamente quando entra novo registro
                    carregarLogs(); 
                })
                .subscribe();
        }

    } catch (e) {
        console.error("Erro Logs:", e);
        if(e.message === "VIEW_MISSING") {
            container.innerHTML = '<div class="col-span-full text-center text-orange-500 bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm"><b>Configuração Necessária:</b><br>Execute o script SQL "view_logs_detalhados" no Supabase.</div>';
        } else {
            container.innerHTML = '<div class="col-span-full text-center text-red-400 text-sm">Falha na conexão com histórico.</div>';
        }
    }
}

function renderizarLogs(lista) {
    const container = document.getElementById('container-logs-agrupados');
    
    if(!lista || !lista.length) { 
        container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 flex flex-col items-center"><i class="far fa-folder-open text-4xl mb-3 text-slate-200"></i><p class="text-sm">Nenhum registro encontrado.</p></div>'; 
        return; 
    }
    
    // 1. Agrupar por Data
    const grupos = {};
    lista.forEach(log => {
        // Converte para data local segura (YYYY-MM-DD para ordenação correta, ou String direta)
        const dataObj = new Date(log.data_hora);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long' 
        }); // Ex: "sexta-feira, 20 de dezembro"
        
        if(!grupos[dataFormatada]) grupos[dataFormatada] = [];
        grupos[dataFormatada].push(log);
    });

    // 2. Gerar HTML Limpo
    container.innerHTML = Object.keys(grupos).map(dataExtensa => {
        // Capitaliza a primeira letra da data
        const dataTitulo = dataExtensa.charAt(0).toUpperCase() + dataExtensa.slice(1);
        
        const itensHtml = grupos[dataExtensa].map(log => criarLinhaLog(log)).join('');
        
        return `
            <div class="col-span-full mb-6">
                <div class="flex items-center gap-4 mb-4">
                    <div class="h-px bg-slate-200 flex-1"></div>
                    <span class="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        ${dataTitulo}
                    </span>
                    <div class="h-px bg-slate-200 flex-1"></div>
                </div>
                
                <div class="grid grid-cols-1 gap-3">
                    ${itensHtml}
                </div>
            </div>
        `;
    }).join('');
}

function criarLinhaLog(log) {
    // Configurações Visuais por Ação
    const configs = {
        'LOGIN':       { cor: 'blue',   icon: 'fa-door-open',    texto: 'Entrou no Sistema' },
        'COPIAR':      { cor: 'green',  icon: 'fa-copy',         texto: 'Copiou Frase' },
        'COPIAR_RANK': { cor: 'green',  icon: 'fa-copy',         texto: 'Copiou Frase' },
        'CRIAR':       { cor: 'purple', icon: 'fa-plus',         texto: 'Adicionou Frase' },
        'EDITAR':      { cor: 'yellow', icon: 'fa-pen',          texto: 'Editou Frase' },
        'EXCLUIR':     { cor: 'red',    icon: 'fa-trash-alt',    texto: 'Removeu Frase' },
        'LIMPEZA':     { cor: 'gray',   icon: 'fa-broom',        texto: 'Limpeza Automática' }
    };

    const cfg = configs[log.acao] || { cor: 'gray', icon: 'fa-info', texto: log.acao };
    
    // Dados do Usuário
    const nome = log.nome_real || log.username || 'Desconhecido';
    const perfil = log.perfil_usuario || 'user'; // 'admin' ou 'user'
    
    // Badge de Perfil
    const isAdm = perfil === 'admin';
    const badgePerfil = isAdm 
        ? `<span class="bg-yellow-100 text-yellow-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-200 uppercase ml-2">Admin</span>`
        : `<span class="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 uppercase ml-2">Colab</span>`;

    // Detalhe (ID da Frase ou Info)
    let detalheVisual = '';
    if (log.detalhe && !isNaN(log.detalhe)) {
        // Se for número, assume que é ID de frase
        detalheVisual = `<div class="ml-auto flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <span class="text-[9px] font-bold text-slate-400 uppercase">Frase</span>
                            <span class="text-xs font-mono font-bold text-slate-600">#${log.detalhe}</span>
                         </div>`;
    } else if (log.detalhe) {
        // Texto genérico
        detalheVisual = `<span class="ml-auto text-[10px] text-slate-400 italic truncate max-w-[150px]">${log.detalhe}</span>`;
    }

    // Cores (Tailwind classes)
    // Usamos classes explícitas para garantir que o Tailwind compile
    const corIcone = `text-${cfg.cor}-500`;
    const corBgIcone = `bg-${cfg.cor}-50`;
    const corBorda = `border-${cfg.cor}-100`;

    return `
    <div class="group bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition flex items-center gap-4 animate-fade-in">
        
        <div class="w-10 h-10 rounded-full ${corBgIcone} flex items-center justify-center shrink-0 border ${corBorda}">
            <i class="fas ${cfg.icon} ${corIcone} text-sm"></i>
        </div>

        <div class="flex flex-col min-w-0">
            <div class="flex items-center">
                <span class="text-sm font-bold text-slate-700 truncate">${nome}</span>
                ${badgePerfil}
            </div>
            <p class="text-xs text-slate-500 font-medium">${cfg.texto}</p>
        </div>

        ${detalheVisual}
    </div>
    `;
}

// Filtro de busca na barra superior
function filtrarLogs(termo) {
    // Seleciona todos os cards de log
    const cards = document.querySelectorAll('#container-logs-agrupados .group');
    let encontrou = false;

    cards.forEach(card => {
        if(card.innerText.toLowerCase().includes(termo)) {
            card.classList.remove('hidden');
            encontrou = true;
        } else {
            card.classList.add('hidden');
        }
    });
    
    // Opcional: Esconder títulos de datas que ficaram vazios
    // (Lógica simplificada: se filtrou, mantém a estrutura, apenas oculta cards)
}
