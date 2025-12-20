// Local: js/equipe.js

async function carregarEquipe() {
    const container = document.getElementById('lista-equipe-container');
    const badge = document.getElementById('equipe-total-badge');
    
    if (!usuarioLogado || usuarioLogado.perfil !== 'admin' || !container) return;

    container.innerHTML = '<div class="p-12 text-center text-slate-400 flex flex-col items-center gap-2"><i class="fas fa-circle-notch fa-spin text-2xl"></i><span class="text-xs font-bold uppercase tracking-widest">Carregando membros...</span></div>';

    try {
        const { data, error } = await _supabase.from('usuarios').select('*').order('nome', { ascending: true });
        if (error) throw error;

        if(badge) badge.innerText = `${data.length} membros`;

        if(!data.length) { 
            container.innerHTML = '<div class="p-12 text-center text-slate-400 flex flex-col items-center gap-2"><i class="far fa-user text-3xl mb-2"></i><span>Nenhum membro encontrado.</span></div>'; 
            return; 
        }

        let html = `
        <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr><th class="px-6 py-4">Membro</th><th class="px-6 py-4">Login</th><th class="px-6 py-4">Perfil</th><th class="px-6 py-4">Status</th><th class="px-6 py-4 text-right">Ações</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">`;

        html += data.map(u => `
            <tr class="hover:bg-slate-50 transition group">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">${(u.nome||u.username).charAt(0).toUpperCase()}</div>
                        <span class="font-bold text-slate-700">${u.nome || '---'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-slate-500 font-mono text-xs">${u.username}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide border ${u.perfil==='admin'?'bg-yellow-50 text-yellow-700 border-yellow-200':'bg-blue-50 text-blue-700 border-blue-200'}">${u.perfil}</span></td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide border ${u.ativo?'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-700 border-red-200'}">${u.ativo ? 'ATIVO' : 'BLOQUEADO'}</span></td>
                <td class="px-6 py-4 text-right">
                    <button onclick='editarUsuario(${JSON.stringify(u)})' class="bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 p-2 rounded-lg transition shadow-sm mr-1" title="Editar"><i class="fas fa-pen"></i></button>
                    ${u.username !== usuarioLogado.username ? `<button onclick="excluirUsuario(${u.id})" class="bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 p-2 rounded-lg transition shadow-sm" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="p-8 text-center text-red-400">Erro ao carregar equipe.</div>';
    }
}

// --- FUNÇÕES CRUD USUÁRIO ---
function abrirModalUsuario() {
    document.getElementById('id-user-edit').value = '';
    document.getElementById('nome-novo').value = '';
    document.getElementById('user-novo').value = '';
    document.getElementById('pass-novo').value = '';
    document.getElementById('perfil-novo').value = 'user';
    document.getElementById('ativo-novo').checked = true;
    document.getElementById('user-novo').disabled = false;
    document.getElementById('modal-user-title').innerText = 'Novo Membro';
    document.getElementById('modal-usuario').classList.remove('hidden');
}

function editarUsuario(u) {
    document.getElementById('id-user-edit').value = u.id;
    document.getElementById('nome-novo').value = u.nome || '';
    document.getElementById('user-novo').value = u.username;
    document.getElementById('user-novo').disabled = true; 
    document.getElementById('pass-novo').value = u.senha;
    document.getElementById('perfil-novo').value = u.perfil;
    document.getElementById('ativo-novo').checked = u.ativo;
    document.getElementById('modal-user-title').innerText = 'Editar Membro';
    document.getElementById('modal-usuario').classList.remove('hidden');
}

async function salvarUsuario() {
    const id = document.getElementById('id-user-edit').value;
    const nome = document.getElementById('nome-novo').value;
    const user = document.getElementById('user-novo').value;
    const pass = document.getElementById('pass-novo').value;
    const perfil = document.getElementById('perfil-novo').value;
    const ativo = document.getElementById('ativo-novo').checked;

    if(!user || !pass) return Swal.fire('Erro', 'Preencha login e senha', 'warning');

    const dados = { username: user, senha: pass, perfil: perfil, ativo: ativo, nome: nome };

    try {
        if(id) {
            await _supabase.from('usuarios').update(dados).eq('id', id);
        } else {
            const { error } = await _supabase.from('usuarios').insert([dados]);
            if(error && error.code === '23505') return Swal.fire('Erro', 'Usuário já existe', 'warning');
            if(error) throw error;
        }
        fecharModalUsuario();
        carregarEquipe();
        const Toast = Swal.mixin({toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true});
        Toast.fire({icon: 'success', title: 'Membro salvo com sucesso'});
    } catch(e) {
        Swal.fire('Erro', 'Falha ao salvar usuário', 'error');
    }
}

async function excluirUsuario(id) {
    if((await Swal.fire({title:'Tem certeza?', text: "O acesso será revogado imediatamente.", icon: 'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'Sim, remover'})).isConfirmed) {
        await _supabase.from('usuarios').delete().eq('id', id);
        carregarEquipe();
    }
}

function filtrarEquipe(termo) {
    const linhas = document.querySelectorAll('#lista-equipe-container tbody tr');
    const termoNormalizado = normalizar(termo);
    linhas.forEach(tr => {
        const textoLinha = normalizar(tr.innerText);
        if(textoLinha.includes(termoNormalizado)) tr.classList.remove('hidden'); else tr.classList.add('hidden');
    });
}

// --- IMPORTAÇÃO E BACKUP ---

function baixarBackup() {
    _supabase.from('frases').select('*').then(({data}) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_gupyfrases_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });
}

async function restaurarBackup(input) {
    const file = input.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            if(!Array.isArray(dados)) throw new Error("Formato inválido");
            
            // Pergunta de confirmação
            const conf = await Swal.fire({
                title: 'Restaurar Backup?',
                text: `Isso adicionará ${dados.length} frases ao sistema. Duplicatas exatas serão ignoradas.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sim, restaurar'
            });

            if(conf.isConfirmed) {
                // Limpa IDs para criar novos registros ou faz upsert se preferir. 
                // Aqui vamos fazer insert ignorando o ID para evitar conflitos, ou upsert se ID existir.
                // Simples: Insert limpo (remove ID para gerar novos)
                const dadosLimpos = dados.map(({id, ...rest}) => rest);
                
                // Envia em lotes de 50 para não travar
                let total = 0;
                const batchSize = 50;
                for (let i = 0; i < dadosLimpos.length; i += batchSize) {
                    await _supabase.from('frases').insert(dadosLimpos.slice(i, i + batchSize));
                    total += dadosLimpos.slice(i, i + batchSize).length;
                }
                
                Swal.fire('Sucesso!', `${total} frases restauradas.`, 'success');
                registrarLog('LIMPEZA', `Restaurou backup (${total} itens)`);
            }
        } catch(err) {
            Swal.fire('Erro', 'Arquivo de backup inválido ou corrompido.', 'error');
        }
        input.value = ''; // Reseta input
    };
    reader.readAsText(file);
}

// --- IMPORTAÇÃO EXCEL (MASSIVA) ---

function baixarModeloExcel() {
    // Cria uma planilha modelo na memória e baixa
    const ws = XLSX.utils.json_to_sheet([
        { "empresa": "Exemplo LTDA", "motivo": "Agradecimento", "documento": "Email", "conteudo": "Olá, agradecemos o seu contato..." },
        { "empresa": "Teste SA", "motivo": "Cobrança", "documento": "WhatsApp", "conteudo": "Prezado, consta em aberto..." }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao_frases.xlsx");
}

async function processarUploadExcel(input) {
    const file = input.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if(jsonData.length === 0) return Swal.fire('Vazio', 'A planilha está vazia.', 'warning');

            // Validação básica das colunas
            const exemplo = jsonData[0];
            if(!exemplo.conteudo && !exemplo.Conteudo && !exemplo.CONTEUDO) {
                return Swal.fire('Formato Inválido', 'A planilha precisa ter uma coluna chamada "conteudo". Baixe o modelo.', 'error');
            }

            const preview = jsonData.length;
            const confirm = await Swal.fire({
                title: 'Importar Frases?',
                text: `Encontradas ${preview} frases. Deseja importar?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Sim, importar'
            });

            if(confirm.isConfirmed) {
                // Prepara dados (Padroniza chaves para minúsculo)
                const frasesParaInserir = jsonData.map(row => {
                    // Busca flexível de colunas (case insensitive)
                    const getVal = (key) => row[key] || row[key.toUpperCase()] || row[key.charAt(0).toUpperCase() + key.slice(1)] || '';
                    
                    return {
                        empresa: formatarTextoBonito(getVal('empresa'), 'titulo') || 'Geral',
                        motivo: formatarTextoBonito(getVal('motivo'), 'titulo') || 'Geral',
                        documento: formatarTextoBonito(getVal('documento'), 'titulo') || 'Geral',
                        conteudo: padronizarFraseInteligente(getVal('conteudo')), // Usa a nossa função inteligente de limpeza
                        revisado_por: usuarioLogado.username,
                        usos: 0
                    };
                }).filter(f => f.conteudo.length > 0); // Remove linhas vazias

                // Envio em Lotes (Batch) para não estourar limite do Supabase Free
                const batchSize = 50;
                let inseridos = 0;
                
                // Barra de progresso visual (SweetAlert)
                Swal.fire({
                    title: 'Importando...',
                    html: 'Processando <b>0</b> de ' + frasesParaInserir.length,
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                for (let i = 0; i < frasesParaInserir.length; i += batchSize) {
                    const lote = frasesParaInserir.slice(i, i + batchSize);
                    const { error } = await _supabase.from('frases').insert(lote);
                    
                    if(error) {
                        console.error(error); // Continua tentando os próximos lotes mesmo se um falhar
                    } else {
                        inseridos += lote.length;
                        Swal.update({ html: `Processando <b>${inseridos}</b> de ${frasesParaInserir.length}` });
                    }
                }

                registrarLog('CRIAR', `Importação em massa: ${inseridos} frases`);
                Swal.fire('Concluído!', `${inseridos} frases importadas com sucesso.`, 'success');
            }

        } catch(err) {
            console.error(err);
            Swal.fire('Erro', 'Falha ao processar arquivo Excel.', 'error');
        }
        input.value = ''; // Reseta input
    };
    reader.readAsArrayBuffer(file);
}
