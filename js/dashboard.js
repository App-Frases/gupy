// Local: js/dashboard.js

let dashboardSubscription = null;
let debounceDashboard = null;

async function carregarDashboard() {
    try {
        const loadingHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs animate-pulse">Carregando dados completos...</td></tr>';
        document.getElementById('lista-top-frases').innerHTML = loadingHTML;
        document.getElementById('lista-frases-sem-uso').innerHTML = loadingHTML;
        document.getElementById('lista-top-users').innerHTML = loadingHTML;
        
        // 1. Busca TODOS os dados (Sem filtro de data para pegar histórico antigo)
        const { data: todasFrases, error: errF } = await _supabase
            .from('frases')
            .select('*');

        const { data: todosUsuarios, error: errU } = await _supabase
            .from('usuarios')
            .select('username, nome');

        // Busca logs de CÓPIA (Ação principal) - Traz tudo para calcular ranking real
        const { data: logsUso, error: errL } = await _supabase
            .from('logs')
            .select('usuario, detalhe, data_hora')
            .eq('acao', 'COPIAR');

        if (errF || errU || errL) throw new Error("Erro ao buscar dados do dashboard");

        // 2. Processamento Inteligente
        const stats = processarEstatisticas(todasFrases, todosUsuarios, logsUso);

        // 3. Renderização
        renderizarKPIs(stats);
        renderizarTopFrases(stats.topFrases);
        renderizarRankingsUsuarios(stats.rankingUsuarios);
        renderizarFrasesSemUso(stats.frasesSemUso);

        // 4. Realtime (para manter atualizado)
        iniciarDashboardRealtime();

    } catch (e) {
        console.error("Erro Dashboard:", e);
        // Tenta limpar a tela em caso de erro crítico
        const erroHTML = '<tr><td colspan="4" class="p-4 text-center text-red-400 text-xs">Erro ao carregar. Verifique a conexão.</td></tr>';
        document.getElementById('lista-top-frases').innerHTML = erroHTML;
    }
}

function processarEstatisticas(frases, usuarios, logs) {
    // Datas para cálculo de inatividade
    const agora = new Date();
    const dataCorte90d = new Date();
    dataCorte90d.setDate(agora.getDate() - 90);

    // Mapa de Usuários (username -> nome formatado)
    const userMap = {};
    usuarios.forEach(u => userMap[u.username] = u.nome || formatarNome(u.username));

    // Contadores Gerais (Histórico Completo)
    const usoPorFraseTotal = {}; // ID -> Qtd Total
    const usoPorUsuarioTotal = {}; // Username -> Qtd Total

    // Rastreador de Atividade Recente (Últimos 90 dias)
    const frasesUsadasRecentemente = new Set(); 

    // Inicializa usuários com 0
    usuarios.forEach(u => usoPorUsuarioTotal[u.username] = 0);

    // Processa TODOS os logs
    logs.forEach(log => {
        const idFrase = String(log.detalhe).replace(/\D/g, '');
        const dataLog = new Date(log.data_hora);

        // 1. Contabiliza Uso Geral (Ranking Top 10)
        if (idFrase) {
            usoPorFraseTotal[idFrase] = (usoPorFraseTotal[idFrase] || 0) + 1;
            
            // 2. Verifica se foi usada nos últimos 90 dias
            if (dataLog >= dataCorte90d) {
                frasesUsadasRecentemente.add(idFrase);
            }
        }

        // 3. Contabiliza Uso por Usuário (Ranking Usuários)
        // Conta apenas se o usuário ainda existe na lista de usuários ativos
        if (usoPorUsuarioTotal.hasOwnProperty(log.usuario)) {
            usoPorUsuarioTotal[log.usuario]++;
        }
    });

    // --- A. Top 10 Frases (Baseado em TODO o histórico) ---
    const frasesRankeadas = frases.map(f => ({
        ...f,
        usos: usoPorFraseTotal[f.id] || 0
    }));
    // Ordena por mais usadas
    frasesRankeadas.sort((a, b) => b.usos - a.usos);
    const top10 = frasesRankeadas.slice(0, 10);

    // --- B. Frases Sem Uso (Baseado APENAS nos últimos 90 dias) ---
    // Uma frase pode ter 1000 usos no passado, mas se não está no Set 'frasesUsadasRecentemente', entra aqui.
    const semUsoRecente = frases.filter(f => !frasesUsadasRecentemente.has(String(f.id)));
    // Ordena as sem uso: as que foram criadas há mais tempo aparecem primeiro? 
    // Ou ordenamos por ID para facilitar
    semUsoRecente.sort((a, b) => a.id - b.id);

    // --- C. Ranking Usuários (Baseado em TODO o histórico) ---
    const rankingUsers = Object.entries(usoPorUsuarioTotal).map(([user, qtd]) => ({
        username: user,
        nome: userMap[user],
        qtd: qtd
    }));
    
    // Mais ativos
    rankingUsers.sort((a, b) => b.qtd - a.qtd);
    const top5Mais = rankingUsers.slice(0, 5);

    // Menos ativos (Quem tem menos uso vem primeiro)
    const top5Menos = [...rankingUsers].sort((a, b) => a.qtd - b.qtd).slice(0, 5);

    return {
        topFrases: top10,
        frasesSemUso: semUsoRecente,
        rankingUsuarios: { mais: top5Mais, menos: top5Menos },
        totalUsos: logs.length,
        totalFrases: frases.length
    };
}

// --- RENDERIZADORES ---

function renderizarKPIs(stats) {
    // Animação simples de números
    animarNumero('kpi-total-usos', stats.totalUsos);
    animarNumero('kpi-frases-ativas', stats.totalFrases);
    
    const elContador = document.getElementById('contador-sem-uso');
    elContador.innerText = `${stats.frasesSemUso.length} frases`;
    
    // Muda cor se houver muitas frases sem uso
    if(stats.frasesSemUso.length > 0) {
        elContador.className = "bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold";
    } else {
        elContador.className = "bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold";
    }
}

function renderizarTopFrases(lista) {
    const tbody = document.getElementById('lista-top-frases');
    if (lista.length === 0 || lista[0].usos === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">Nenhum dado de uso encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((f, i) => {
        // Ícones de medalha para top 3
        let posIcon = `#${i + 1}`;
        let rowClass = "hover:bg-blue-50/50 transition border-b border-slate-50 last:border-0";
        
        if (i === 0) { posIcon = '<i class="fas fa-crown text-yellow-500"></i>'; rowClass += " bg-yellow-50/30"; }
        if (i === 1) posIcon = '<i class="fas fa-medal text-slate-400"></i>';
        if (i === 2) posIcon = '<i class="fas fa-medal text-orange-400"></i>';

        return `
        <tr class="${rowClass}">
            <td class="px-5 py-3 text-center w-16">
                <span class="font-black text-slate-400 text-sm">${posIcon}</span>
            </td>
            <td class="px-5 py-3">
                <div class="font-bold text-slate-700 text-xs">${f.empresa || 'Geral'}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">${f.motivo || '-'}</div>
            </td>
            <td class="px-5 py-3">
                <div class="text-xs text-slate-500 truncate max-w-[200px]" title="${f.conteudo}">${f.conteudo}</div>
            </td>
            <td class="px-5 py-3 text-right">
                <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold shadow-sm">${f.usos}</span>
            </td>
        </tr>
    `}).join('');
}

function renderizarRankingsUsuarios(rankings) {
    // Renderiza Mais Ativos
    const elMais = document.getElementById('lista-top-users');
    elMais.innerHTML = rankings.mais.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-green-50/30 transition">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 font-bold text-slate-300 text-xs">#${i + 1}</div>
                        <div>
                            <p class="font-bold text-slate-700 text-xs">${u.nome}</p>
                            <p class="text-[10px] text-slate-400">@${u.username}</p>
                        </div>
                    </div>
                    <span class="font-bold text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full">${u.qtd}</span>
                </div>
            </td>
        </tr>
    `).join('');

    // Renderiza Menos Ativos
    const elMenos = document.getElementById('lista-bottom-users');
    elMenos.innerHTML = rankings.menos.map((u, i) => `
        <tr class="border-b border-slate-50 last:border-0 hover:bg-red-50/30 transition">
            <td class="px-5 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-6 font-bold text-slate-300 text-xs text-red-200">#${i + 1}</div>
                        <div>
                            <p class="font-bold text-slate-700 text-xs">${u.nome}</p>
                            <p class="text-[10px] text-slate-400">@${u.username}</p>
                        </div>
                    </div>
                    <span class="font-bold ${u.qtd === 0 ? 'text-red-500 bg-red-100' : 'text-slate-500 bg-slate-100'} text-xs px-2 py-0.5 rounded-full">${u.qtd}</span>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderizarFrasesSemUso(lista) {
    const tbody = document.getElementById('lista-frases-sem-uso');
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-green-600 font-bold text-sm bg-green-50/30 rounded-xl"><i class="fas fa-check-circle text-2xl mb-2 block"></i>Tudo limpo! Todas as frases foram usadas nos últimos 90 dias.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(f => {
        const fraseSafe = JSON.stringify(f).replace(/'/g, "&#39;");
        // Tenta pegar o nome de quem revisou ou deixa vazio se não tiver
        const criador = f.revisado_por ? formatarNome(f.revisado_por) : '<span class="text-slate-300 italic">--</span>';

        return `
        <tr class="hover:bg-orange-50/30 transition group border-b border-slate-50 last:border-0">
            <td class="px-5 py-3 font-mono text-[10px] text-slate-400">#${f.id}</td>
            <td class="px-5 py-3">
                <div class="font-bold text-slate-700 text-xs">${f.motivo || 'Sem Motivo'}</div>
                <div class="text-[10px] text-slate-400">${f.empresa || 'Geral'}</div>
            </td>
            <td class="px-5 py-3">
                <div class="flex items-center gap-1.5">
                    <span class="text-xs text-slate-600 font-bold">${criador}</span>
                </div>
            </td>
            <td class="px-5 py-3 text-right">
                <div class="flex justify-end gap-1">
                    <button onclick='abrirModalEditarDashboard(${fraseSafe})' class="text-blue-500 hover:text-white hover:bg-blue-500 border border-blue-100 p-1.5 rounded transition" title="Editar e Salvar (Reativa)">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="deletarFraseDashboard(${f.id})" class="text-red-400 hover:text-white hover:bg-red-500 border border-red-100 p-1.5 rounded transition" title="Excluir Definitivamente">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

// --- AÇÕES DO DASHBOARD ---

async function deletarFraseDashboard(id) {
    const result = await Swal.fire({
        title: 'Excluir frase?',
        html: `Esta frase não é usada há <b>90+ dias</b>.<br>Deseja realmente removê-la?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from('frases').delete().eq('id', id);
            if (error) throw error;
            
            registrarLog('LIMPEZA', `Painel: Excluiu frase inativa #${id}`);
            
            // Feedback sutil
            const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 2000});
            Toast.fire({icon: 'success', title: 'Frase removida'});
            
            carregarDashboard(); // Recarrega dados
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    }
}

function abrirModalEditarDashboard(f) {
    // Reutiliza o modal global do index.html
    document.getElementById('id-frase').value = f.id;
    document.getElementById('inp-empresa').value = f.empresa;
    document.getElementById('inp-motivo').value = f.motivo;
    document.getElementById('inp-doc').value = f.documento;
    document.getElementById('inp-conteudo').value = f.conteudo;
    document.getElementById('modal-title').innerHTML = `Revisar Frase #${f.id}`;
    
    // Substitui o botão de salvar para ter comportamento de dashboard
    const btnSalvar = document.querySelector('#modal-frase button[onclick="salvarFrase()"]');
    const novoBtn = btnSalvar.cloneNode(true);
    
    // Ação: Salva e recarrega o dashboard
    novoBtn.onclick = async function() {
        // Validação rápida
        const conteudo = document.getElementById('inp-conteudo').value.trim();
        if(!conteudo) return Swal.fire('Erro', 'Conteúdo vazio', 'warning');
        
        await salvarFraseLogica(); // Salva no banco
        
        // Fecha modal e recarrega painel
        document.getElementById('modal-frase').classList.add('hidden');
        carregarDashboard();
        
        // Restaura botão original para a biblioteca não quebrar
        novoBtn.parentNode.replaceChild(btnSalvar, novoBtn);
    };

    btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
    document.getElementById('modal-frase').classList.remove('hidden');
}

// Lógica de salvamento isolada para reuso
async function salvarFraseLogica() {
    const id = document.getElementById('id-frase').value; 
    let conteudo = document.getElementById('inp-conteudo').value.trim();
    if(conteudo) conteudo = conteudo.charAt(0).toUpperCase() + conteudo.slice(1);
    
    const dados = { 
        empresa: formatarTextoBonito(document.getElementById('inp-empresa').value, 'titulo'), 
        motivo: formatarTextoBonito(document.getElementById('inp-motivo').value, 'titulo'), 
        documento: formatarTextoBonito(document.getElementById('inp-doc').value, 'titulo'), 
        conteudo: conteudo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    try { 
        await _supabase.from('frases').update(dados).eq('id', id); 
        registrarLog('EDITAR', `Painel: Revisou frase #${id}`); 
        Swal.fire({icon: 'success', title: 'Salvo!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000});
    } catch(e) { console.error(e); } 
}

// --- UTILS ---

function animarNumero(id, final) {
    const el = document.getElementById(id);
    if(!el) return;
    const atual = parseInt(el.innerText) || 0;
    if(atual === final) return;
    
    // Animação simples se a diferença for pequena, ou seta direto
    if(Math.abs(final - atual) < 5) {
        el.innerText = final;
    } else {
        // Efeito de contagem rápida
        let start = atual;
        const duration = 500;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing easeOutQuart
            const ease = 1 - Math.pow(1 - progress, 4);
            
            el.innerText = Math.floor(start + (final - start) * ease);
            
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
}

function formatarNome(user) {
    if(!user) return 'User';
    return user.charAt(0).toUpperCase() + user.slice(1);
}

function formatarTextoBonito(texto, tipo) {
    if(!texto) return '';
    if(tipo === 'titulo') return texto.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    return texto;
}

function iniciarDashboardRealtime() {
    if (dashboardSubscription) return;
    dashboardSubscription = _supabase
        .channel('dashboard-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
            clearTimeout(debounceDashboard); debounceDashboard = setTimeout(carregarDashboard, 2000);
        })
        .subscribe();
}
