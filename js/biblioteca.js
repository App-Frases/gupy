// Local: js/biblioteca.js

let cacheFrases = [];

async function carregarFrases() {
    try {
        const container = document.getElementById('grid-frases');
        if(container) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando biblioteca...</div>';

        // 1. Busca Global
        const { data: frasesGlobais, error: erroFrases } = await _supabase
            .from('frases')
            .select('*');
        
        if (erroFrases) throw erroFrases;

        // 2. Busca Pessoal (Para Colaboradores)
        let meusUsosMap = {};
        if (usuarioLogado) {
            const { data: meusStats, error: erroStats } = await _supabase
                .from('view_usos_pessoais') 
                .select('frase_id, qtd_uso')
                .eq('usuario', usuarioLogado.username);
            
            if (!erroStats && meusStats) {
                meusStats.forEach(stat => {
                    meusUsosMap[stat.frase_id] = stat.qtd_uso;
                });
            }
        }

        // 3. Mescla
        cacheFrases = (frasesGlobais || []).map(f => ({
            ...f,
            meus_usos: meusUsosMap[f.id] || 0,
            _busca: normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
        }));

        // 4. ORDENAÇÃO CONDICIONAL
        if (usuarioLogado.perfil === 'admin') {
            // ADMIN: Ordena puramente pelo uso GLOBAL
            cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
        } else {
            // COLABORADOR: Prioriza o uso PESSOAL
            cacheFrases.sort((a, b) => {
                if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                return (b.usos || 0) - (a.usos || 0); // Desempate global
            });
        }
        
        aplicarFiltros('inicio');
    } catch (e) {
        console.error("Erro:", e);
        Swal.fire('Erro', 'Falha ao carregar biblioteca.', 'error');
    }
}

async function copiarTexto(id) { 
    const f = cacheFrases.find(i => i.id == id); 
    if(!f) return;

    // --- NOVA LÓGICA: Login Diário Automático ---
    // Verifica se já registramos um login HOJE. Se não, registra agora.
    const hoje = new Date().toISOString().split('T')[0]; // Ex: "2023-10-27"
    const ultimoRegistro = localStorage.getItem('gupy_ultimo_login_diario');

    if (ultimoRegistro !== hoje) {
        await registrarLog('LOGIN', 'Acesso Diário (Via Cópia)');
        localStorage.setItem('gupy_ultimo_login_diario', hoje);
    }
    // ---------------------------------------------

    navigator.clipboard.writeText(f.conteudo).then(async () => { 
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true});
        Toast.fire({icon: 'success', title: 'Copiado!'});

        await registrarLog('COPIAR', String(id)); 

        // Atualização Otimista (Visual apenas)
        f.usos = (f.usos || 0) + 1;
        f.meus_usos = (f.meus_usos || 0) + 1;

        const elContador = document.querySelector(`#card-frase-${id} .contador-usos`);
        if(elContador) {
            if (usuarioLogado.perfil === 'admin') {
                elContador.innerHTML = `<i class="fas fa-chart-line mr-1 text-blue-600"></i> ${f.usos} usos na empresa`;
            } else {
                elContador.innerHTML = `<i class="fas fa-user-check mr-1 text-blue-500"></i> ${f.meus_usos} vezes usado por mim`;
            }
        }
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
    
    const listaFinal = !temFiltro ? filtrados.slice(0, 4) : filtrados;

    renderizarBiblioteca(listaFinal, !temFiltro); 
}

function updateSelect(id, list, key, label, currentValue) { 
    const sel = document.getElementById(id); 
    if(!sel || document.activeElement === sel) return; 
    const uniq = [...new Set(list.map(i=>i[key]).filter(Boolean))].sort(); 
    sel.innerHTML = `<option value="">${label}</option>` + uniq.map(u=>`<option value="${u}">${u}</option>`).join(''); 
    if (uniq.includes(currentValue)) sel.value = currentValue; else sel.value = "";
}

function renderizarBiblioteca(lista, isTop4) { 
    const grid = document.getElementById('grid-frases'); 
    if(!grid) return;
    
    if(!lista.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold bg-white rounded-xl border border-slate-100">Nenhum resultado.</div>'; return; } 
    
    const cards = lista.map(f => {
        const idSafe = f.id;
        
        let textoContador;
        let iconeContador;

        if (usuarioLogado.perfil === 'admin') {
            textoContador = `${f.usos || 0} usos na empresa`;
            iconeContador = "fa-chart-line text-blue-600";
        } else {
            if (f.meus_usos > 0) {
                textoContador = `${f.meus_usos} vezes usado por mim`;
                iconeContador = "fa-user-check text-blue-500";
            } else {
                textoContador = `${f.usos || 0} usos na empresa`;
                iconeContador = "fa-globe text-slate-400";
            }
        }

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
                    <button onclick="copiarTexto('${idSafe}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5" title="Copiar"><i class="far fa-copy"></i> Copiar</button>
                    <button onclick="prepararEdicao('${idSafe}')" class="bg-white border border-yellow-200 text-yellow-600 hover:bg-yellow-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm" title="Editar"><i class="fas fa-pen"></i></button>
                    <button onclick="deletarFraseBiblioteca('${idSafe}')" class="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="px-5 py-4 flex-grow"><p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p></div>
            <div class="px-5 py-2 bg-slate-50 border-t border-slate-100 flex justify-start items-center">
                <span class="contador-usos text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <i class="fas ${iconeContador}"></i> ${textoContador}
                </span>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = cards;
}

// --- SUGESTÕES DE AUTOCOMPLETAR ---
function atualizarSugestoesModal() {
    const preencher = (idLista, chave) => {
        const lista = document.getElementById(idLista);
        if(!lista) return;
        const valores = [...new Set(cacheFrases.map(f => f[chave]))].filter(Boolean).sort();
        lista.innerHTML = valores.map(v => `<option value="${v}">`).join('');
    };
    preencher('list-empresas', 'empresa');
    preencher('list-motivos', 'motivo');
    preencher('list-docs', 'documento');
}

// --- CRUD ---
function abrirModalFrase() { 
    document.getElementById('id-frase').value=''; 
    document.getElementById('inp-conteudo').value=''; 
    document.getElementById('inp-empresa').value=''; 
    document.getElementById('inp-motivo').value=''; 
    document.getElementById('inp-doc').value=''; 
    document.getElementById('modal-title').innerHTML='Nova Frase'; 
    atualizarSugestoesModal();
    document.getElementById('modal-frase').classList.remove('hidden'); 
}

function prepararEdicao(id) { 
    const f = cacheFrases.find(item => item.id == id);
    if (!f) return Swal.fire('Erro', 'Frase não encontrada.', 'error');

    document.getElementById('id-frase').value = f.id; 
    document.getElementById('inp-empresa').value = f.empresa || ''; 
    document.getElementById('inp-motivo').value = f.motivo || ''; 
    document.getElementById('inp-doc').value = f.documento || ''; 
    document.getElementById('inp-conteudo').value = f.conteudo || ''; 
    document.getElementById('modal-title').innerHTML = `Editar #${f.id}`; 
    atualizarSugestoesModal();
    document.getElementById('modal-frase').classList.remove('hidden'); 
}

async function salvarFrase() { 
    const id = document.getElementById('id-frase').value; 
    const rawEmpresa = document.getElementById('inp-empresa').value.trim();
    const rawMotivo = document.getElementById('inp-motivo').value.trim();
    const rawDoc = document.getElementById('inp-doc').value.trim();
    const rawConteudo = document.getElementById('inp-conteudo').value;

    if (!rawEmpresa || !rawMotivo || !rawDoc || !rawConteudo.trim()) {
        return Swal.fire({title: 'Campos Obrigatórios', text: 'Por favor, preencha todos os campos.', icon: 'warning', confirmButtonColor: '#3b82f6'});
    }
    
    // Função global definida no utils.js
    const conteudoLimpo = padronizarFraseInteligente(rawConteudo);
    const inputPuro = normalizar(conteudoLimpo).replace(/[^\w]/g, '');
    
    const duplicada = cacheFrases.some(f => {
        if (id && f.id == id) return false; 
        const bancoPuro = normalizar(f.conteudo).replace(/[^\w]/g, '');
        return inputPuro === bancoPuro;
    });

    if (duplicada) return Swal.fire({title: 'Duplicada', text: 'Frase já existe.', icon: 'warning'});

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
        } 
        document.getElementById('modal-frase').classList.add('hidden'); 
        carregarFrases(); 
        Swal.fire('Salvo!', '', 'success'); 
    } catch(e) { 
        console.error(e);
        Swal.fire('Erro', 'Falha ao salvar', 'error'); 
    } 
}

async function deletarFraseBiblioteca(id) {
    const result = await Swal.fire({
        title:'Excluir?', 
        text: "Essa ação não pode ser desfeita.", 
        icon: 'warning', 
        showCancelButton:true, 
        confirmButtonColor:'#d33', 
        confirmButtonText:'Sim, excluir'
    });

    if(result.isConfirmed) {
        try {
            const { error } = await _supabase.from('frases').delete().eq('id', id);
            if (error) throw error;
            
            registrarLog('EXCLUIR', id);
            carregarFrases();
            Swal.fire('Excluído!', '', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    }
}
