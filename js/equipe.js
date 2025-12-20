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

// =========================================================================
// GESTÃO DE DADOS (Backup, Restore, Limpeza)
// =========================================================================

function baixarBackup() {
    _supabase.from('frases').select('*').then(({data}) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_gupyfrases_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });
}

// Função para buscar TODAS as frases existentes e gerar um SET de verificação
async function getFrasesExistentesSet() {
    const { data } = await _supabase.from('frases').select('conteudo');
    if(!data) return new Set();
    // Cria um conjunto de frases normalizadas (sem pontuação/espaços) para comparação rápida
    return new Set(data.map(f => normalizar(f.conteudo).replace(/[^\w]/g, '')));
}

async function restaurarBackup(input) {
    const file = input.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dadosBackup = JSON.parse(e.target.result);
            if(!Array.isArray(dadosBackup)) throw new Error("Formato inválido");

            // 1. Busca o que já existe no banco
            Swal.fire({title: 'Verificando...', text: 'Comparando com o banco de dados...', didOpen: () => Swal.showLoading()});
            const existentesSet = await getFrasesExistentesSet();

            // 2. Filtra apenas as NOVAS (que não estão no Set)
            const novosRegistros = dadosBackup.filter(item => {
                const chave = normalizar(item.conteudo).replace(/[^\w]/g, '');
                if (existentesSet.has(chave)) return false; // Já existe
                
                existentesSet.add(chave); // Adiciona ao set para evitar duplicatas no próprio backup
                return true;
            });

            // 3. Limpa IDs para gerar novos
            const dadosLimpos = novosRegistros.map(({id, ...rest}) => rest);

            if(dadosLimpos.length === 0) {
                input.value = '';
                return Swal.fire('Tudo atualizado', 'Todas as frases do backup já existem no sistema.', 'info');
            }

            // 4. Pergunta
            const conf = await Swal.fire({
                title: 'Restaurar Backup?',
                html: `O backup tem <b>${dadosBackup.length}</b> frases.<br>O sistema identificou <b>${dadosLimpos.length}</b> frases novas.<br>As duplicadas serão ignoradas.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: `Importar ${dadosLimpos.length} frases`
            });

            if(conf.isConfirmed) {
                // Envia em lotes
                let total = 0;
                const batchSize = 50;
                
                Swal.fire({title: 'Importando...', didOpen: () => Swal.showLoading()});

                for (let i = 0; i < dadosLimpos.length; i += batchSize) {
                    await _supabase.from('frases').insert(dadosLimpos.slice(i, i + batchSize));
                    total += dadosLimpos.slice(i, i + batchSize).length;
                }
                
                Swal.fire('Sucesso!', `${total} novas frases restauradas.`, 'success');
                registrarLog('LIMPEZA', `Restaurou backup (${total} novos itens)`);
            }
        } catch(err) {
            Swal.fire('Erro', 'Arquivo inválido.', 'error');
        }
        input.value = ''; 
    };
    reader.readAsText(file);
}

// --- REMOVER DUPLICADAS EM MASSA (SOLUÇÃO DO PROBLEMA ATUAL) ---
async function removerDuplicadasEmMassa() {
    const confirm = await Swal.fire({
        title: 'Limpar Duplicadas?',
        text: "Isso vai verificar todas as frases. Se houver frases iguais, manterá a mais antiga e apagará as cópias. Esta ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, limpar tudo'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: 'Analisando...',
        html: 'Buscando frases duplicadas no banco...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    // 1. Baixa TODAS as frases (ID, Conteudo, Data de Criação/ID)
    // Ordenamos por ID ascendente (os menores IDs são os mais antigos/originais)
    const { data: todasFrases, error } = await _supabase.from('frases').select('id, conteudo').order('id', {ascending: true});
    
    if (error) return Swal.fire('Erro', 'Falha ao buscar frases.', 'error');

    const vistos = new Set();
    const idsParaExcluir = [];

    // 2. Identifica duplicatas
    todasFrases.forEach(f => {
        // Normaliza para pegar duplicatas mesmo com pontuação diferente
        const chave = normalizar(f.conteudo).replace(/[^\w]/g, '');
        
        if (vistos.has(chave)) {
            // Se já vimos essa chave, esta é uma duplicata (e como está ordenado por ID, é mais recente)
            idsParaExcluir.push(f.id);
        } else {
            // Primeira vez que vemos, marcamos como "original"
            vistos.add(chave);
        }
    });

    if (idsParaExcluir.length === 0) {
        return Swal.fire('Limpo', 'Não foram encontradas frases duplicadas.', 'success');
    }

    // 3. Apaga em lotes
    Swal.update({ html: `Encontradas <b>${idsParaExcluir.length}</b> cópias. Excluindo...` });

    const batchSize = 100;
    for (let i = 0; i < idsParaExcluir.length; i += batchSize) {
        const batch = idsParaExcluir.slice(i, i + batchSize);
        await _supabase.from('frases').delete().in('id', batch);
    }

    registrarLog('LIMPEZA', `Removeu ${idsParaExcluir.length} frases duplicadas`);
    Swal.fire('Sucesso!', `${idsParaExcluir.length} frases duplicadas foram removidas.`, 'success');
}

// --- IMPORTAÇÃO EXCEL ---

function baixarModeloExcel() {
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

            // Validação de colunas
            const exemplo = jsonData[0];
            if(!exemplo.conteudo && !exemplo.Conteudo && !exemplo.CONTEUDO) {
                return Swal.fire('Formato Inválido', 'Coluna "conteudo" obrigatória.', 'error');
            }

            Swal.fire({title: 'Verificando...', text: 'Comparando duplicatas...', didOpen: () => Swal.showLoading()});
            
            // Busca existentes para filtrar
            const existentesSet = await getFrasesExistentesSet();

            // Prepara e Filtra
            const frasesParaInserir = [];
            let ignoradas = 0;

            jsonData.forEach(row => {
                const getVal = (key) => row[key] || row[key.toUpperCase()] || row[key.charAt(0).toUpperCase() + key.slice(1)] || '';
                const conteudoRaw = getVal('conteudo');
                
                if(conteudoRaw) {
                    const conteudoLimpo = padronizarFraseInteligente(conteudoRaw);
                    const chave = normalizar(conteudoLimpo).replace(/[^\w]/g, '');

                    if (!existentesSet.has(chave)) {
                        existentesSet.add(chave); // Evita duplicar dentro da própria planilha
                        frasesParaInserir.push({
                            empresa: formatarTextoBonito(getVal('empresa'), 'titulo') || 'Geral',
                            motivo: formatarTextoBonito(getVal('motivo'), 'titulo') || 'Geral',
                            documento: formatarTextoBonito(getVal('documento'), 'titulo') || 'Geral',
                            conteudo: conteudoLimpo,
                            revisado_por: usuarioLogado.username,
                            usos: 0
                        });
                    } else {
                        ignoradas++;
                    }
                }
            });

            if(frasesParaInserir.length === 0) {
                return Swal.fire('Info', `Todas as ${jsonData.length} frases da planilha já existem no sistema.`, 'info');
            }

            const confirm = await Swal.fire({
                title: 'Importar Frases?',
                html: `Novas frases: <b>${frasesParaInserir.length}</b><br>Duplicadas ignoradas: <b>${ignoradas}</b>`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Sim, importar'
            });

            if(confirm.isConfirmed) {
                const batchSize = 50;
                let inseridos = 0;
                
                Swal.fire({
                    title: 'Importando...',
                    html: 'Enviando dados...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                for (let i = 0; i < frasesParaInserir.length; i += batchSize) {
                    const lote = frasesParaInserir.slice(i, i + batchSize);
                    await _supabase.from('frases').insert(lote);
                    inseridos += lote.length;
                    Swal.update({ html: `Processando <b>${inseridos}</b> de ${frasesParaInserir.length}` });
                }

                registrarLog('CRIAR', `Importação Excel: ${inseridos} frases`);
                Swal.fire('Concluído!', `${inseridos} frases importadas.`, 'success');
            }

        } catch(err) {
            console.error(err);
            Swal.fire('Erro', 'Falha ao processar arquivo.', 'error');
        }
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}
