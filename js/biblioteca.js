let cacheFrases = [];

async function carregarFrases() {
    try {
        const { data } = await _supabase.from('frases').select('*').order('id', {ascending: false});
        let logsQ = _supabase.from('logs').select('detalhe').eq('acao', 'COPIAR_RANK');
        if(usuarioLogado.perfil !== 'admin') logsQ = logsQ.eq('usuario', usuarioLogado.username);
        const { data: logs } = await logsQ;
        
        const mapUso = {}; 
        if(logs) logs.forEach(l => mapUso[l.detalhe] = (mapUso[l.detalhe]||0)+1);
        
        cacheFrases = (data||[]).map(f => ({...f, qtd_usos: mapUso[f.id]||0, _busca: normalizar(f.conteudo+f.empresa+f.motivo+f.documento)}));
        cacheFrases.sort((a,b)=>b.qtd_usos - a.qtd_usos);
        
        aplicarFiltros('inicio');
    } catch (e) {
        console.error("Erro ao carregar frases:", e);
        document.getElementById('contador-resultados').innerText = "Erro";
    }
}

function aplicarFiltros(origem) {
    const termo = normalizar(document.getElementById('global-search').value);
    const elEmpresa = document.getElementById('filtro-empresa');
    const elMotivo = document.getElementById('filtro-motivo');
    const elDoc = document.getElementById('filtro-doc');

    const valEmpresa = elEmpresa.value;
    const valMotivo = elMotivo.value;
    const valDoc = elDoc.value;
    
    let base = cacheFrases;
    if (termo) {
        base = base.filter(f => f._busca.includes(termo));
    }

    const optsEmpresa = base.filter(f => (valMotivo ? f.motivo === valMotivo : true) && (valDoc ? f.documento === valDoc : true));
    const optsMotivo = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valDoc ? f.documento === valDoc : true));
    const optsDoc = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valMotivo ? f.motivo === valMotivo : true));

    updateSelect('filtro-empresa', optsEmpresa, 'empresa', '🏢 Todas Empresas', valEmpresa);
    updateSelect('filtro-motivo', optsMotivo, 'motivo', '🎯 Todos Motivos', valMotivo);
    updateSelect('filtro-doc', optsDoc, 'documento', '📄 Todos Documentos', valDoc);

    const finalEmpresa = elEmpresa.value;
    const finalMotivo = elMotivo.value;
    const finalDoc = elDoc.value;

    const filtrados = base.filter(f => 
        (finalEmpresa ? f.empresa === finalEmpresa : true) && 
        (finalMotivo ? f.motivo === finalMotivo : true) && 
        (finalDoc ? f.documento === finalDoc : true)
    );
    
    const cnt = document.getElementById('contador-resultados');
    const haFiltrosAtivos = termo || finalEmpresa || finalMotivo || finalDoc;
    const exibir = haFiltrosAtivos ? filtrados : filtrados.slice(0, 4);
    
    if(!haFiltrosAtivos) { 
        cnt.innerText = usuarioLogado.perfil === 'admin' ? "TOP 4 (GLOBAL)" : "TOP 4 (SEU RANKING)"; 
        cnt.className = "text-xs font-extrabold text-blue-500 bg-blue-50 px-3 py-1 rounded-full"; 
    } else { 
        cnt.innerText = `${filtrados.length} RESULTADOS`; 
        cnt.className = "text-xs font-extrabold text-white bg-green-500 px-3 py-1 rounded-full"; 
    }

    renderizarBiblioteca(exibir); 
}

function updateSelect(id, list, key, label, currentValue) { 
    const sel = document.getElementById(id); 
    const uniq = [...new Set(list.map(i=>i[key]).filter(Boolean))].sort(); 
    sel.innerHTML = `<option value="">${label}</option>` + uniq.map(u=>`<option value="${u}">${u}</option>`).join(''); 
    if (uniq.includes(currentValue)) sel.value = currentValue; else sel.value = "";
}

function renderizarBiblioteca(lista) { 
    const grid = document.getElementById('grid-frases'); 
    if(!lista.length) { grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 font-bold">Nenhuma frase encontrada.</div>'; return; } 
    
    grid.innerHTML = lista.map(f => {
        // --- BOTÕES DE AÇÃO ---
        
        // Botão COPIAR (Movido para cá)
        const btnCopiar = `<button onclick="copiarTexto(${f.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition transform hover:-translate-y-0.5 flex items-center gap-2" title="Copiar"><i class="far fa-copy"></i> Copiar</button>`;
        
        const btnEditar = `<button onclick='editarFrase(${JSON.stringify(f)})' class="bg-white border border-yellow-200 text-yellow-600 hover:bg-yellow-50 px-3 py-2 rounded-lg font-bold transition shadow-sm" title="Editar"><i class="fas fa-pen"></i></button>`;
        const btnExcluir = `<button onclick="deletarFraseBiblioteca(${f.id})" class="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg font-bold transition shadow-sm" title="Excluir"><i class="fas fa-trash-alt"></i></button>`;

        return `
        <div class="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <div class="px-5 pt-5 pb-3 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
                <div class="flex-1 pr-3">
                    <div class="flex flex-wrap gap-2 mb-2">
                        <span class="bg-blue-100 text-blue-700 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">${f.empresa||'Geral'}</span>
                        <span class="bg-white text-gray-500 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide border border-gray-200"><i class="far fa-file-alt mr-1.5"></i>${f.documento||'Doc'}</span>
                    </div>
                    <h4 class="font-extrabold text-gray-800 text-base leading-tight tracking-tight group-hover:text-blue-600 transition-colors">${f.motivo||'Sem título'}</h4>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                    ${btnCopiar}
                    ${btnEditar}
                    ${btnExcluir} 
                </div>
            </div>
            <div class="px-5 py-5 flex-grow bg-white"><p class="text-base text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">${f.conteudo}</p></div>
            <div class="px-5 py-3 bg-white border-t border-gray-50 flex justify-start items-center">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${f.qtd_usos} usos</span>
            </div>
        </div>`;
    }).join('');
}

function limparFiltros() { document.getElementById('global-search').value = ''; document.querySelectorAll('select').forEach(s=>s.value=''); aplicarFiltros('inicio'); }
async function copiarTexto(id) { const f = cacheFrases.find(i=>i.id==id); navigator.clipboard.writeText(f.conteudo).then(async()=>{ Swal.fire({toast:true, position:'top-end', icon:'success', title:'Copiado!', showConfirmButton:false, timer:1500}); await _supabase.from('logs').insert([{usuario:usuarioLogado.username, acao:'COPIAR_RANK', detalhe:id}]); f.qtd_usos++; }); }

// CRUD E EXCLUSÃO
function abrirModalFrase() { document.getElementById('id-frase').value=''; document.querySelectorAll('#modal-frase input, #modal-frase textarea').forEach(el=>el.value=''); document.getElementById('modal-title').innerHTML='Nova Frase'; document.getElementById('modal-frase').classList.remove('hidden'); }
function fecharModalFrase() { document.getElementById('modal-frase').classList.add('hidden'); }
function editarFrase(f) { document.getElementById('id-frase').value = f.id; document.getElementById('inp-empresa').value = f.empresa; document.getElementById('inp-motivo').value = f.motivo; document.getElementById('inp-doc').value = f.documento; document.getElementById('inp-conteudo').value = f.conteudo; document.getElementById('modal-title').innerHTML = `Editando #${f.id}`; document.getElementById('modal-frase').classList.remove('hidden'); }

async function salvarFrase() { 
    const id = document.getElementById('id-frase').value; 
    const rawConteudo = document.getElementById('inp-conteudo').value;
    
    // Pequena formatação no save
    let conteudoLimpo = rawConteudo.trim();
    if(conteudoLimpo) conteudoLimpo = conteudoLimpo.charAt(0).toUpperCase() + conteudoLimpo.slice(1);

    const dados = { 
        empresa: formatarTextoBonito(document.getElementById('inp-empresa').value, 'titulo'), 
        motivo: formatarTextoBonito(document.getElementById('inp-motivo').value, 'titulo'), 
        documento: formatarTextoBonito(document.getElementById('inp-doc').value, 'titulo'), 
        conteudo: conteudoLimpo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    if(!dados.conteudo) return Swal.fire('Erro', 'Conteúdo obrigatório', 'warning'); 
    try { 
        if(id) { await _supabase.from('frases').update(dados).eq('id', id); registrarLog('EDITAR', `Editou frase #${id}`); } 
        else { await _supabase.from('frases').insert([dados]); registrarLog('CRIAR', `Nova frase`); } 
        fecharModalFrase(); carregarFrases(); Swal.fire('Salvo!', '', 'success'); 
    } catch(e) { Swal.fire('Erro', '', 'error'); } 
}

async function deletarFraseBiblioteca(id) {
    if((await Swal.fire({title:'Tem certeza?', text: "Você não poderá reverter isso!", icon: 'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Sim, excluir!'})).isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('EXCLUIR', `Apagou frase #${id}`);
        carregarFrases();
        Swal.fire('Excluído!', 'A frase foi removida.', 'success');
    }
}
