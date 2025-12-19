// Local: js/biblioteca.js

let cacheFrases = [];

// Carrega as frases do banco
async function carregarFrases() {
    try {
        const { data } = await _supabase.from('frases').select('*').order('id', {ascending: false});
        
        // Carrega contadores locais (opcional, só para visual da biblioteca)
        let logsQ = _supabase.from('logs').select('detalhe').eq('acao', 'COPIAR');
        if(usuarioLogado.perfil !== 'admin') logsQ = logsQ.eq('usuario', usuarioLogado.username);
        
        const { data: logs } = await logsQ;
        const mapUso = {}; 
        
        if(logs) {
            logs.forEach(l => {
                // Parse seguro do ID
                const id = String(l.detalhe).replace(/\D/g, '');
                if(id) mapUso[id] = (mapUso[id]||0)+1;
            });
        }
        
        cacheFrases = (data||[]).map(f => ({
            ...f, 
            qtd_usos: mapUso[f.id]||0, 
            _busca: normalizar(f.conteudo+f.empresa+f.motivo+f.documento)
        }));
        
        cacheFrases.sort((a,b)=>b.qtd_usos - a.qtd_usos);
        aplicarFiltros('inicio');
    } catch (e) {
        console.error("Erro ao carregar frases:", e);
    }
}

// Filtros de pesquisa
function aplicarFiltros(origem) {
    const termo = normalizar(document.getElementById('global-search').value);
    const elEmpresa = document.getElementById('filtro-empresa');
    const elMotivo = document.getElementById('filtro-motivo');
    const elDoc = document.getElementById('filtro-doc');

    const valEmpresa = elEmpresa.value;
    const valMotivo = elMotivo.value;
    const valDoc = elDoc.value;
    
    let base = cacheFrases;
    if (termo) base = base.filter(f => f._busca.includes(termo));

    // Atualiza opções dos selects dinamicamente
    const optsEmpresa = base.filter(f => (valMotivo ? f.motivo === valMotivo : true) && (valDoc ? f.documento === valDoc : true));
    const optsMotivo = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valDoc ? f.documento === valDoc : true));
    const optsDoc = base.filter(f => (valEmpresa ? f.empresa === valEmpresa : true) && (valMotivo ? f.motivo === valMotivo : true));

    updateSelect('filtro-empresa', optsEmpresa, 'empresa', '🏢 Empresas', valEmpresa);
    updateSelect('filtro-motivo', optsMotivo, 'motivo', '🎯 Motivos', valMotivo);
    updateSelect('filtro-doc', optsDoc, 'documento', '📄 Docs', valDoc);

    const filtrados = base.filter(f => 
        (elEmpresa.value ? f.empresa === elEmpresa.value : true) && 
        (elMotivo.value ? f.motivo === elMotivo.value : true) && 
        (elDoc.value ? f.documento === elDoc.value : true)
    );
    
    // Paginação simples (mostra 8 ou todos se filtrado)
    const exibir = (termo || elEmpresa.value || elMotivo.value || elDoc.value) ? filtrados : filtrados.slice(0, 10);
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
    if(!lista.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold">Nenhum resultado.</div>'; return; } 
    
    grid.innerHTML = lista.map(f => {
        return `
        <div class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group overflow-hidden">
            <div class="px-5 pt-4 pb-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                <div class="flex-1 pr-3">
                    <div class="flex flex-wrap gap-2 mb-1.5">
                        <span class="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">${f.empresa||'Geral'}</span>
                        <span class="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-slate-200">${f.documento||'Doc'}</span>
                    </div>
                    <h4 class="font-extrabold text-slate-800 text-sm leading-tight">${f.motivo||'Sem título'}</h4>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                    <button onclick="copiarTexto(${f.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5" title="Copiar"><i class="far fa-copy"></i> Copiar</button>
                    <button onclick='editarFrase(${JSON.stringify(f).replace(/'/g, "&#39;")})' class="bg-white border border-yellow-200 text-yellow-600 hover:bg-yellow-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm"><i class="fas fa-pen"></i></button>
                    <button onclick="deletarFraseBiblioteca(${f.id})" class="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold transition shadow-sm"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="px-5 py-4 flex-grow"><p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">${f.conteudo}</p></div>
            <div class="px-5 py-2 bg-slate-50 border-t border-slate-100 flex justify-start items-center">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest"><i class="fas fa-history mr-1"></i>${f.qtd_usos} usos</span>
            </div>
        </div>`;
    }).join('');
}

function limparFiltros() { document.getElementById('global-search').value = ''; document.querySelectorAll('select').forEach(s=>s.value=''); aplicarFiltros('inicio'); }

// --- AÇÃO CRÍTICA: COPIAR ---
async function copiarTexto(id) { 
    const f = cacheFrases.find(i=>i.id==id); 
    if(!f) return;

    navigator.clipboard.writeText(f.conteudo).then(async()=>{ 
        // Feedback Visual Rápido
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true});
        Toast.fire({icon: 'success', title: 'Copiado para área de transferência'});

        // LOG PADRONIZADO PARA O DASHBOARD FUNCIONAR
        // Acao: COPIAR | Detalhe: ID puro (ex: "15")
        await _supabase.from('logs').insert([{
            usuario: usuarioLogado.username, 
            acao: 'COPIAR', 
            detalhe: String(id), // Salva APENAS o ID como string
            data_hora: new Date().toISOString()
        }]);
        
        // Atualiza contador localmente
        f.qtd_usos++;
        renderizarBiblioteca(cacheFrases.filter(i => document.getElementById('grid-frases').innerHTML.includes(i.motivo))); // Re-render light
    }); 
}

// CRUD Simples
function abrirModalFrase() { document.getElementById('id-frase').value=''; document.querySelectorAll('#modal-frase input, #modal-frase textarea').forEach(el=>el.value=''); document.getElementById('modal-title').innerHTML='Nova Frase'; document.getElementById('modal-frase').classList.remove('hidden'); }
function fecharModalFrase() { document.getElementById('modal-frase').classList.add('hidden'); }
function editarFrase(f) { document.getElementById('id-frase').value = f.id; document.getElementById('inp-empresa').value = f.empresa; document.getElementById('inp-motivo').value = f.motivo; document.getElementById('inp-doc').value = f.documento; document.getElementById('inp-conteudo').value = f.conteudo; document.getElementById('modal-title').innerHTML = `Editar #${f.id}`; document.getElementById('modal-frase').classList.remove('hidden'); }

async function salvarFrase() { 
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
        if(id) { await _supabase.from('frases').update(dados).eq('id', id); registrarLog('EDITAR', `Editou frase #${id}`); } 
        else { await _supabase.from('frases').insert([dados]); registrarLog('CRIAR', `Nova frase`); } 
        fecharModalFrase(); carregarFrases(); Swal.fire('Salvo!', '', 'success'); 
    } catch(e) { Swal.fire('Erro', 'Falha ao salvar', 'error'); } 
}

async function deletarFraseBiblioteca(id) {
    if((await Swal.fire({title:'Excluir?', text: "Irreversível!", icon: 'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Sim'})).isConfirmed) {
        await _supabase.from('frases').delete().eq('id', id);
        registrarLog('EXCLUIR', `Apagou frase #${id}`);
        carregarFrases();
        Swal.fire('Excluído!', '', 'success');
    }
}
