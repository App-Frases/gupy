// Local: js/dashboard.js

let dashboardSubscription = null;
let debounceDashboard = null;

async function carregarDashboard() {
    try {
        const loadingHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs animate-pulse">Carregando dados...</td></tr>';
        document.getElementById('lista-top-frases').innerHTML = loadingHTML;
        document.getElementById('lista-frases-sem-uso').innerHTML = loadingHTML;
        
        // Data de corte: 90 dias
        const date90d = new Date();
        date90d.setDate(date90d.getDate() - 90);

        // 1. Busca Dados
        // Frases (todas)
        const { data: todasFrases, error: errF } = await _supabase.from('frases').select('*');
        // Usuários (todos)
        const { data: todosUsuarios, error: errU } = await _supabase.from('usuarios').select('username, nome');
        // Logs (apenas 'COPIAR' dos últimos 90 dias para contagem de uso)
        const { data: logsUso, error: errL } = await _supabase
            .from('logs')
            .select('usuario, detalhe, data_hora')
            .eq('acao', 'COPIAR')
            .gte('data_hora', date90d.toISOString());

        if (errF || errU || errL) throw new Error("Erro ao buscar dados do dashboard");

        // 2. Processamento
        const stats = processarEstatisticas(todasFrases, todosUsuarios, logsUso);

        // 3. Renderização
        renderizarKPIs(stats);
        renderizarTopFrases(stats.topFrases);
        renderizarRankingsUsuarios(stats.rankingUsuarios);
        renderizarFrasesSemUso(stats.frasesSemUso);

        // 4. Realtime (para atualizar se alguém copiar algo agora)
        iniciarDashboardRealtime();

    } catch (e) {
        console.error("Erro Dashboard:", e);
        Swal.fire('Erro', 'Não foi possível carregar o dashboard.', 'error');
    }
}

function processarEstatisticas(frases, usuarios, logs) {
    // Mapa de Usuários (username -> nome bonito)
    const userMap = {};
    usuarios.forEach(u => userMap[u.username] = u.nome || formatarNome(u.username));

    // Contadores
    const usoPorFrase = {}; // ID -> Qtd
    const usoPorUsuario = {}; // Username -> Qtd

    // Inicializa todos os usuários com 0 para aparecerem no "Menos Usam"
    usuarios.forEach(u => usoPorUsuario[u.username] = 0);

    // Processa Logs
    logs.forEach(log => {
        // Contagem Frases
        const idFrase = String(log.detalhe).replace(/\D/g, ''); // Limpa ID
        if (idFrase) usoPorFrase[idFrase] = (usoPorFrase[idFrase] || 0) + 1;

        // Contagem Usuários (se o usuário ainda existir no banco)
        if (usoPorUsuario.hasOwnProperty(log.usuario)) {
            usoPorUsuario[log.usuario]++;
        }
    });

    // --- A. Top 10 Frases ---
    // Mapeia frases com seus contadores
    const frasesComUso = frases.map(f => ({
        ...f,
        usos: usoPorFrase[f.id] || 0
    }));
    // Ordena decrescente
    frasesComUso.sort((a, b) => b.usos - a.usos);
    const top10 = frasesComUso.slice(0, 10);

    // --- B. Frases Sem Uso (90d) ---
    const semUso = frasesComUso.filter(f => f.usos === 0);

    // --- C. Ranking Usuários ---
    const arrayUsuarios = Object.entries(usoPorUsuario).map(([user, qtd]) => ({
        username: user,
        nome: userMap[user],
        qtd: qtd
    }));
    
    // Mais ativos (decrescente)
    arrayUsuarios.sort((a, b) => b.qtd - a.qtd);
    const top5Mais = arrayUsuarios.slice(0, 5);

    // Menos ativos (crescente) - Inverte a lógica, quem tem 0 vem primeiro
    const top5Menos = [...arrayUsuarios].sort((a, b) => a.qtd - b.qtd).slice(0, 5);

    return {
        topFrases: top10,
        frasesSemUso: semUso,
        rankingUsuarios: { mais: top5Mais, menos: top5Menos },
        totalUsos: logs.length,
        totalFrases: frases.length
    };
}

// --- RENDERIZADORES ---

function renderizarKPIs(stats) {
    document.getElementById('kpi-total-usos').innerText = stats.totalUsos;
    document.getElementById('kpi-frases-ativas').innerText = stats.totalFrases;
    document.getElementById('contador-sem-uso').innerText = `${stats.frasesSemUso.length} frases`;
}

function renderizarTopFrases(lista) {
    const tbody = document.getElementById('lista-top-frases');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Nenhuma frase usada no período.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((f, i) => `
        <tr class="hover:bg-blue-50/50 transition">
            <td class="px-5 py-3">
                <span class="font-black text-slate-300 text-lg italic">#${i + 1}</span>
            </td>
            <td class="px-5 py-3">
                <div class="font-bold text-slate-700">${f.empresa || 'Geral'}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">${f.motivo || '-'}</div>
            </td>
            <td class="px-5 py-3">
                <div class="text-xs text-slate-500 truncate max-w-[200px]" title="${f.conteudo}">${f.conteudo}</div>
            </td>
            <td class="px-5 py-3 text-right">
                <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">${f.usos}</span>
            </td>
        </tr>
    `).join('');
}

function renderizarRankingsUsuarios(rankings) {
    // Renderiza Mais Ativos
    const elMais = document.getElementById('lista-top-users');
    elMais.innerHTML = rankings.mais.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-green-50/30">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 font-bold text-slate-300 text-xs">#${i + 1}</div>
                        <div>
                            <p class="font-bold text-slate-700 text-xs">${u.nome}</p>
                            <p class="text-[10px] text-slate-400">@${u.username}</p>
                        </div>
                    </div>
                    <span class="font-bold text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full">${u.qtd} usos</span>
                </div>
            </td>
        </tr>
    `).join('');

    // Renderiza Menos Ativos
    const elMenos = document.getElementById('lista-bottom-users');
    elMenos.innerHTML = rankings.menos.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-red-50/30">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 font-bold text-slate-300 text-xs">#${i + 1}</div>
                        <div>
                            <p class="font-bold text-slate-700 text-xs">${u.nome}</p>
                            <p class="text-[10px] text-slate-400">@${u.username}</p>
                        </div>
                    </div>
                    <span class="font-bold text-red-500 text-xs bg-red-50 px-2 py-0.5 rounded-full">${u.qtd} usos</span>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderizarFrasesSemUso(lista) {
    const tbody = document.getElementById('lista-frases-sem-uso');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-green-500 font-bold text-xs"><i class="fas fa-check-circle mr-1"></i> Ótimo! Todas as frases foram usadas recentemente.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(f => {
        // Prepara objeto seguro para passar na função editar
        const fraseSafe = JSON.stringify(f).replace(/'/g, "&#39;");
        const criador = f.revisado_por ? formatarNome(f.revisado_por) : 'Desconhecido';

        return `
        <tr class="hover:bg-orange-50/30 transition group">
            <td class="px-5 py-3 font-mono text-xs text-slate-400">#${f.id}</td>
            <td class="px-5 py-3">
                <div class="font-bold text-slate-700 text-xs">${f.motivo || 'Sem Motivo'}</div>
                <div class="text-[10px] text-slate-400">${f.empresa}</div>
            </td>
            <td class="px-5 py-3">
                <div class="flex items-center gap-1.5">
                    <div class="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                        ${criador.charAt(0)}
                    </div>
                    <span class="text-xs text-slate-600 font-bold">${criador}</span>
                </div>
            </td>
            <td class="px-5 py-3 text-right">
                <button onclick='abrirModalEditarDashboard(${fraseSafe})' class="text-blue-500 hover:text-blue-700 bg-white border border-blue-100 hover:bg-blue-50 p-1.5 rounded-lg transition mr-1" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button onclick="deletarFraseDashboard(${f.id})" class="text-red-400 hover:text-red-600 bg-white border border-red-100 hover:bg-red-50 p-1.5 rounded-lg transition" title="Excluir">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// --- AÇÕES DO DASHBOARD (EDITAR / EXCLUIR) ---

async function deletarFraseDashboard(id) {
    const result = await Swal.fire({
        title: 'Excluir frase?',
        text: "Essa frase não é usada há mais de 90 dias.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from('frases').delete().eq('id', id);
            if (error) throw error;
            
            registrarLog('EXCLUIR', `Painel: Apagou frase #${id}`);
            Swal.fire('Excluído!', '', 'success');
            
            // Recarrega o dashboard
            carregarDashboard();
        } catch (e) {
            Swal.fire('Erro', 'Falha ao excluir.', 'error');
        }
    }
}

// Abre o modal existente (do index.html) mas configura para salvar e atualizar o dashboard
function abrirModalEditarDashboard(f) {
    // Usa as funções globais do index.html/biblioteca.js para preencher o modal
    document.getElementById('id-frase').value = f.id;
    document.getElementById('inp-empresa').value = f.empresa;
    document.getElementById('inp-motivo').value = f.motivo;
    document.getElementById('inp-doc').value = f.documento;
    document.getElementById('inp-conteudo').value = f.conteudo;
    document.getElementById('modal-title').innerHTML = `Editar #${f.id}`;
    
    // TRUQUE: Sobrescreve temporariamente a função salvarFrase para recarregar o dashboard
    const btnSalvar = document.querySelector('#modal-frase button[onclick="salvarFrase()"]');
    
    // Remove listeners antigos (clone)
    const novoBtn = btnSalvar.cloneNode(true);
    btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
    
    novoBtn.onclick = async function() {
        await salvarFraseLogica(); // Chama a lógica de salvar
        carregarDashboard();      // Atualiza dashboard
    };

    document.getElementById('modal-frase').classList.remove('hidden');
}

// Reutiliza a lógica de salvar (copiada de biblioteca.js para garantir acesso aqui)
async function salvarFraseLogica() {
    const id = document.getElementById('id-frase').value; 
    const rawConteudo = document.getElementById('inp-conteudo').value;
    let conteudoLimpo = rawConteudo.trim();
    if(conteudoLimpo) conteudoLimpo = conteudoLimpo.charAt(0).toUpperCase() + conteudoLimpo.slice(1);
    
    if(!conteudoLimpo) return Swal.fire('Erro', 'Conteúdo obrigatório', 'warning'); 

    const dados = { 
        empresa: formatarTextoBonito(document.getElementById('inp-empresa').value, 'titulo'), 
        motivo: formatarTextoBonito(document.getElementById('inp-motivo').value, 'titulo'), 
        documento: formatarTextoBonito(document.getElementById('inp-doc').value, 'titulo'), 
        conteudo: conteudoLimpo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    try { 
        await _supabase.from('frases').update(dados).eq('id', id); 
        registrarLog('EDITAR', `Painel: Editou frase #${id}`); 
        document.getElementById('modal-frase').classList.add('hidden');
        Swal.fire('Salvo!', '', 'success'); 
    } catch(e) { Swal.fire('Erro', 'Falha ao salvar', 'error'); } 
}

// --- UTILS ---

function formatarNome(user) {
    if(!user) return 'Desconhecido';
    return user.charAt(0).toUpperCase() + user.slice(1);
}

function iniciarDashboardRealtime() {
    if (dashboardSubscription) return;
    // Escuta logs (para atualizar contagens de uso) e frases (se alguém excluir na biblioteca)
    dashboardSubscription = _supabase
        .channel('dashboard-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
            clearTimeout(debounceDashboard); debounceDashboard = setTimeout(carregarDashboard, 2000);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'frases' }, () => {
            clearTimeout(debounceDashboard); debounceDashboard = setTimeout(carregarDashboard, 2000);
        })
        .subscribe();
}
