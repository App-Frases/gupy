// Local: js/dashboard.js

let dashboardData = {};
let dashboardSubscription = null;
let dashboardDebounceTimer = null;

function fecharModalDashboard() { 
    document.getElementById('modal-dashboard-detail').classList.add('hidden'); 
}

// --- CARREGAMENTO OTIMIZADO E CORRIGIDO ---
async function carregarDashboard() {
    const noventaDiasAtrasData = new Date();
    noventaDiasAtrasData.setDate(noventaDiasAtrasData.getDate() - 90);
    const dataCorteISO = noventaDiasAtrasData.toISOString();

    try {
        // 1. Busca Logs Recentes
        const { data: recentLogs, error: errLogs } = await _supabase
            .from('logs')
            .select('*')
            .gte('data_hora', dataCorteISO);

        // 2. Busca Usuários e Frases
        const { data: users, error: errUsers } = await _supabase.from('usuarios').select('*');
        const { data: phrases, error: errPhrases } = await _supabase.from('frases').select('*');
        
        if (errLogs || errUsers || errPhrases) throw new Error("Falha ao buscar dados");

        // --- CORREÇÃO DE CONTAGEM E ATIVIDADE ---

        // Lista de quem está ATIVO de verdade (apareceu nos logs recentemente)
        const usuariosComAtividadeRecente = new Set(recentLogs.map(l => l.usuario));

        // KPI 1: Usuários Ativos
        // Conta quem tem log recente
        const qtdUsuariosAtivos = usuariosComAtividadeRecente.size;

        // KPI 2: Cópias (Busca robusta por qualquer variação de COPIAR)
        const logsCopias = recentLogs.filter(l => l.acao && l.acao.toUpperCase().includes('COPIAR'));
        const qtdCopias = logsCopias.length;

        // KPI 3: Edições
        const qtdEdicoes = recentLogs.filter(l => 
            l.acao && (l.acao.includes('CRIAR') || l.acao.includes('EDITAR'))
        ).length;

        // Atualiza números na tela
        animateValue('kpi-users', parseInt(document.getElementById('kpi-users').innerText || 0), qtdUsuariosAtivos, 1000);
        animateValue('kpi-copies', parseInt(document.getElementById('kpi-copies').innerText || 0), qtdCopias, 1000);
        animateValue('kpi-edits', parseInt(document.getElementById('kpi-edits').innerText || 0), qtdEdicoes, 1000);

        // --- CÁLCULO DE ESTATÍSTICAS ---

        // 1. Ranking de Usuários
        const statsU = users.map(u => ({
            username: u.username,
            nome: u.nome || u.username,
            // Conta quantas cópias esse usuário fez exatamente
            copias: logsCopias.filter(l => l.usuario === u.username).length
        })).sort((a, b) => b.copias - a.copias);

        // 2. Ranking de Frases (CORREÇÃO CRÍTICA DO ID)
        const statsF = phrases.map(f => {
            const usos = logsCopias.filter(l => {
                const detalheLog = String(l.detalhe || '').trim(); // Converte log para string (ex: "15")
                const idFrase = String(f.id); // ID da frase (ex: "15")
                
                // Verifica 3 cenários:
                // A) O log é exatamente o ID (ex: "15") - Padrão novo
                // B) O log contém o ID com hashtag (ex: "#15") - Padrão visual
                // C) O log contém o texto da frase (ex: "Candidato reprovado...") - Legado
                
                const matchID = detalheLog === idFrase;
                const matchTag = detalheLog.includes(`#${idFrase}`);
                // Match texto: só verifica se o detalhe é longo (>10 chars) para evitar falso positivo com números
                const matchTexto = detalheLog.length > 10 && detalheLog.includes(f.conteudo.substring(0, 20));

                return matchID || matchTag || matchTexto;
            }).length;
            
            return { ...f, usos };
        }).sort((a, b) => b.usos - a.usos);

        // 3. Ghosts (CORREÇÃO: Dupla verificação)
        const ghosts = users.filter(u => {
            // Se o usuário tem logs recentes, ele NÃO é fantasma (ignora o ultimo_visto bugado)
            if (usuariosComAtividadeRecente.has(u.username)) return false;

            // Se não tem log recente, confiamos no ultimo_visto
            if (!u.ultimo_visto) return true; // Nunca visto
            return new Date(u.ultimo_visto) < noventaDiasAtrasData; // Visto há muito tempo
        });

        dashboardData = { statsF, statsU, ghosts };

        iniciarDashboardRealtime();

    } catch (e) {
        console.error("Erro no Dashboard:", e);
    }
}

// --- REALTIME ---
function iniciarDashboardRealtime() {
    if (dashboardSubscription) return; 

    dashboardSubscription = _supabase
        .channel('dashboard-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => agendarAtualizacao())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'frases' }, () => agendarAtualizacao())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => agendarAtualizacao())
        .subscribe();
}

function agendarAtualizacao() {
    clearTimeout(dashboardDebounceTimer);
    dashboardDebounceTimer = setTimeout(() => {
        carregarDashboard();
        
        const modal = document.getElementById('modal-dashboard-detail');
        if (modal && !modal.classList.contains('hidden')) {
            const titulo = document.getElementById('modal-dash-title').innerText;
            if(titulo.includes('Ranking')) abrirModalDashboard('RANKING');
            else if(titulo.includes('Top')) abrirModalDashboard('TOP');
            else if(titulo.includes('Inativos')) abrirModalDashboard('GHOSTS');
            else if(titulo.includes('Auditoria')) abrirModalDashboard('AUDIT');
        }
    }, 1000);
}

// --- MODAIS DE DETALHES ---
function abrirModalDashboard(tipo) {
    const modal = document.getElementById('modal-dashboard-detail'); 
    modal.classList.remove('hidden'); 
    const c = document.getElementById('modal-dash-content');
    const title = document.getElementById('modal-dash-title');

    if(tipo === 'RANKING') {
        title.innerHTML = '<i class="fas fa-trophy text-blue-500"></i> Ranking (90 dias)';
        // Filtra para mostrar só quem tem cópias > 0
        const ativos = dashboardData.statsU.filter(u => u.copias > 0);
        
        c.innerHTML = ativos.length ? `
            <table class="w-full text-sm text-left">
                <thead class="bg-gray-50 font-bold text-gray-500 border-b">
                    <tr><th class="p-4">Colaborador</th><th class="p-4 text-right">Cópias</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${ativos.map((u, i) => `
                        <tr class="hover:bg-gray-50 transition">
                            <td class="p-4">
                                <div class="font-bold text-gray-700 flex items-center gap-2">
                                    <span class="w-6 text-gray-400 font-normal text-xs">#${i+1}</span> 
                                    ${u.nome}
                                    ${i === 0 ? '<i class="fas fa-crown text-yellow-400 ml-1"></i>' : ''}
                                </div>
                            </td>
                            <td class="p-4 text-right">
                                <span class="bg-blue-100 text-blue-700 py-1 px-3 rounded-full font-bold text-xs">${u.copias}</span>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>` : '<div class="p-10 text-center text-gray-400">Nenhuma cópia registrada.</div>';
    }

    if(tipo === 'TOP') {
        title.innerHTML = '<i class="fas fa-fire text-orange-500"></i> Top Frases (90 dias)';
        const top20 = dashboardData.statsF.slice(0, 20).filter(f => f.usos > 0); // Só mostra o que tem uso
        c.innerHTML = top20.length ? `
            <ul class="divide-y divide-gray-100">
                ${top20.map((f, i) => `
                    <li class="p-4 hover:bg-gray-50 flex justify-between items-center transition">
                        <div>
                            <div class="font-bold text-blue-600 mb-0.5 flex items-center gap-2">
                                #${i+1} ${f.empresa}
                            </div>
                            <div class="text-sm text-gray-800">${f.motivo}</div>
                        </div>
                        <div class="text-right shrink-0 ml-4">
                            <span class="text-lg font-extrabold text-gray-700">${f.usos}</span>
                            <span class="block text-[10px] text-gray-400 uppercase font-bold">usos</span>
                        </div>
                    </li>`).join('')}
            </ul>` : '<div class="p-10 text-center text-gray-400">Nenhum uso recente detectado.</div>';
    }

    if(tipo === 'GHOSTS') {
        title.innerHTML = '<i class="fas fa-ghost text-gray-400"></i> Inativos (>90 dias)';
        const listaInativos = dashboardData.ghosts;
        
        c.innerHTML = listaInativos.length ? 
            `<div class="p-4">
                <p class="text-xs text-gray-500 mb-4 bg-yellow-50 p-3 rounded border border-yellow-100">
                    <i class="fas fa-info-circle mr-1"></i> Usuários sem login e sem atividade recente.
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${listaInativos.map(u => {
                        const lastSeen = u.ultimo_visto ? new Date(u.ultimo_visto).toLocaleDateString('pt-BR') : 'Nunca';
                        return `
                        <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center hover:bg-gray-100 transition">
                            <span class="font-bold text-gray-600 text-sm block">${u.nome || u.username}</span>
                            <span class="text-[10px] text-red-400 font-bold">Visto: ${lastSeen}</span>
                        </div>`;
                    }).join('')}
                </div>
             </div>` : 
            '<div class="p-10 text-center text-green-500 font-bold">Todos os usuários estão ativos!</div>';
    }

    if(tipo === 'AUDIT') {
        title.innerHTML = '<i class="fas fa-broom text-red-500"></i> Auditoria de Frases';
        const l = dashboardData.statsF.filter(f => f.usos < 3 && (new Date() - new Date(f.created_at || 0)) / 86400000 > 90);
        c.innerHTML = l.length ? l.map(f => `
            <div class="p-4 border-b flex justify-between items-center hover:bg-red-50 transition">
                <div>
                    <div class="font-bold text-gray-700">${f.empresa}</div>
                    <div class="text-xs text-red-500 mt-1">Baixo uso (${f.usos})</div>
                </div>
                <button onclick="deletarFraseDashboard(${f.id}, '${f.empresa}', ${f.usos})" class="bg-white text-red-500 border border-red-200 px-3 py-1 rounded hover:bg-red-500 hover:text-white text-xs font-bold transition">Excluir</button>
            </div>`).join('') : '<div class="p-10 text-center text-gray-400 font-bold">Nenhuma frase obsoleta.</div>';
    }
}

async function deletarFraseDashboard(id, autor, usos) { 
    if((await Swal.fire({
        title:'Excluir?', html:`Frase com <b>${usos} usos</b>. Confirmar?`, icon: 'warning',
        showCancelButton:true, confirmButtonColor:'#ef4444', confirmButtonText: 'Sim', cancelButtonText: 'Não'
    })).isConfirmed) { 
        await _supabase.from('frases').delete().eq('id', id); 
        await _supabase.from('logs').insert([{usuario: usuarioLogado.username, acao: 'LIMPEZA', detalhe: `Removeu frase #${id}`}]);
        if(typeof carregarFrases === 'function') carregarFrases(); 
        agendarAtualizacao();
        Swal.fire('Removido', '', 'success');
    } 
}

function animateValue(id, start, end, duration) {
    if (start === end) return;
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
