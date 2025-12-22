// Local: js/biblioteca.js

let cacheFrases = [];

async function carregarFrases() {
    try {
        const container = document.getElementById('grid-frases');
        if(container) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Sincronizando biblioteca...</div>';

        const { data: frasesGlobais, error: erroFrases } = await _supabase.from('frases').select('*');
        if (erroFrases) throw erroFrases;

        let meusUsosMap = {};
        if (usuarioLogado) {
            const { data: meusStats } = await _supabase.from('view_usos_pessoais').select('frase_id, qtd_uso').eq('usuario', usuarioLogado.username);
            if (meusStats) {
                meusStats.forEach(stat => { meusUsosMap[stat.frase_id] = stat.qtd_uso; });
            }
        }

        cacheFrases = (frasesGlobais || []).map(f => ({
            ...f,
            meus_usos: meusUsosMap[f.id] || 0,
            _busca: normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
        }));

        // Ordenação lógica
        if (usuarioLogado.perfil === 'admin') {
            cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
        } else {
            cacheFrases.sort((a, b) => {
                if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                return (b.usos || 0) - (a.usos || 0);
            });
        }
        aplicarFiltros();
    } catch (e) {
        console.error("Erro ao carregar frases:", e);
    }
}

async function copiarTexto(id) { 
    const f = cacheFrases.find(i => i.id == id); 
    if(!f) return;

    navigator.clipboard.writeText(f.conteudo).then(async () => { 
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 1500});
        Toast.fire({icon: 'success', title: 'Copiado!'});

        // O Trigger no banco cuidará de somar +1 na tabela frases
        await registrarLog('COPIAR', String(id)); 

        // Feedback visual imediato
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

async function salvarFrase() { 
    const id = document.getElementById('id-frase').value; 
    const rawEmpresa = document.getElementById('inp-empresa').value.trim();
    const rawMotivo = document.getElementById('inp-motivo').value.trim();
    const rawDoc = document.getElementById('inp-doc').value.trim();
    const rawConteudo = document.getElementById('inp-conteudo').value;

    if (!rawEmpresa || !rawMotivo || !rawDoc || !rawConteudo.trim()) {
        return Swal.fire('Atenção', 'Todos os campos são obrigatórios.', 'warning');
    }
    
    const conteudoLimpo = padronizarFraseInteligente(rawConteudo);
    const dados = { 
        empresa: formatarTextoBonito(rawEmpresa, 'titulo'), 
        motivo: formatarTextoBonito(rawMotivo, 'titulo'), 
        documento: formatarTextoBonito(rawDoc, 'titulo'), 
        conteudo: conteudoLimpo, 
        revisado_por: usuarioLogado.username 
    }; 
    
    try { 
        if(id) { 
            const { error } = await _supabase.from('frases').update(dados).eq('id', id); 
            if(error) throw error;
            registrarLog('EDITAR', id); 
        } else { 
            const { data, error } = await _supabase.from('frases').insert([dados]).select(); 
            if(error) throw error;
            if(data) registrarLog('CRIAR', String(data[0].id));
        } 
        fecharModalFrase();
        carregarFrases(); 
        Swal.fire('Sucesso!', 'A frase foi salva.', 'success'); 
    } catch(e) { 
        console.error(e);
        Swal.fire('Erro', 'Não foi possível salvar.', 'error'); 
    } 
}

async function deletarFraseBiblioteca(id) {
    const result = await Swal.fire({
        title: 'Excluir frase?',
        text: "Esta ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir'
    });

    if(result.isConfirmed) {
        try {
            const { error } = await _supabase.from('frases').delete().eq('id', id);
            if(error) throw error;
            registrarLog('EXCLUIR', String(id));
            carregarFrases();
            Swal.fire('Excluído!', 'Frase removida.', 'success');
        } catch(e) {
            Swal.fire('Erro', 'Falha ao deletar.', 'error');
        }
    }
}

// Funções auxiliares mantidas (padronizarFraseInteligente, aplicarFiltros, etc)
