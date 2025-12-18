let dashboardData = {};

function fecharModalDashboard() { document.getElementById('modal-dashboard-detail').classList.add('hidden'); }

async function carregarDashboard() {
    const {data:logs} = await _supabase.from('logs').select('*');
    const {data:users} = await _supabase.from('usuarios').select('*');
    const {data:phrases} = await _supabase.from('frases').select('*');
    
    if(!logs || !users || !phrases) return;

    // Mapa para traduzir ID em Nome facilmente
    const userMap = {};
    users.forEach(u => userMap[u.username] = u.nome || u.username);

    const noventaDiasAtras = new Date(Date.now() - 7776000000);
    const recent = logs.filter(l => new Date(l.data_hora) > noventaDiasAtras);
    
    const usuariosAtivosSet = new Set(recent.map(l => l.usuario));
    const qtdUsuariosAtivos = usuariosAtivosSet.size;

    document.getElementById('kpi-users').innerText = qtdUsuariosAtivos;
    document.getElementById('kpi-copies').innerText = recent.filter(l => l.acao === 'COPIAR_RANK').length;
    document.getElementById('kpi-edits').innerText = recent.filter(l => ['CRIAR', 'EDITAR'].includes(l.acao)).length;

    const usage = {}; 
    recent.filter(l => l.acao === 'COPIAR_RANK').forEach(l => {
        usage[l.detalhe] = (usage[l.detalhe] || 0) + 1;
    });

    const statsF = phrases.map(f => ({ ...f, usos: usage[f.id] || 0 })).sort((a, b) => b.usos - a.usos);

    const statsU = users.map(u => ({
        username: u.username,
        nome: u.nome || u.username, // Já salva o nome aqui
        copias: recent.filter(l => l.usuario === u.username && l.acao === 'COPIAR_RANK').length
    })).sort((a, b) => b.copias - a.copias);

    // GHOSTS agora considera também se o usuário está 'ativo' no cadastro
    // Mas a lista é de quem NÃO LOGOU recentemente
    const ghosts = users.filter(u => {
        if (!u.ultimo_visto) return true; 
        return new Date(u.ultimo_visto) < noventaDiasAtras; 
    });

    dashboardData = { statsF, statsU, ghosts };
}

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
                    <tr><th class="p-4">Colaborador</th><th class="p-4 text-right">Cópias Realizadas</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${dashboardData.statsU.map((u, i) => `
                        <tr class="hover:bg-gray-50">
                            <td class="p-4">
                                <div class="font-bold text-gray-700"><span class="inline-block w-6 text-gray-400 font-normal">#${i+1}</span> ${u.nome}</div>
                                ${u.nome !== u.username ? `<div class="text-[10px] text-gray-400 pl-7">ID: ${u.username}</div>` : ''}
                            </td>
                            <td class="p-4 text-right">
                                <span class="bg-blue-100 text-blue-700 py-1 px-3 rounded-full font-bold text-xs">${u.copias}</span>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    if(tipo === 'TOP') {
        title.innerHTML = '<i class="fas fa-fire text-orange-500"></i> Top 10 Frases (90 dias)';
        const top10 = dashboardData.statsF.slice(0, 10);
        c.innerHTML = `
            <ul class="divide-y divide-gray-100">
                ${top10.length ? top10.map((f, i) => `
                    <li class="p-4 hover:bg-gray-50 flex justify-between items-center">
                        <div>
                            <div class="font-bold text-blue-600 mb-0.5">#${i+1} ${f.empresa}</div>
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
        title.innerHTML = '<i class="fas fa-ghost text-gray-400"></i> Inativos (>90 dias sem login)';
        const listaInativos = dashboardData.ghosts;
        
        c.innerHTML = listaInativos.length ? 
            `<div class="p-4">
                <p class="text-xs text-gray-500 mb-4 bg-yellow-50 p-3 rounded border border-yellow-100">
                    <i class="fas fa-info-circle mr-1"></i> Lista de quem não logou recentemente.
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${listaInativos.map(u => {
                        const lastSeen = u.ultimo_visto ? new Date(u.ultimo_visto).toLocaleDateString() : 'Nunca';
                        return `
                        <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center flex flex-col items-center">
                            <span class="font-bold text-gray-600">${u.nome || u.username}</span>
                            <span class="text-[10px] text-gray-400">ID: ${u.username}</span>
                            <span class="text-[10px] text-red-400 mt-1">Visto: ${lastSeen}</span>
                        </div>`;
                    }).join('')}
                </div>
             </div>` : 
            '<div class="p-10 text-center text-green-500 font-bold"><i class="fas fa-check-circle text-4xl mb-2 block"></i>Todos realizaram login recentemente!</div>';
    }

    if(tipo === 'AUDIT') {
        title.innerHTML = '<i class="fas fa-broom text-red-500"></i> Auditoria de Frases';
        const l = dashboardData.statsF.filter(f => f.usos < 5 && (new Date() - new Date(f.created_at || 0)) / 86400000 > 90);
        c.innerHTML = l.length ? l.map(f => `
            <div class="p-4 border-b flex justify-between items-center hover:bg-red-50 transition">
                <div>
                    <div class="font-bold text-gray-700">${f.empresa} - ${f.motivo}</div>
                    <div class="text-xs text-red-500 font-bold mt-1"><i class="fas fa-exclamation-triangle mr-1"></i> Baixo uso (${f.usos}) • Antiga</div>
                </div>
                <button onclick="deletarFraseDashboard(${f.id}, '${f.empresa}', ${f.usos})" class="bg-white text-red-500 font-bold text-xs border border-red-200 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition shadow-sm">Excluir</button>
            </div>`).join('') : '<div class="p-10 text-center text-gray-400 font-bold">Tudo limpo! Nenhuma frase obsoleta encontrada.</div>';
    }
}

async function deletarFraseDashboard(id, autor, usos) { 
    if((await Swal.fire({
        title:'Confirmar Exclusão?', 
        html:`Esta frase tem <b>${usos} usos</b>.<br>Deseja realmente removê-la?`, 
        icon: 'warning',
        showCancelButton:true, 
        confirmButtonColor:'#ef4444',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    })).isConfirmed) { 
        await _supabase.from('frases').delete().eq('id', id); 
        await _supabase.from('logs').insert([{usuario: usuarioLogado.username, acao: 'LIMPEZA', detalhe: `Removeu frase #${id}`}]);
        if(typeof carregarFrases === 'function') carregarFrases(); 
        carregarDashboard().then(() => { abrirModalDashboard('AUDIT'); Swal.fire('Removido', 'A frase foi excluída com sucesso.', 'success'); });
    } 
}
