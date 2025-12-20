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

        _supabase.from('logs').insert([{
            usuario: usuarioLogado.username, 
            acao: 'COPIAR_RANK', 
            detalhe: String(id), 
            data_hora: new Date().toISOString()
        }]).then(() => {}); 

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

    const valEmpresa = elEmpresa.value;
    const valMotivo = elMotivo.value;
    const valDoc = elDoc.value;

    const temFiltro = termo !== '' || valEmpresa !== '' || valMotivo !== '' || valDoc !== '';
    let base = cacheFrases;

    if (termo) base = base.filter(f => f._busca.includes(termo));

    const optsEmpresa = base.filter(f => (valMotivo ? f.motivo === valMotivo : true) && (valDoc ? f.documento === valDoc : true));
    const optsMotivo = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valDoc ? f.documento === valDoc : true));
    const optsDoc = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valMotivo ? f.motivo === valMotivo : true));

    updateSelect('filtro-empresa', optsEmpresa, 'empresa', '🏢 Empresas', valEmpresa);
    updateSelect('filtro-motivo', optsMotivo, 'motivo', '🎯 Motivos', valMotivo);
    updateSelect('filtro-doc', optsDoc, 'documento', '📄 Docs', valDoc);

    const filtrados = base.filter(f => 
        (valEmpresa ? f.empresa === valEmpresa : true) && 
        (valMotivo ? f.motivo === valMotivo : true) && 
        (valDoc ? f.documento === valDoc : true)
    );
    
    let listaFinal;
    let tituloHtml = "";

    if (!temFiltro) {
        listaFinal = filtrados.slice(0, 4);
        tituloHtml = `<div class="col-span-full mb-2 flex items-center gap-2"><i class="fas fa-fire text-orange-500"></i> <span class="font-bold text-slate-500 text-xs uppercase tracking-wider">Top 4 Mais Usadas</span></div>`;
    } else {
        listaFinal = filtrados;
        tituloHtml = `<div class="col-span-full mb-2 flex items-center gap-2"><i class="fas fa-search text-blue-500"></i> <span class="font-bold text-slate-500 text-xs uppercase tracking-wider">Resultados (${listaFinal.length})</span></div>`;
    }

    renderizarBiblioteca(listaFinal, tituloHtml); 
}

function updateSelect(id, list, key, label, currentValue) { 
    const sel = document.getElementById(id); 
    if(document.activeElement === sel) return; 
    const uniq = [...new Set(list.map(i=>i[key]).filter(Boolean))].sort(); 
    sel.innerHTML = `<option value="">${label}</option>` + uniq.map(u=>`<option value="${u}">${u}</option>`).join(''); 
    if (uniq.includes(currentValue)) sel.value = currentValue; else sel.value = "";
}

function renderizarBiblioteca(lista, tituloHtml) { 
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

    grid.innerHTML = tituloHtml + cards;
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
    
    // 1. Remove espaços extras (inicio, fim e duplos no meio)
    let t = texto.replace(/\s+/g, ' ').trim();
    
    // 2. Corrige pontuação (remove espaço antes de vírgula/ponto, garante espaço depois)
    // Remove espaço antes: "olá , mundo" -> "olá, mundo"
    t = t.replace(/\s+([.,!?;:])/g, '$1');
    // Adiciona espaço depois se não houver: "olá,mundo" -> "olá, mundo" (exceto se for fim da string ou números 1.2)
    t = t.replace(/([.,!?;:])(?=[^\s\d])/g, '$1 ');

    // 3. Capitalização (Sentence Case) 
    // Se o texto for > 5 chars e estiver TUDO EM MAIÚSCULO, converte para minúsculo
    // (Evita gritaria, mas mantém siglas curtas como "GUPY" se for o caso)
    const letras = t.replace(/[^a-zA-Z]/g, '');
    if (letras.length > 4 && letras === letras.toUpperCase()) {
        t = t.toLowerCase();
    }
    
    // Garante primeira letra maiúscula
    t = t.charAt(0).toUpperCase() + t.slice(1);

    return t;
}

// --- CRUD ---

function abrirModalFrase() { 
    document.getElementById('id-frase').value=''; 
    document.getElementById('inp-conteudo').value=''; 
    document.getElementById('inp-empresa').value=''; 
    document.getElementById('inp-motivo').value=''; 
    document.getElementById('inp-doc').value=''; 
    document.getElementById('modal-title').innerHTML='Nova Frase'; 
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
    document.getElementById('modal-frase').classList.remove('hidden'); 
}

async function salvarFrase() { 
    const id = document.getElementById('id-frase').value; 
    const rawConteudo = document.getElementById('inp-conteudo').value;
    
    // --- PADRONIZAÇÃO AQUI ---
    const conteudoLimpo = padronizarFraseInteligente(rawConteudo);
    
    if(!conteudoLimpo) return Swal.fire('Erro', 'Conteúdo obrigatório', 'warning'); 

    // --- VALIDAÇÃO DE DUPLICIDADE ---
    // Compara ignorando pontuação e espaços
    const inputPuro = normalizar(conteudoLimpo).replace(/[^\w]/g, '');

    const duplicada = cacheFrases.some(f => {
        if (id && f.id == id) return false; // Ignora a própria frase se estiver editando
        const bancoPuro = normalizar(f.conteudo).replace(/[^\w]/g, '');
        return inputPuro === bancoPuro;
    });

    if (duplicada) {
        return Swal.fire({
            title: 'Frase Duplicada',
            text: 'Esta frase já existe na biblioteca (mesmo com pontuação diferente). O sistema padronizou sua entrada para verificar.',
            icon: 'warning'
        });
    }

    const dados = { 
        empresa: formatarTextoBonito(document.getElementById('inp-empresa').value, 'titulo'), 
        motivo: formatarTextoBonito(document.getElementById('inp-motivo').value, 'titulo'), 
        documento: formatarTextoBonito(document.getElementById('inp-doc').value, 'titulo'), 
        conteudo: conteudoLimpo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    try { 
        if(id) { 
            await _supabase.from('frases').update(dados).eq('id', id); 
            registrarLog('EDITAR', `Editou frase #${id}`); 
        } else { 
            await _supabase.from('frases').insert([dados]); 
            registrarLog('CRIAR', `Nova frase`); 
        } 
        document.getElementById('modal-frase').classList.add('hidden'); 
        carregarFrases(); 
        Swal.fire('Salvo!', 'Frase salva e padronizada com sucesso.', 'success'); 
    } catch(e) { Swal.fire('Erro', 'Falha ao salvar', 'error'); } 
}

async function deletarFraseBiblioteca(id) {
    if((await Swal.fire({title:'Excluir?', text: "Esta ação não pode ser desfeita.", icon: 'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Sim, excluir'})).isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('EXCLUIR', `Apagou frase #${id}`);
        carregarFrases();
        Swal.fire('Excluído!', '', 'success');
    }
}
