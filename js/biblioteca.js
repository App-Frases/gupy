let cacheFrases = [];

async function carregarFrases() {
    try {
        const { data: frasesGlobais } = await _supabase.from('frases').select('*');
        const { data: meusStats } = await _supabase.from('view_usos_pessoais').select('*').eq('usuario', usuarioLogado.username);

        let meusUsosMap = {};
        if (meusStats) meusStats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);

        cacheFrases = (frasesGlobais || []).map(f => ({
            ...f,
            meus_usos: meusUsosMap[f.id] || 0,
            _busca: normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
        }));

        // Ordenação Admin vs Colaborador
        if (usuarioLogado.perfil === 'admin') {
            cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
        } else {
            cacheFrases.sort((a, b) => (b.meus_usos - a.meus_usos) || ((b.usos || 0) - (a.usos || 0)));
        }
        aplicarFiltros();
    } catch (e) { console.error(e); }
}

function renderizarBiblioteca(lista, isFiltrado = false) {
    const grid = document.getElementById('grid-frases');
    if (!grid) return;

    // Regra: se não estiver pesquisando nada, mostra apenas as 4 melhores
    const listaFinal = isFiltrado ? lista : lista.slice(0, 4);

    grid.innerHTML = listaFinal.map(f => {
        const isAdmin = usuarioLogado.perfil === 'admin';
        return `
        <div class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition animate-fade-in">
            <div class="px-5 pt-4 pb-3 border-b bg-slate-50 flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex gap-2 mb-1">
                        <span class="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">${f.empresa || 'Geral'}</span>
                        <span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">${f.documento || 'Doc'}</span>
                    </div>
                    <h4 class="font-extrabold text-slate-800 text-sm leading-tight">${f.motivo || 'Motivo'}</h4>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="copiarTexto(${f.id})" class="bg-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition"><i class="far fa-copy"></i> Copiar</button>
                    <button onclick='editarFrase(${JSON.stringify(f)})' class="bg-white border text-yellow-500 px-2 py-1.5 rounded-lg hover:bg-yellow-50 transition"><i class="fas fa-pen"></i></button>
                    <button onclick="deletarFraseBiblioteca(${f.id})" class="bg-white border text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            
            <div class="px-5 py-4 flex-grow">
                <p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">${f.conteudo}</p>
            </div>
            
            <div class="px-5 py-2 bg-slate-50 border-t flex justify-start items-center">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <i class="fas ${isAdmin ? 'fa-chart-line' : 'fa-user-check'} mr-1"></i>
                    ${isAdmin ? f.usos + ' usos na empresa' : f.meus_usos + ' vezes usado por mim'}
                </span>
            </div>
        </div>`;
    }).join('');
}

function aplicarFiltros() {
    const termo = normalizar(document.getElementById('global-search').value);
    const filtrados = cacheFrases.filter(f => f._busca.includes(termo));
    renderizarBiblioteca(filtrados, termo.length > 0);
}
