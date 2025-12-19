// Local: js/dashboard.js

let dashboardSubscription = null;

async function carregarDashboard() {
    // 1. Segurança: Só carrega se for admin
    const painel = document.getElementById('painel-dashboard');
    if (!usuarioLogado || usuarioLogado.perfil !== 'admin') {
        if(painel) painel.classList.add('hidden');
        return; 
    }
    
    // Mostra o painel se estava oculto
    if(painel) painel.classList.remove('hidden');

    try {
        exibirCarregando();
        
        // 2. Busca de Dados Otimizada
        // Buscamos TUDO para garantir exatidão no cálculo de histórico
        
        // A. Frases (ID, Conteúdo, etc)
        const { data: frases, error: errF } = await _supabase
            .from('frases')
            .select('*');

        // B. Usuários (Para mapear nomes)
        const { data: usuarios, error: errU } = await _supabase
            .from('usuarios')
            .select('username, nome');

        // C. Logs de RANKING (Apenas a ação que conta como 'uso' da frase)
        const { data: logsRank, error: errL1 } = await _supabase
            .from('logs')
            .select('usuario, detalhe, data_hora')
            .eq('acao', 'COPIAR_RANK'); // Baseado no seu backup, esta é a ação correta

        // D. Logs GERAIS (Para medir atividade do usuário - Login, Criação, etc)
        const { data: logsGerais, error: errL2 } = await _supabase
            .from('logs')
            .select('usuario, data_hora'); 

        if (errF || errU || errL1 || errL2) throw new Error("Erro de conexão ao buscar dados.");

        // 3. Processamento Matemático
        const stats = calcularEstatisticas(frases, usuarios, logsRank, logsGerais);

        // 4. Renderização
        renderizarKPIs(stats);
        renderizarTabelaUsuarios(stats.topUsers, 'lista-top-users', 'green');
        renderizarTabelaUsuarios(stats.bottomUsers, 'lista-bottom-users', 'gray');
        renderizarTopFrases(stats.topFrases, 'lista-top-frases');
        renderizarLowFrases(stats.lowFrases, 'lista-low-frases'); // Nova tabela
        renderizarFrasesSemUso(stats.semUso90d);

        // 5. Realtime (Atualiza a cada 5 segundos se houver mudanças, para não sobrecarregar)
        if (!dashboardSubscription) {
            dashboardSubscription = _supabase.channel('dash-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
                    setTimeout(carregarDashboard, 5000); 
                }).subscribe();
        }

    } catch (e) {
        console.error("Erro Dashboard:", e);
        Swal.fire('Erro', 'Não foi possível carregar os dados do dashboard.', 'error');
    }
}

function calcularEstatisticas(frases, usuarios, logsRank, logsGerais) {
    const agora = new Date();
    const corte90d = new Date();
    corte90d.setDate(agora.getDate() - 90);

    // --- Mapeamento de Usuários ---
    const userMap = {};
    const atividadeUser = {}; // Quantidade de ações totais
    
    // Inicializa contadores de usuários
    usuarios.forEach(u => {
        userMap[u.username] = u.nome || u.username;
        atividadeUser[u.username] = 0;
    });

    // Conta atividade geral dos usuários
    logsGerais.forEach(log => {
        if (atividadeUser.hasOwnProperty(log.usuario)) {
            atividadeUser[log.usuario]++;
        }
    });

    // --- Processamento de Frases ---
    const usoFrases = {}; // ID -> Qtd Usos
    const ultimaDataFrase = {}; // ID -> Data Objeto

    // Inicializa contadores de frases
    frases.forEach(f => {
        usoFrases[f.id] = 0;
        ultimaDataFrase[f.id] = new Date(f.created_at); // Data base é a criação
    });

    // Processa logs de Ranking (Uso real da frase)
    logsRank.forEach(log => {
        const id = log.detalhe; // No backup, o detalhe é o ID (ex: "2561")
        const dataLog = new Date(log.data_hora);

        if (usoFrases.hasOwnProperty(id)) {
            usoFrases[id]++;
            
            // Atualiza última vez vista se o log for mais recente que o registro atual
            if (dataLog > ultimaDataFrase[id]) {
                ultimaDataFrase[id] = dataLog;
            }
        }
    });

    // --- GERAÇÃO DOS RANKINGS ---

    // 1. Usuários (Todos os usuários do sistema são considerados)
    const rankingUsers = Object.entries(atividadeUser).map(([user, qtd]) => ({
        nome: userMap[user],
        username: user,
        qtd
    }));
    
    rankingUsers.sort((a, b) => b.qtd - a.qtd); // Ordena decrescente

    // 2. Frases (Preparação)
    const rankingFrases = frases.map(f => ({
        ...f,
        usos: usoFrases[f.id],
        ultima_vez: ultimaDataFrase[f.id]
    }));

    // Ranking Top Mais Usadas
    rankingFrases.sort((a, b) => b.usos - a.usos);
    const topFrases = rankingFrases.slice(0, 5);

    // Ranking Menos Usadas (Regra: Pelo menos 10 usos)
    // Filtramos quem tem >= 10 e ordenamos ASCENDENTE (a - b)
    const lowFrases = rankingFrases
        .filter(f => f.usos >= 10)
        .sort((a, b) => a.usos - b.usos)
        .slice(0, 5);

    // Frases Sem Uso Recente (Regra: Última data < 90 dias atrás)
    const semUso90d = rankingFrases.filter(f => f.ultima_vez < corte90d);
    // Ordenar as mais antigas primeiro
    semUso90d.sort((a, b) => a.ultima_vez - b.ultima_vez);

    return {
        totalUsos: logsRank.length,
        totalFrases: frases.length,
        totalUsers: usuarios.length,
        topUsers: rankingUsers.slice(0, 5),
        bottomUsers: [...rankingUsers].reverse().slice(0, 5), // Inverte para pegar os últimos
        topFrases: topFrases,
        lowFrases: lowFrases,
        semUso90d: semUso90d
    };
}

// --- RENDERIZADORES ---

function exibirCarregando() {
    const loading = '<tr><td colspan="4" class="p-4 text-center text-slate-400 animate-pulse">Calculando dados...</td></tr>';
    const ids = ['lista-top-users', 'lista-bottom-users', 'lista-top-frases', 'lista-low-frases', 'lista-frases-sem-uso'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = loading;
    });
}

function renderizarKPIs(stats) {
    setTexto('kpi-total-usos', stats.totalUsos);
    setTexto('kpi-frases-ativas', stats.totalFrases);
    setTexto('kpi-total-users', stats.totalUsers);
    
    const elSemUso = document.getElementById('contador-sem-uso');
    if(elSemUso) {
        elSemUso.innerText = stats.semUso90d.length;
        if(stats.semUso90d.length > 0) elSemUso.className = "text-2xl font-black text-red-500";
        else elSemUso.className = "text-2xl font-black text-green-500";
    }
}

function renderizarTabelaUsuarios(lista, elementId, corTheme) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Sem dados</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 text-xs font-bold text-slate-300">#${i + 1}</div>
                        <div>
                            <p class="font-bold text-slate-700 text-xs">${u.nome}</p>
                            <p class="text-[10px] text-slate-400">@${u.username}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold px-2 py-1 rounded-full bg-${corTheme}-100 text-${corTheme}-700">
                        ${u.qtd} ações
                    </span>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderizarTopFrases(lista, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    tbody.innerHTML = lista.map((f, i) => {
        let icon = `<span class="text-slate-300">#${i+1}</span>`;
        if(i===0) icon = '👑';
        if(i===1) icon = '🥈';
        if(i===2) icon = '🥉';

        return `
        <tr class="border-b border-slate-50 hover:bg-yellow-50/20 transition">
            <td class="px-5 py-3">
                <div class="flex items-start gap-3">
                    <div class="mt-1 font-bold">${icon}</div>
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <span class="text-[10px] uppercase font-bold text-blue-500">${f.empresa}</span>
                            <span class="text-[10px] font-mono text-slate-400">ID:${f.id}</span>
                        </div>
                        <p class="text-xs text-slate-600 line-clamp-2 mt-0.5" title="${f.conteudo}">${f.conteudo}</p>
                        <div class="mt-1 text-right">
                            <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                ${f.usos} Usos
                            </span>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');
}

function renderizarLowFrases(lista, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return; // Se o elemento não existir no HTML, ignora

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Nenhuma frase com >10 usos encontrada nesta faixa.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((f, i) => `
        <tr class="border-b border-slate-50 hover:bg-gray-50 transition">
            <td class="px-5 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <span class="text-[10px] uppercase font-bold text-gray-500">${f.motivo || 'Geral'}</span>
                            <span class="text-[10px] font-mono text-slate-400">ID:${f.id}</span>
                        </div>
                        <p class="text-xs text-slate-500 line-clamp-1 mt-0.5 italic">"${f.conteudo}"</p>
                    </div>
                    <div class="self-center">
                         <span class="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ${f.usos}
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderizarFrasesSemUso(lista) {
    const tbody = document.getElementById('lista-frases-sem-uso');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td class="p-6 text-center text-green-600 bg-green-50 rounded-lg text-sm font-bold">Tudo limpo! Nenhuma frase abandonada há 90 dias.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(f => {
        const diasSemUso = Math.floor((new Date() - new Date(f.ultima_vez)) / (1000 * 60 * 60 * 24));
        
        return `
        <tr class="border-b border-slate-50 hover:bg-red-50 transition group">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="flex gap-2 items-center">
                            <span class="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-500">#${f.id}</span>
                            <span class="text-xs font-bold text-slate-700">${f.motivo || 'Sem Motivo'}</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-1 max-w-[300px]">${f.conteudo}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] font-bold text-red-500 uppercase">Inativa há</div>
                        <div class="text-sm font-black text-slate-700">${diasSemUso} dias</div>
                    </div>
                    <div class="ml-4 opacity-0 group-hover:opacity-100 transition">
                         <button onclick="deletarFraseDashboard(${f.id})" class="text-red-400 hover:text-red-600 p-2" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');
}

// --- AÇÕES DO DASHBOARD ---

async function deletarFraseDashboard(id) {
    const result = await Swal.fire({
        title: 'Limpar frase?',
        text: `Frase #${id} inativa. Deseja excluir?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, limpar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from('frases').delete().eq('id', id);
            if (error) throw error;
            
            // Log de sistema
            registrarLog('LIMPEZA', `Dashboard: Removeu frase inativa #${id}`);
            
            Swal.fire({
                title: 'Removido!', 
                icon: 'success', 
                toast: true, 
                position: 'top-end', 
                showConfirmButton: false, 
                timer: 1500
            });
            
            carregarDashboard(); // Recarrega
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    }
}

// Utilitário simples
function setTexto(id, valor) {
    const el = document.getElementById(id);
    if(el) el.innerText = valor;
}
