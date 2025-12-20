// Local: js/dashboard.js

let dashboardSubscription = null;

async function carregarDashboard() {
    const painel = document.getElementById('painel-dashboard');
    
    if (!usuarioLogado || usuarioLogado.perfil !== 'admin') {
        if(painel) painel.classList.add('hidden');
        return; 
    }
    if(painel) painel.classList.remove('hidden');

    try {
        const tabela = document.getElementById('lista-top-users');
        if(!tabela || tabela.innerHTML === '') exibirCarregando();
        
        // --- 1. BUSCA DE DADOS ---
        
        // Mapa de Nomes (Para transformar ID em Nome Real)
        const { data: usuariosData } = await _supabase.from('usuarios').select('username, nome');
        const mapaNomes = {};
        if (usuariosData) {
            usuariosData.forEach(u => mapaNomes[u.username] = u.nome || formatarNomeUser(u.username));
        }

        // Métricas de Frases
        const { data: topFrases } = await _supabase.from('frases').select('*').order('usos', { ascending: false }).limit(5);
        const { data: lowCandidates } = await _supabase.from('frases').select('*').gt('usos', 0).order('usos', { ascending: true }).limit(30);
        
        const dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - 90);
        const { data: semUso90d } = await _supabase.from('frases').select('*').or(`ultimo_uso.lt.${dataCorte.toISOString()},ultimo_uso.is.null`).order('ultimo_uso', { ascending: true });
        
        // TOTAL GERAL (KPI) - Usa count exact do banco
        const { count: totalInteracoesReal } = await _supabase.from('logs').select('*', { count: 'exact', head: true });
        const { count: totalFrases } = await _supabase.from('frases').select('*', { count: 'exact', head: true });
        
        // RANKINGS (Agora via VIEW - 100% Preciso e sem limite de 1000)
        // Busca os Top 5
        const { data: rankingTop } = await _supabase.from('view_ranking_usuarios').select('*').order('qtd_acoes', { ascending: false }).limit(5);
        
        // Busca os Bottom 5 (Menos ativos, mas com alguma ação)
        const { data: rankingBottom } = await _supabase.from('view_ranking_usuarios').select('*').order('qtd_acoes', { ascending: true }).limit(5);

        // --- 2. PROCESSAMENTO ---
        
        const topLista = topFrases || [];
        const idsTop = topLista.map(f => f.id);
        const lowLista = (lowCandidates || []).filter(f => !idsTop.includes(f.id)).slice(0, 5);

        // Processa nomes para o Ranking
        const processarRanking = (lista) => {
            if(!lista) return [];
            return lista.map(item => ({
                username: item.usuario,
                nome: mapaNomes[item.usuario] || formatarNomeUser(item.usuario),
                qtd: item.qtd_acoes
            }));
        };

        const listaTopUsers = processarRanking(rankingTop);
        const listaBottomUsers = processarRanking(rankingBottom);

        // --- 3. RENDERIZAÇÃO ---

        renderizarKPIs({ 
            totalUsos: totalInteracoesReal || 0,
            totalFrases: totalFrases || 0, 
            totalInativas: semUso90d?.length || 0, 
            totalUsers: Object.keys(mapaNomes).length 
        });
        
        renderizarTabelaUsuarios(listaTopUsers, 'lista-top-users', 'green');
        renderizarTabelaUsuarios(listaBottomUsers, 'lista-bottom-users', 'gray');
        renderizarTopFrases(topLista, 'lista-top-frases');
        renderizarLowFrases(lowLista, 'lista-low-frases');
        renderizarFrasesSemUso(semUso90d || [], mapaNomes);

        // --- 4. REALTIME ---
        iniciarRealtimeDashboard();

    } catch (e) {
        console.error("Erro Dashboard:", e);
    }
}

function iniciarRealtimeDashboard() {
    if (dashboardSubscription) return;

    dashboardSubscription = _supabase.channel('dashboard-v4-view')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => atualizarAposDelay())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'frases' }, () => atualizarAposDelay())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => atualizarAposDelay())
        .subscribe();
}

let timeoutUpdate;
function atualizarAposDelay() {
    clearTimeout(timeoutUpdate);
    timeoutUpdate = setTimeout(() => {
        carregarDashboard();
    }, 1000);
}

// --- FUNÇÕES AUXILIARES ---

function formatarNomeUser(u) { return u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Usuário'; }

function exibirCarregando() {
    const loading = '<tr><td colspan="4" class="p-4 text-center text-slate-400 animate-pulse text-xs"><i class="fas fa-sync fa-spin mr-2"></i>Calculando...</td></tr>';
    ['lista-top-users', 'lista-bottom-users', 'lista-top-frases', 'lista-low-frases', 'lista-frases-sem-uso'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = loading;
    });
}

function renderizarKPIs(stats) {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val.toLocaleString('pt-BR'); };
    set('kpi-total-usos', stats.totalUsos);
    set('kpi-frases-ativas', stats.totalFrases);
    set('kpi-total-users', stats.totalUsers);
    
    const elSemUso = document.getElementById('contador-sem-uso');
    if(elSemUso) {
        elSemUso.innerText = stats.totalInativas;
        elSemUso.className = stats.totalInativas > 0 ? "text-2xl font-black text-orange-500" : "text-2xl font-black text-green-500";
    }
}

function renderizarTabelaUsuarios(lista, elementId, corTheme) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Sem dados.</td></tr>'; return; }

    tbody.innerHTML = lista.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 text-xs font-bold text-slate-300">#${i + 1}</div>
                        <div><p class="font-bold text-slate-700 text-xs">${u.nome}</p><p class="text-[10px] text-slate-400">@${u.username}</p></div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-${corTheme}-100 text-${corTheme}-700">${u.qtd} ações</span>
                </div>
            </td>
        </tr>`).join('');
}

function renderizarTopFrases(lista, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Sem dados.</td></tr>'; return; }

    tbody.innerHTML = lista.map((f, i) => {
        let icon = `<span class="text-slate-300 text-xs">#${i+1}</span>`;
        if(i===0) icon = '👑'; if(i===1) icon = '🥈'; if(i===2) icon = '🥉';
        return `
        <tr class="border-b border-slate-50 hover:bg-blue-50/20 transition">
            <td class="px-5 py-3">
                <div class="flex items-start gap-3">
                    <div class="mt-0.5 font-bold w-4 text-center">${icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline"><span class="text-[10px] uppercase font-bold text-blue-600 truncate mr-2">${f.empresa || 'Geral'}</span><span class="text-[9px] font-mono text-slate-300">ID:${f.id}</span></div>
                        <p class="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">${f.conteudo}</p>
                    </div>
                    <div class="self-center ml-2"><span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">${f.usos || 0} Usos</span></div>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderizarLowFrases(lista, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Todas as frases em uso!</td></tr>'; return; }

    tbody.innerHTML = lista.map((f, i) => `
        <tr class="border-b border-slate-50 hover:bg-orange-50/20 transition">
            <td class="px-5 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline"><span class="text-[10px] uppercase font-bold text-slate-500 truncate mr-2">${f.motivo || 'Geral'}</span><span class="text-[9px] font-mono text-slate-300">ID:${f.id}</span></div>
                        <p class="text-xs text-slate-400 line-clamp-1 mt-0.5 italic">"${f.conteudo}"</p>
                    </div>
                    <div class="self-center ml-2"><span class="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${f.usos} Usos</span></div>
                </div>
            </td>
        </tr>`).join('');
}

function renderizarFrasesSemUso(lista, mapaNomes) {
    const tbody = document.getElementById('lista-frases-sem-uso');
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-6 text-center text-green-600 bg-green-50/50 rounded-lg text-sm font-bold"><i class="fas fa-check-circle mr-2"></i>Tudo limpo (90d)!</td></tr>'; return; }

    tbody.innerHTML = lista.map(f => {
        let diasSemUso = "Nunca";
        if (f.ultimo_uso) {
            const diffTime = Math.abs(new Date() - new Date(f.ultimo_uso));
            diasSemUso = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + " dias";
        }
        const nomeCriador = mapaNomes[f.revisado_por] || f.revisado_por || 'Sistema';
        return `
        <tr class="border-b border-slate-50 hover:bg-red-50 transition group">
            <td class="px-5 py-3 align-top w-16"><span class="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 block text-center">#${f.id}</span></td>
            <td class="px-5 py-3"><div class="flex-1 min-w-0"><span class="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">${f.motivo || 'Sem Motivo'}</span><p class="text-xs text-slate-500 line-clamp-2" title="${f.conteudo}">${f.conteudo}</p></div></td>
            <td class="px-5 py-3 align-top"><div class="flex items-center gap-1.5"><div class="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">${nomeCriador.charAt(0).toUpperCase()}</div><span class="text-xs font-bold text-slate-600 truncate max-w-[80px]">${nomeCriador}</span></div></td>
            <td class="px-5 py-3 align-top text-right"><div class="text-[9px] font-bold text-red-400 uppercase tracking-wide">Inativa há</div><div class="text-sm font-black text-slate-700 leading-tight mb-1">${diasSemUso}</div><button onclick="deletarFraseDashboard(${f.id})" class="text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 text-[10px] px-2 py-0.5 rounded transition">Excluir</button></td>
        </tr>`;
    }).join('');
}

async function deletarFraseDashboard(id) {
    const result = await Swal.fire({title: 'Limpar frase?', text: `Frase #${id} inativa.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, excluir'});
    if (result.isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('LIMPEZA', `Dashboard: Removeu frase #${id}`);
    }
}
