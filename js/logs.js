let cacheLogsCompleto = [];
let mapaUsuarios = {}; // Mapa para guardar "username" -> "nome"

// --- BUSCA ESPECÍFICA ---
function filtrarLogs(termo) {
    if (!termo) {
        separarCategorias(cacheLogsCompleto);
        return;
    }

    const t = termo.toLowerCase();
    const filtrados = cacheLogsCompleto.filter(l => {
        // Busca pelo ID, Ação, Detalhe OU pelo Nome Traduzido
        const nomeUsuario = mapaUsuarios[l.usuario] || '';
        return l.usuario.toLowerCase().includes(t) ||
               nomeUsuario.toLowerCase().includes(t) ||
               l.acao.toLowerCase().includes(t) ||
               (l.detalhe && l.detalhe.toLowerCase().includes(t));
    });

    separarCategorias(filtrados);
}

// --- CARREGAR LOGS ---
async function carregarLogs() {
    // 1. Busca usuários para criar o mapa de nomes
    const { data: users } = await _supabase.from('usuarios').select('username, nome');
    if(users) {
        mapaUsuarios = {};
        users.forEach(u => mapaUsuarios[u.username] = u.nome || u.username);
    }

    // 2. Busca os logs
    const { data, error } = await _supabase
        .from('logs')
        .select('*')
        .order('data_hora', { ascending: false })
        .limit(200);

    if (error) { console.error("Erro logs:", error); return; }

    cacheLogsCompleto = data; 
    separarCategorias(data);
}

function separarCategorias(todosLogs) {
    const logsAcesso = todosLogs.filter(l => l.acao.includes('LOGIN'));
    const logsUso = todosLogs.filter(l => l.acao === 'COPIAR_RANK');
    const logsAuditoria = todosLogs.filter(l => ['CRIAR', 'EDITAR', 'EXCLUIR', 'LIMPEZA', 'EDITAR_USER', 'CRIAR_USER', 'EXCLUIR_USER'].includes(l.acao));

    renderizarColuna('col-acessos', logsAcesso.slice(0, 10), 'acesso');
    renderizarColuna('col-uso', logsUso.slice(0, 10), 'uso');
    renderizarColuna('col-auditoria', logsAuditoria.slice(0, 10), 'audit');
}

function renderizarColuna(elementId, lista, tipo) {
    const container = document.getElementById(elementId);
    
    if (!lista.length) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-300">
                <i class="fas fa-wind text-3xl mb-2 opacity-50"></i>
                <p class="text-xs font-bold">Sem atividade recente</p>
            </div>`;
        return;
    }

    container.innerHTML = lista.map(l => {
        const estilo = getEstiloCard(tipo);
        const data = new Date(l.data_hora);
        const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        let detalheTexto = l.detalhe || '';
        if(l.acao === 'COPIAR_RANK') detalheTexto = `Copiou frase ID #${l.detalhe}`;
        if(l.acao.includes('LOGIN')) detalheTexto = 'Login realizado com sucesso';

        // Aqui usamos o mapa para pegar o nome
        const nomeExibicao = mapaUsuarios[l.usuario] || l.usuario;
        const idExibicao = l.usuario; 

        return `
        <div class="relative pl-4 py-2 group">
            <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-100 group-last:bottom-auto group-last:h-1/2"></div>
            <div class="absolute left-[-4px] top-3 w-2.5 h-2.5 rounded-full ${estilo.dot} border-2 border-white shadow-sm"></div>
            
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
                <div class="flex justify-between items-start mb-1">
                    <div class="flex flex-col">
                        <span class="text-xs font-extrabold text-gray-800">${nomeExibicao}</span>
                        ${nomeExibicao !== idExibicao ? `<span class="text-[9px] text-gray-400 font-mono">ID: ${idExibicao}</span>` : ''}
                    </div>
                    <span class="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">${dataFormatada} ${horaFormatada}</span>
                </div>
                <p class="text-[10px] font-bold uppercase tracking-wider ${estilo.textAcao} mb-0.5 mt-1">${l.acao.replace(/_/g, ' ')}</p>
                <p class="text-xs text-gray-500 font-medium leading-tight">${detalheTexto}</p>
            </div>
        </div>`;
    }).join('');
}

function getEstiloCard(tipo) {
    if (tipo === 'acesso') return { dot: 'bg-green-500', textAcao: 'text-green-600' };
    if (tipo === 'uso') return { dot: 'bg-blue-500', textAcao: 'text-blue-600' };
    if (tipo === 'audit') return { dot: 'bg-orange-500', textAcao: 'text-orange-600' };
    return { dot: 'bg-gray-400', textAcao: 'text-gray-600' };
}
