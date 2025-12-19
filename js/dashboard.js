// Local: js/dashboard.js

let dashboardData = {};
let dashboardSubscription = null;
let dashboardDebounceTimer = null;

function fecharModalDashboard() { 
    document.getElementById('modal-dashboard-detail').classList.add('hidden'); 
}

// --- CARREGAMENTO OTIMIZADO ---
async function carregarDashboard() {
    // Calcula data de corte (90 dias atrás) em formato ISO para o Banco
    const noventaDiasAtrasData = new Date();
    noventaDiasAtrasData.setDate(noventaDiasAtrasData.getDate() - 90);
    const dataCorteISO = noventaDiasAtrasData.toISOString();

    try {
        // 1. Busca Logs filtrados (Apenas últimos 90 dias) - Muito mais rápido
        const { data: recentLogs, error: errLogs } = await _supabase
            .from('logs')
            .select('*')
            .gte('data_hora', dataCorteISO); // .gte = Greater Than or Equal (Maior ou igual)

        // 2. Busca Usuários e Frases
        const { data: users, error: errUsers } = await _supabase.from('usuarios').select('*');
        const { data: phrases, error: errPhrases } = await _supabase.from('frases').select('*');
        
        if (errLogs || errUsers || errPhrases) throw new Error("Falha ao buscar dados");

        // --- PROCESSAMENTO DOS DADOS (MEMÓRIA) ---
        
        // Mapeamento de usuários (ID -> Nome)
        const userMap = {};
        users.forEach(u => userMap[u.username] = u.nome || u.username);

        // KPI 1: Usuários Ativos (Quem gerou log nos últimos 90d)
        const usuariosAtivosSet = new Set(recentLogs.map(l => l.usuario));
        const qtdUsuariosAtivos = usuariosAtivosSet.size;

        // KPI 2: Cópias Realizadas
        const logsCopias = recentLogs.filter(l => l.acao && l.acao.includes('COPIAR'));
        const qtdCopias = logsCopias.length;

        // KPI 3: Edições/Criações
        const qtdEdicoes = recentLogs.filter(l => ['CRIAR', 'EDITAR', 'CRIAR_USER'].includes(l.acao)).length;

        // Atualiza Cards Superiores
        animateValue('kpi-users', parseInt(document.getElementById('kpi-users').innerText), qtdUsuariosAtivos, 1000);
        animateValue('kpi-copies', parseInt(document.getElementById('kpi-copies').innerText), qtdCopias, 1000);
        animateValue('kpi-edits', parseInt(document.getElementById('kpi-edits').innerText), qtdEdicoes, 1000);

        // --- CÁLCULO DE ESTATÍSTICAS ---

        // 1. Ranking de Frases (Top Phrases)
        // Conta quantas vezes cada ID de frase aparece nos detalhes dos logs de cópia
        // Obs: O log "COPIAR_RANK" costuma salvar o ID ou Texto no detalhe. 
        // Vamos assumir que salva algo identificável. Se salvar texto, agrupa por texto.
        const usoFrasesMap = {};
        logsCopias.forEach(l => {
            // Tenta extrair ID ou usa o texto inteiro se não for ID
            // Se o seu log salva "Copiou frase #15", extraímos o 15. Se salva o texto, usamos o texto.
            // Pelo seu código anterior, parecia usar o próprio texto/ID no detalhe.
            const chave = l.detalhe; 
            usoFrasesMap[chave] = (usoFrasesMap[chave] || 0) + 1;
        });

        // Cruza com a tabela de frases reais para pegar Empresa/Motivo
        // Nota: Se o log salva apenas o ID, precisamos converter. Se salva texto, fazemos match.
        // Assumindo match direto ou ID contido na frase.
        const statsF = phrases.map(f => {
            // Tenta achar pelo ID ou pelo Conteúdo exato
            // Verifica se existe log com o ID da frase ou com o texto dela
            let usos = 0;
            
            // Verifica ocorrências exatas ou parciais (ajuste conforme como você grava o log)
            // Exemplo simplificado: contagem baseada no ID mapeado no log
            // Se você grava "Copiou: Texto da Frase", a chave é o texto.
            
            // Lógica genérica: Procura nos logs de cópia quantos batem com esta frase
            // (Isso pode ser pesado, mas para <1000 logs é ok)
            usos = logsCopias.filter(l => l.detalhe && (l.detalhe.includes(f.conteudo) || l.detalhe.includes(`#${f.id}`))).length;
            
            return { ...f, usos };
        }).sort((a, b) => b.usos - a.usos);

        // 2. Ranking de Usuários (Quem mais copiou)
        const statsU = users.map(u => ({
            username: u.username,
            nome: u.nome || u.username,
            copias: logsCopias.filter(l => l.usuario === u.username).length
        })).sort((a, b) => b.copias - a.copias);

        // 3. Ghosts (Inativos) - Baseado no 'ultimo_visto' do banco de usuários
        const ghosts = users.filter(u => {
            if (!u.ultimo_visto) return true; // Nunca viu
            return new Date(u.ultimo_visto) < noventaDiasAtrasData;
        });

        // Salva globalmente para usar nos Modais
        dashboardData = { statsF, statsU, ghosts };

        // Inicia Realtime se ainda não iniciou
        iniciarDashboardRealtime();

    } catch (e) {
        console.error("Erro no Dashboard:", e);
    }
}

// --- REALTIME ---
function iniciarDashboardRealtime() {
    if (dashboardSubscription) return; // Já está rodando

    // Escuta mudanças nas tabelas para atualizar os gráficos
    dashboardSubscription = _supabase
        .channel('dashboard-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, () => agendarAtualizacao())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'frases' }, () => agendarAtualizacao())
        // Usuários: Escuta INSERT/DELETE. Ignora UPDATE para não atualizar a cada "heartbeat" (10s)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'usuarios' }, () => agendarAtualizacao())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'usuarios' }, () => agendarAtualizacao())
        .subscribe();
}

// Evita recarregamentos excessivos (Debounce)
function agendarAtualizacao() {
    clearTimeout(dashboardDebounceTimer);
    dashboardDebounceTimer = setTimeout(() => {
        // console.log("Atualizando Dashboard em Tempo Real...");
        carregarDashboard();
        
        // Se houver algum modal aberto, atualiza o conteúdo dele também
        const modal = document.getElementById('modal-dashboard-detail');
        if (modal && !modal.classList.contains('hidden')) {
            // Descobre qual tipo estava aberto pelo título
            const titulo = document.getElementById('modal-dash-title').innerText;
            if(titulo.includes('Ranking')) abrirModalDashboard('RANKING');
            else if(titulo.includes('Top')) abrirModalDashboard('TOP');
            else if(titulo.includes('Inativos')) abrirModalDashboard('GHOSTS');
            else if(titulo.includes('Auditoria')) abrirModalDashboard('AUDIT');
        }
    }, 1000); // Aguarda 1 segundo de silêncio antes de atualizar
}

// --- VISUALIZAÇÃO (MODAIS) ---
function abrirModalDashboard(tipo) {
    const modal = document.getElementById('modal-dashboard-detail'); 
    modal.classList.remove('hidden'); 
    const c = document.getElementById('modal-dash-content');
    const title = document.getElementById('modal-dash-title');

    if(tipo === 'RANKING') {
        title.innerHTML = '<i class="fas fa-trophy text-blue-500"></i> Ranking (90 dias)';
        c.innerHTML = `
            <table class="w-full text-sm text-left">
                <thead class="bg-gray-50 font-bold text-gray-500 border-b">
                    <tr><th class="p-4">Colaborador</th><th class="p-4 text-right">Cópias</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${dashboardData.statsU.map((u, i) => `
                        <tr class="hover:bg-gray-50 transition">
                            <td class="p-4">
                                <div class="font-bold text-gray-700 flex items-center gap-2">
                                    <span class="w-6 text-gray-400 font-normal text-xs">#${i+1}</span> 
                                    ${u.nome}
                                    ${i === 0 ? '<i class="fas fa-crown text-yellow-400"></i>' : ''}
                                </div>
                                ${u.nome !== u.username ? `<div class="text-[10px] text-gray-400 pl-8">ID: ${u.username}</div>` : ''}
                            </td>
                            <td class="p-4 text-right">
                                <span class="bg-blue-100 text-blue-700 py-1 px-3 rounded-full font-bold text-xs">${u.copias}</span>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    if(tipo === 'TOP') {
        title.innerHTML = '<i class="fas fa-fire text-orange-500"></i> Top Frases (90 dias)';
        const top10 = dashboardData.statsF.slice(0, 20); // Mostra Top 20 no modal
        c.innerHTML = `
            <ul class="divide-y divide-gray-100">
                ${top10.length ? top10.map((f, i) => `
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
                    </li>`).join('') : '<div class="p-8 text-center text-gray-400">Nenhum uso registrado neste período.</div>'}
            </ul>`;
    }

    if(tipo === 'GHOSTS') {
        title.innerHTML = '<i class="fas fa-ghost text-gray-400"></i> Inativos (>90 dias off)';
        const listaInativos = dashboardData.ghosts;
        
        c.innerHTML = listaInativos.length ? 
            `<div class="p-4">
                <p class="text-xs text-gray-500 mb-4 bg-yellow-50 p-3 rounded border border-yellow-100">
                    <i class="fas fa-info-circle mr-1"></i> Usuários que não acessaram o sistema nos últimos 3 meses.
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${listaInativos.map(u => {
                        const lastSeen = u.ultimo_visto ? new Date(u.ultimo_visto).toLocaleDateString('pt-BR') : 'Nunca';
                        return `
                        <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center flex flex-col items-center hover:bg-gray-100 transition">
                            <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 mb-2"><i class="fas fa-user-slash"></i></div>
                            <span class="font-bold text-gray-600 text-sm">${u.nome || u.username}</span>
                            <span class="text-[10px] text-gray-400">ID: ${u.username}</span>
                            <span class="text-[10px] text-red-400 mt-1 font-bold">Visto: ${lastSeen}</span>
                        </div>`;
                    }).join('')}
                </div>
             </div>` : 
            '<div class="p-10 text-center text-green-500 font-bold"><i class="fas fa-check-circle text-4xl mb-2 block"></i>Todos ativos! A equipe está voando.</div>';
    }

    if(tipo === 'AUDIT') {
        title.innerHTML = '<i class="fas fa-broom text-red-500"></i> Auditoria de Frases';
        // Regra de Auditoria: Menos de 5 usos E criada há mais de 90 dias
        const l = dashboardData.statsF.filter(f => f.usos < 5 && (new Date() - new Date(f.created_at || 0)) / 86400000 > 90);
        c.innerHTML = l.length ? l.map(f => `
            <div class="p-4 border-b flex justify-between items-center hover:bg-red-50 transition">
                <div>
                    <div class="font-bold text-gray-700">${f.empresa} - ${f.motivo}</div>
                    <div class="text-xs text-red-500 font-bold mt-1"><i class="fas fa-exclamation-triangle mr-1"></i> Baixo uso (${f.usos}) • Antiga</div>
                </div>
                <button onclick="deletarFraseDashboard(${f.id}, '${f.empresa}', ${f.usos})" class="bg-white text-red-500 font-bold text-xs border border-red-200 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition shadow-sm">Excluir</button>
            </div>`).join('') : '<div class="p-10 text-center text-gray-400 font-bold"><i class="fas fa-check-circle text-4xl mb-2 text-green-500 block"></i>Tudo limpo! Nenhuma frase obsoleta.</div>';
    }
}

async function deletarFraseDashboard(id, autor, usos) { 
    if((await Swal.fire({
        title:'Confirmar Exclusão?', 
        html:`Esta frase tem apenas <b>${usos} usos</b>.<br>Deseja realmente removê-la?`, 
        icon: 'warning',
        showCancelButton:true, 
        confirmButtonColor:'#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    })).isConfirmed) { 
        await _supabase.from('frases').delete().eq('id', id); 
        await _supabase.from('logs').insert([{usuario: usuarioLogado.username, acao: 'LIMPEZA', detalhe: `Removeu frase #${id}`}]);
        // Atualiza tudo
        if(typeof carregarFrases === 'function') carregarFrases(); 
        agendarAtualizacao();
        Swal.fire('Removido', 'A frase foi excluída com sucesso.', 'success');
    } 
}

// Função auxiliar para animar números (Efeito visual legal)
function animateValue(id, start, end, duration) {
    if (start === end) return;
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}
