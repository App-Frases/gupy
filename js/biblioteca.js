// Local: js/biblioteca.js

let cacheFrases = [];

async function carregarFrases() {
    try {
        const container = document.getElementById('grid-frases');
        if(container) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando biblioteca...</div>';

        const { data, error } = await _supabase
            .from('frases')
            .select('*')
            .order('usos', {ascending: false}); 
        
        if (error) throw error;

        cacheFrases = (data || []).map(f => ({
            ...f, 
            _busca: normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
        }));
        
        aplicarFiltros('inicio');
    } catch (e) {
        console.error("Erro:", e);
        Swal.fire('Erro', 'Falha ao carregar biblioteca.', 'error');
    }
}

async function copiarTexto(id) { 
    const f = cacheFrases.find(i => i.id == id); 
    if(!f) return;

    navigator.clipboard.writeText(f.conteudo).then(async () => { 
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true});
        Toast.fire({icon: 'success', title: 'Copiado!'});

        registrarLog('COPIAR', String(id)); 

        const novoUso = (f.usos || 0) + 1;
        const agora = new Date().toISOString();

        await _supabase.from('frases').update({ usos: novoUso, ultimo_uso: agora }).eq('id', id);
        
        f.usos = novoUso;
        const elContador = document.querySelector(`#card-frase-${id} .contador-usos`);
        if(elContador) elContador.innerHTML = `<i class="fas fa-history mr-1"></i>${novoUso} usos`;
    }); 
}

function aplicarFiltros(origem) {
    const elSearch = document.getElementById('global-search');
    const termo = elSearch ? normalizar(elSearch.value) : '';
    const elEmpresa = document.getElementById('filtro-empresa');
    const elMotivo = document.getElementById('filtro-motivo');
    const elDoc = document.getElementById('filtro-doc');

    const valEmpresa = elEmpresa ? elEmpresa.value : '';
    const valMotivo = elMotivo ? elMotivo.value : '';
    const valDoc = elDoc ? elDoc.value : '';

    const temFiltro = termo !== '' || valEmpresa !== '' || valMotivo !== '' || valDoc !== '';
    let base = cacheFrases;

    if (termo) base = base.filter(f => f._busca.includes(termo));

    const optsEmpresa = base.filter(f => (valMotivo ? f.motivo === valMotivo : true) && (valDoc ? f.documento === valDoc : true));
    const optsMotivo = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valDoc ? f.documento === valDoc : true));
    const optsDoc = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valMotivo ? f.motivo === valMotivo : true));

    updateSelect('filtro-empresa', optsEmpresa, 'empresa', '🏢 Empresas', valEmpresa);
    updateSelect('filtro-motivo', optsMotivo, 'motivo', '🎯 Motivos', valMotivo);
    updateSelect('filtro-doc', optsDoc, 'documento', '📄 Documentos', valDoc);

    const filtrados = base.filter(f => 
        (valEmpresa ? f.empresa === valEmpresa : true) && 
        (valMotivo ? f.motivo === valMotivo : true) && 
        (valDoc ? f.documento === valDoc : true)
    );
    
    let listaFinal;

    if (!temFiltro) {
        listaFinal = filtrados.slice(0, 4);
    } else {
        listaFinal = filtrados;
    }

    renderizarBiblioteca(listaFinal); 
}

function updateSelect(id, list, key, label, currentValue) { 
    const sel = document.getElementById(id); 
    if(!sel || document.activeElement === sel) return; 
    const uniq = [...new Set(list.map(i=>i[key]).filter(Boolean))].sort(); 
    sel.innerHTML = `<option value="">${label}</option>` + uniq.map(u=>`<option value="${u}">${u}</option>`).join(''); 
    if (uniq.includes(currentValue)) sel.value = currentValue; else sel.value = "";
}

function renderizarBiblioteca(lista) { 
    const grid = document.getElementById('grid-frases'); 
    if(!grid) return;
    
    if(!lista.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold bg-white rounded-xl border border-slate-100">Nenhum resultado.</div>'; return; } 
    
    const cards = lista.map(f => {
        const idSafe = f.id;
        const objSafe = JSON.stringify(f).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
        
        return `
        <div id="card-frase-${idSafe}" class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group overflow-hidden animate-fade-in">
            <div class="px-5 pt-4 pb-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                <div class="flex-1 pr-3">
                    <div class="flex flex-wrap gap-2 mb-1.5">
                        <span class="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">${f.empresa||'Geral'}</span>
                        <span class="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-slate-200">${f.documento||'Doc'}</span>
                    </div>
                    <h4 class="font-extrabold text-slate-800 text-sm leading-tight">${f.motivo||'Sem título'}</h4>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                    <button onclick="copiarTexto(${idSafe})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5" title="Copiar"><i class="far fa-copy"></i> Copiar</button>
                    
                    <button onclick='editarFrase(${objSafe})' class="bg-white border border-yellow-200 text-yellow-600 hover:bg-yellow-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm" title="Editar"><i class="fas fa-pen"></i></button>
                    <button onclick="deletarFraseBiblioteca(${idSafe})" class="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="px-5 py-4 flex-grow"><p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p></div>
            <div class="px-5 py-2 bg-slate-50 border-t border-slate-100 flex justify-start items-center">
                <span class="contador-usos text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <i class="fas fa-history mr-1"></i>${f.usos || 0} usos
                </span>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = cards;
}

function limparFiltros() { 
    const search = document.getElementById('global-search');
    if(search) search.value = ''; 
    document.querySelectorAll('select').forEach(s=>s.value=''); 
    aplicarFiltros('inicio'); 
}

// --- UTIL: PADRONIZAÇÃO DE TEXTO ---
function padronizarFraseInteligente(texto) {
    if (!texto) return "";
    let t = texto.replace(/\s+/g, ' ').trim();
    t = t.replace(/^"+|"+$/g, ''); 
    t = t.trim();
    t = t.replace(/\s+([.,!?;:])/g, '$1'); 
    t = t.replace(/([.,!?;:])(?=[^\s\d])/g, '$1 '); 
    const letras = t.replace(/[^a-zA-Z]/g, '');
    if (letras.length > 4 && letras === letras.toUpperCase()) {
        t = t.toLowerCase();
    }
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t;
}

// --- CRUD ---

// Função Nova: Popula as Datalists (Sugestões)
function atualizarSugestoesModal() {
    const preencher = (idLista, chave) => {
        const lista = document.getElementById(idLista);
        if(!lista) return;
        // Pega valores únicos, remove vazios e ordena
        const valores = [...new Set(cacheFrases.map(f => f[chave]))].filter(Boolean).sort();
        lista.innerHTML = valores.map(v => `<option value="${v}">`).join('');
    };

    preencher('list-empresas', 'empresa');
    preencher('list-motivos', 'motivo');
    preencher('list-docs', 'documento');
}

function abrirModalFrase() { 
    document.getElementById('id-frase').value=''; 
    document.getElementById('inp-conteudo').value=''; 
    document.getElementById('inp-empresa').value=''; 
    document.getElementById('inp-motivo').value=''; 
    document.getElementById('inp-doc').value=''; 
    
    document.getElementById('modal-title').innerHTML='Nova Frase'; 
    
    // Atualiza as sugestões antes de abrir
    atualizarSugestoesModal();
    
    document.getElementById('modal-frase').classList.remove('hidden'); 
}

function editarFrase(f) { 
    if(typeof f === 'string') f = JSON.parse(f);
    document.getElementById('id-frase').value = f.id; 
    document.getElementById('inp-empresa').value = f.empresa; 
    document.getElementById('inp-motivo').value = f.motivo; 
    document.getElementById('inp-doc').value = f.documento; 
    document.getElementById('inp-conteudo').value = f.conteudo; 
    
    document.getElementById('modal-title').innerHTML = `Editar #${f.id}`; 
    
    // Atualiza as sugestões
    atualizarSugestoesModal();
    
    document.getElementById('modal-frase').classList.remove('hidden'); 
}

async function salvarFrase() { 
    const id = document.getElementById('id-frase').value; 
    
    // Captura os valores brutos
    const rawEmpresa = document.getElementById('inp-empresa').value.trim();
    const rawMotivo = document.getElementById('inp-motivo').value.trim();
    const rawDoc = document.getElementById('inp-doc').value.trim();
    const rawConteudo = document.getElementById('inp-conteudo').value;

    if (!rawEmpresa || !rawMotivo || !rawDoc || !rawConteudo.trim()) {
        return Swal.fire({
            title: 'Campos Obrigatórios',
            text: 'Por favor, preencha todos os campos.',
            icon: 'warning',
            confirmButtonColor: '#3b82f6'
        });
    }
    
    const conteudoLimpo = padronizarFraseInteligente(rawConteudo);
    
    // Validação de Duplicidade (Conteúdo)
    const inputPuro = normalizar(conteudoLimpo).replace(/[^\w]/g, '');
    const duplicada = cacheFrases.some(f => {
        if (id && f.id == id) return false; 
        const bancoPuro = normalizar(f.conteudo).replace(/[^\w]/g, '');
        return inputPuro === bancoPuro;
    });

    if (duplicada) {
        return Swal.fire({
            title: 'Frase Duplicada',
            text: 'Esta frase já existe na biblioteca.',
            icon: 'warning'
        });
    }

    // Padronização dos Campos de Metadados (Empresa, Motivo, Doc)
    // Usa 'titulo' para Capitalize Each Word (ex: "gupy" -> "Gupy")
    const dados = { 
        empresa: formatarTextoBonito(rawEmpresa, 'titulo'), 
        motivo: formatarTextoBonito(rawMotivo, 'titulo'), 
        documento: formatarTextoBonito(rawDoc, 'titulo'), 
        conteudo: conteudoLimpo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    try { 
        if(id) { 
            await _supabase.from('frases').update(dados).eq('id', id); 
            registrarLog('EDITAR', id); 
        } else { 
            const { data } = await _supabase.from('frases').insert([dados]).select(); 
            if(data && data[0]) registrarLog('CRIAR', data[0].id);
            else registrarLog('CRIAR', 'Nova frase');
        } 
        document.getElementById('modal-frase').classList.add('hidden'); 
        carregarFrases(); 
        Swal.fire('Salvo!', 'Frase salva com sucesso.', 'success'); 
    } catch(e) { Swal.fire('Erro', 'Falha ao salvar', 'error'); } 
}

async function deletarFraseBiblioteca(id) {
    if((await Swal.fire({title:'Excluir?', text: "Esta ação não pode ser desfeita.", icon: 'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Sim, excluir'})).isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('EXCLUIR', id);
        carregarFrases();
        Swal.fire('Excluído!', '', 'success');
    }
}
