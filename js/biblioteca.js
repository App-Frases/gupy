let cacheFrases = [];

async function carregarFrases() {
    const container = document.getElementById('grid-frases');
    if(container) container.innerHTML = '<div class="col-span-full text-center py-10">Sincronizando...</div>';

    const { data: frasesGlobais } = await _supabase.from('frases').select('*');
    const { data: meusStats } = await _supabase.from('view_usos_pessoais').select('*').eq('usuario', usuarioLogado.username);

    let meusUsosMap = {};
    if (meusStats) meusStats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);

    cacheFrases = (frasesGlobais || []).map(f => ({
        ...f,
        meus_usos: meusUsosMap[f.id] || 0,
        _busca: normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
    }));

    // Ordenação: Admin vê global, Colaborador vê pessoal
    if (usuarioLogado.perfil === 'admin') {
        cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
    } else {
        cacheFrases.sort((a, b) => (b.meus_usos - a.meus_usos) || ((b.usos || 0) - (a.usos || 0)));
    }
    renderizarBiblioteca(cacheFrases);
}

window.salvarFrase = async function() {
    const id = document.getElementById('id-frase').value;
    const dados = {
        empresa: formatarTextoBonito(document.getElementById('inp-empresa').value, 'titulo'),
        motivo: formatarTextoBonito(document.getElementById('inp-motivo').value, 'titulo'),
        documento: formatarTextoBonito(document.getElementById('inp-doc').value, 'titulo'),
        conteudo: document.getElementById('inp-conteudo').value.trim(),
        revisado_por: usuarioLogado.username
    };

    if (!dados.empresa || !dados.conteudo) return Swal.fire('Erro', 'Preencha os campos obrigatórios.', 'warning');

    try {
        if (id) {
            await _supabase.from('frases').update(dados).eq('id', id);
            await registrarLog('EDITAR', id);
        } else {
            const { data } = await _supabase.from('frases').insert([dados]).select();
            if (data) await registrarLog('CRIAR', data[0].id);
        }
        fecharModalFrase();
        carregarFrases();
        Swal.fire('Sucesso!', 'Dados salvos no banco.', 'success');
    } catch (e) {
        Swal.fire('Erro', 'Falha ao comunicar com o Supabase.', 'error');
    }
};

window.deletarFraseBiblioteca = async function(id) {
    const confirm = await Swal.fire({ title: 'Excluir?', text: 'Não há volta.', icon: 'warning', showCancelButton: true });
    if (confirm.isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        await registrarLog('EXCLUIR', id);
        carregarFrases();
    }
};

function renderizarBiblioteca(lista) {
    const grid = document.getElementById('grid-frases');
    if (!grid) return;
    grid.innerHTML = lista.map(f => {
        const adminMode = usuarioLogado.perfil === 'admin';
        return `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
            <div class="flex justify-between mb-3">
                <span class="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">${f.empresa}</span>
                <div class="flex gap-2">
                    <button onclick='editarFrase(${JSON.stringify(f)})' class="text-yellow-500"><i class="fas fa-pen"></i></button>
                    <button onclick="deletarFraseBiblioteca(${f.id})" class="text-red-500"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <p class="text-sm text-slate-700 mb-4 font-medium">${f.conteudo}</p>
            <div class="flex justify-between items-center border-t pt-3">
                <span class="text-[9px] font-bold text-slate-400 uppercase">
                    <i class="fas ${adminMode ? 'fa-chart-line' : 'fa-user-check'}"></i> 
                    ${adminMode ? f.usos + ' usos na empresa' : f.meus_usos + ' meus usos'}
                </span>
                <button onclick="copiarTexto(${f.id})" class="bg-blue-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold">Copiar</button>
            </div>
        </div>`;
    }).join('');
}
