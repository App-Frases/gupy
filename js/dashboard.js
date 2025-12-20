// Local: js/dashboard.js

let dashboardSubscription = null;

async function carregarDashboard() {
    // 1. Segurança
    const painel = document.getElementById('painel-dashboard');
    if (!usuarioLogado || usuarioLogado.perfil !== 'admin') {
        if(painel) painel.classList.add('hidden');
        return; 
    }
    if(painel) painel.classList.remove('hidden');

    try {
        exibirCarregando();
        
        // --- CONSULTAS DIRETA AO BANCO (Super Rápido) ---

        // A. Top 5 Frases Mais Usadas
        const { data: topFrases } = await _supabase
            .from('frases')
            .select('*')
            .order('usos', { ascending: false })
            .limit(5);

        // B. Top 5 Menos Usadas (Com filtro >= 10 usos)
        const { data: lowFrases } = await _supabase
            .from('frases')
            .select('*')
            .gte('usos', 10) // Greater Than or Equal (Maior ou igual a 10)
            .order('usos', { ascending: true })
            .limit(5);

        // C. Frases Inativas (90 Dias)
        const dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - 90);
        
        const { data: semUso90d } = await _supabase
            .from('frases')
            .select('*')
            // lt = Less Than (Menor que data de corte) OU is = null (nunca usadas)
            .or(`ultimo_uso.lt.${dataCorte.toISOString()},ultimo_uso.is.null`)
            .order('ultimo_uso', { ascending: true }); // As mais antigas primeiro

        // D. Ranking de Usuários (Ainda precisamos dos logs para isso)
        // Buscamos apenas os logs necessários
        const { data: logsUsuarios } = await _supabase
            .from('logs')
            .select('usuario');

        // E. Totalizadores Gerais
        const { count: totalFrases } = await _supabase.from('frases').select('*', { count: 'exact', head: true });
        
        // --- PROCESSAMENTO (Apenas Usuários agora) ---
        const rankingUsuarios = processarRankingUsuarios(logsUsuarios);
        const totalUsosGerais = logsUsuarios ? logsUsuarios.length : 0;

        // --- RENDERIZAÇÃO ---
        renderizarKPIs({ totalUsos: totalUsosGerais, totalFrases: totalFrases || 0, totalInativas: semUso90d?.length || 0, totalUsers: rankingUsuarios.all.length });
        
        renderizarTabelaUsuarios(rankingUsuarios.top5, 'lista-top-users', 'green');
        renderizarTabelaUsuarios(rankingUsuarios.bottom5, 'lista-bottom-users', 'gray');
        
        renderizarTopFrases(topFrases || [], 'lista-top-frases');
        renderizarLowFrases(lowFrases || [], 'lista-low-frases');
        renderizarFrasesSemUso(semUso90d || []);

        // Realtime
        if (!dashboardSubscription) {
            dashboardSubscription = _supabase.channel('dash-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => setTimeout(carregarDashboard, 2000))
                .subscribe();
        }

    } catch (e) {
        console.error("Erro Dashboard:", e);
    }
}

// Helper: Processa logs APENAS para ranking de equipe
function processarRankingUsuarios(logs) {
    if(!logs) return { top5: [], bottom5: [], all: [] };
    
    const contagem = {};
    logs.forEach(l => {
        if(l.usuario) contagem[l.usuario] = (contagem[l.usuario] || 0) + 1;
    });

    // Transforma em array e ordena
    const arrayUsers = Object.entries(contagem).map(([user, qtd]) => ({
        username: user,
        nome: formatarNomeUser(user), // Função auxiliar simples
        qtd: qtd
    }));

    arrayUsers.sort((a, b) => b.qtd - a.qtd);

    return {
        top5: arrayUsers.slice(0, 5),
        bottom5: [...arrayUsers].reverse().slice(0, 5),
        all: arrayUsers
    };
}

function formatarNomeUser(u) {
    return u.charAt(0).toUpperCase() + u.slice(1);
}

// --- RENDERIZADORES ---

function exibirCarregando() {
    const loading = '<tr><td colspan="4" class="p-4 text-center text-slate-400 animate-pulse text-xs">Carregando dados do servidor...</td></tr>';
    ['lista-top-users', 'lista-bottom-users', 'lista-top-frases', 'lista-low-frases', 'lista-frases-sem-uso'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = loading;
    });
}

function renderizarKPIs(stats) {
    setTexto('kpi-total-usos', stats.totalUsos);
    setTexto('kpi-frases-ativas', stats.totalFrases);
    setTexto('kpi-total-users', stats.totalUsers);
    
    const elSemUso = document.getElementById('contador-sem-uso');
    if(elSemUso) {
        elSemUso.innerText = stats.totalInativas;
        elSemUso.className = stats.totalInativas > 0 ? "text-2xl font-black text-orange-500" : "text-2xl font-black text-green-500";
    }
}

function renderizarTabelaUsuarios(lista, elementId, corTheme) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Sem dados</td></tr>'; return; }

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
                        <div class="flex justify-between items-baseline">
                            <span class="text-[10px] uppercase font-bold text-blue-600 truncate mr-2">${f.empresa || 'Geral'}</span>
                            <span class="text-[9px] font-mono text-slate-300">ID:${f.id}</span>
                        </div>
                        <p class="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">${f.conteudo}</p>
                    </div>
                    <div class="self-center ml-2">
                        <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">${f.usos || 0} Usos</span>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderizarLowFrases(lista, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-4 text-center text-xs text-gray-400">Nenhuma frase >10 usos.</td></tr>'; return; }

    tbody.innerHTML = lista.map((f, i) => `
        <tr class="border-b border-slate-50 hover:bg-orange-50/20 transition">
            <td class="px-5 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline">
                            <span class="text-[10px] uppercase font-bold text-slate-500 truncate mr-2">${f.motivo || 'Geral'}</span>
                            <span class="text-[9px] font-mono text-slate-300">ID:${f.id}</span>
                        </div>
                        <p class="text-xs text-slate-400 line-clamp-1 mt-0.5 italic">"${f.conteudo}"</p>
                    </div>
                    <div class="self-center ml-2">
                         <span class="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${f.usos} Usos</span>
                    </div>
                </div>
            </td>
        </tr>`).join('');
}

function renderizarFrasesSemUso(lista) {
    const tbody = document.getElementById('lista-frases-sem-uso');
    if (!tbody) return;
    if (!lista.length) { tbody.innerHTML = '<tr><td class="p-6 text-center text-green-600 bg-green-50/50 rounded-lg text-sm font-bold"><i class="fas fa-check-circle mr-2"></i>Tudo limpo!</td></tr>'; return; }

    tbody.innerHTML = lista.map(f => {
        let diasSemUso = "Nunca usada";
        if (f.ultimo_uso) {
            const diffTime = Math.abs(new Date() - new Date(f.ultimo_uso));
            diasSemUso = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + " dias";
        }

        return `
        <tr class="border-b border-slate-50 hover:bg-red-50 transition group">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex gap-2 items-center mb-1">
                            <span class="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">#${f.id}</span>
                            <span class="text-[10px] font-bold text-slate-600 uppercase truncate">${f.motivo || 'Sem Motivo'}</span>
                        </div>
                        <p class="text-xs text-slate-500 line-clamp-1">${f.conteudo}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-[9px] font-bold text-red-400 uppercase tracking-wide">Inativa há</div>
                        <div class="text-sm font-black text-slate-700 leading-tight">${diasSemUso}</div>
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 transition shrink-0">
                         <button onclick="deletarFraseDashboard(${f.id})" class="text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 w-8 h-8 rounded-full flex items-center justify-center transition" title="Excluir"><i class="fas fa-trash-alt text-xs"></i></button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function deletarFraseDashboard(id) {
    const result = await Swal.fire({title: 'Limpar frase?', text: `Frase #${id} inativa.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, excluir'});
    if (result.isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('LIMPEZA', `Dashboard: Removeu frase #${id}`);
        carregarDashboard();
    }
}

function setTexto(id, valor) { const el = document.getElementById(id); if(el) el.innerText = valor; }
