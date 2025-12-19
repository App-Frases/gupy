// Local: js/dashboard.js

// Variáveis Globais de Gráficos (para destruir e recriar corretamente)
let chartTimeline = null;
let chartMotivos = null;
let dashboardSubscription = null;
let debounceDashboard = null;

// --- INICIALIZAÇÃO E CARREGAMENTO ---

async function carregarDashboard() {
    try {
        // Data de corte: 30 dias para gráficos, 90 para estatísticas gerais
        const date30d = new Date(); date30d.setDate(date30d.getDate() - 30);
        const date90d = new Date(); date90d.setDate(date90d.getDate() - 90);
        
        // 1. Buscando Dados (Filtrados por data para performance)
        const { data: logs, error: errLogs } = await _supabase
            .from('logs')
            .select('*')
            .gte('data_hora', date90d.toISOString())
            .order('data_hora', { ascending: true }); // Importante para timeline
            
        const { data: users, error: errUsers } = await _supabase.from('usuarios').select('username, nome, ultimo_visto');
        const { data: phrases, error: errPhrases } = await _supabase.from('frases').select('id, empresa, motivo');
        
        if (errLogs || errUsers || errPhrases) throw new Error("Erro ao buscar dados");

        // 2. Processamento dos Dados
        const processado = processarDadosDashboard(logs, users, phrases, date30d);
        
        // 3. Atualização da Interface
        atualizarKPIs(processado);
        renderizarGraficos(processado);
        renderizarTabelas(processado);
        
        // 4. Iniciar Realtime (se ainda não iniciado)
        iniciarDashboardRealtime();

    } catch (e) {
        console.error("Dashboard Error:", e);
    }
}

// --- LÓGICA DE PROCESSAMENTO DE DADOS ---

function processarDadosDashboard(logs, users, phrases, date30d) {
    // Mapas auxiliares
    const phraseMap = {}; 
    phrases.forEach(p => phraseMap[p.id] = p);
    
    const userMap = {};
    users.forEach(u => userMap[u.username] = u.nome || u.username);

    // Estruturas de resultado
    let totalUsos30d = 0;
    let usersAtivosSet = new Set();
    const timelineData = {}; // "YYYY-MM-DD" -> count
    const motivosCount = {}; // "Feedback" -> count
    const userRanking = {}; // "username" -> count
    const phraseRanking = {}; // "id" -> count

    // Inicializa timeline com 0 para os últimos 30 dias (para o gráfico não ficar buraco)
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        timelineData[d.toISOString().split('T')[0]] = 0;
    }

    logs.forEach(log => {
        const logDate = new Date(log.data_hora);
        const dateStr = log.data_hora.split('T')[0];
        const isRecent30 = logDate >= date30d;

        // Só considera logs de cópia para estatísticas de USO
        if (log.acao === 'COPIAR') {
            const phraseId = String(log.detalhe).replace(/\D/g, ''); // Garante ID limpo
            
            // --- Estatísticas de 30 Dias ---
            if (isRecent30) {
                totalUsos30d++;
                usersAtivosSet.add(log.usuario);
                
                // Timeline
                if (timelineData[dateStr] !== undefined) timelineData[dateStr]++;

                // Motivos (Gráfico Rosca)
                if (phraseId && phraseMap[phraseId]) {
                    const motivo = phraseMap[phraseId].motivo || 'Outros';
                    motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
                }
            }

            // --- Rankings (Base 90 dias - logs totais trazidos) ---
            // Ranking Usuários
            userRanking[log.usuario] = (userRanking[log.usuario] || 0) + 1;
            
            // Ranking Frases
            if (phraseId) {
                phraseRanking[phraseId] = (phraseRanking[phraseId] || 0) + 1;
            }
        }
    });

    return {
        kpis: {
            totalUsos: totalUsos30d,
            activeUsers: usersAtivosSet.size,
            dailyAvg: (totalUsos30d / 30).toFixed(1)
        },
        charts: {
            timeline: timelineData,
            motivos: motivosCount
        },
        rankings: {
            users: userRanking,
            phrases: phraseRanking
        },
        meta: {
            userMap,
            phraseMap
        }
    };
}

// --- RENDERIZAÇÃO VISUAL ---

function atualizarKPIs(data) {
    // Efeito de contagem
    animateValue('dash-total-usos', 0, data.kpis.totalUsos, 800);
    animateValue('dash-active-users', 0, data.kpis.activeUsers, 800);
    animateValue('dash-daily-avg', 0, parseFloat(data.kpis.dailyAvg), 800);

    // Top Frase ID
    const topPhraseId = Object.entries(data.rankings.phrases).sort((a,b) => b[1] - a[1])[0];
    const elTop = document.getElementById('dash-top-phrase-id');
    if (topPhraseId && data.meta.phraseMap[topPhraseId[0]]) {
        elTop.innerText = data.meta.phraseMap[topPhraseId[0]].empresa;
    } else {
        elTop.innerText = "-";
    }
}

function renderizarGraficos(data) {
    // 1. Gráfico de Linha (Timeline)
    const ctxTimeline = document.getElementById('chart-timeline');
    if (ctxTimeline) {
        // Ordena datas
        const sortedDates = Object.keys(data.charts.timeline).sort();
        const values = sortedDates.map(d => data.charts.timeline[d]);
        // Formata datas para ficar bonito (ex: 15/12)
        const labels = sortedDates.map(d => d.split('-').slice(1).reverse().join('/'));

        if (chartTimeline) chartTimeline.destroy();

        chartTimeline = new Chart(ctxTimeline, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Frases Copiadas',
                    data: values,
                    borderColor: '#3b82f6', // blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3, // Curva suave
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Gráfico de Rosca (Motivos)
    const ctxMotivos = document.getElementById('chart-motivos');
    if (ctxMotivos) {
        // Pega Top 5 motivos e agrupa o resto em "Outros"
        const entries = Object.entries(data.charts.motivos).sort((a,b) => b[1] - a[1]);
        const top5 = entries.slice(0, 5);
        const others = entries.slice(5).reduce((acc, curr) => acc + curr[1], 0);
        
        if (others > 0) top5.push(['Outros', others]);

        const labels = top5.map(x => x[0]);
        const values = top5.map(x => x[1]);
        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

        if (chartMotivos) chartMotivos.destroy();

        chartMotivos = new Chart(ctxMotivos, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } 
                },
                cutout: '65%'
            }
        });
    }
}

function renderizarTabelas(data) {
    // 1. Top Colaboradores
    const elUsers = document.getElementById('table-top-users');
    const sortedUsers = Object.entries(data.rankings.users).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    elUsers.innerHTML = sortedUsers.map(([user, count], idx) => {
        const name = data.meta.userMap[user] || user;
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `<span class="text-slate-400 font-bold text-xs">#${idx+1}</span>`));
        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                <td class="px-6 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        <div class="w-6 text-center">${medal}</div>
                        <div class="font-bold text-slate-700 text-xs">${name}</div>
                    </div>
                </td>
                <td class="px-6 py-3 text-right">
                    <span class="bg-blue-100 text-blue-700 py-1 px-2 rounded text-xs font-bold">${count}</span>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="2" class="p-4 text-center text-xs text-slate-400">Sem dados.</td></tr>';

    // 2. Top Frases
    const elPhrases = document.getElementById('table-top-phrases');
    const sortedPhrases = Object.entries(data.rankings.phrases).sort((a,b) => b[1] - a[1]).slice(0, 10);

    elPhrases.innerHTML = sortedPhrases.map(([id, count], idx) => {
        const phrase = data.meta.phraseMap[id];
        if (!phrase) return '';
        // Calcula % para barra de progresso (baseado no maior valor)
        const maxVal = sortedPhrases[0][1];
        const pct = (count / maxVal) * 100;
        
        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <div class="flex justify-between items-end mb-1">
                            <span class="font-bold text-slate-700 text-xs truncate max-w-[150px]">${phrase.empresa}</span>
                            <span class="text-[10px] text-slate-400 font-bold">${count} usos</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1.5">
                            <div class="bg-orange-400 h-1.5 rounded-full" style="width: ${pct}%"></div>
                        </div>
                        <div class="text-[9px] text-slate-400 mt-0.5 truncate">${phrase.motivo}</div>
                    </div>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td class="p-4 text-center text-xs text-slate-400">Sem dados.</td></tr>';
}

// --- UTILS ---

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step); else obj.innerHTML = end;
    };
    window.requestAnimationFrame(step);
}

function iniciarDashboardRealtime() {
    if (dashboardSubscription) return; 
    dashboardSubscription = _supabase
        .channel('dashboard-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => {
            clearTimeout(debounceDashboard);
            debounceDashboard = setTimeout(carregarDashboard, 2000); // Debounce para não atualizar freneticamente
        })
        .subscribe();
}
