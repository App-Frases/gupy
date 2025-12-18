let cacheEquipe = [];

// --- BUSCA ESPECÍFICA ---
function filtrarEquipe(termo) {
    if (!termo) { renderizarListaEquipe(cacheEquipe); return; }
    const t = termo.toLowerCase();
    const filtrados = cacheEquipe.filter(u => 
        u.username.toLowerCase().includes(t) ||
        (u.nome && u.nome.toLowerCase().includes(t)) ||
        (u.ativo ? 'ativo' : 'inativo').includes(t)
    );
    renderizarListaEquipe(filtrados);
}

// --- CARREGAR ---
async function carregarEquipe() {
    const { data, error } = await _supabase.from('usuarios').select('*').order('nome', { ascending: true });
    if (error) { console.error("Erro equipe:", error); return; }
    cacheEquipe = data;
    renderizarListaEquipe(data);
}

function renderizarListaEquipe(lista) {
    const container = document.getElementById('lista-equipe-container');
    if (!lista.length) { container.innerHTML = '<div class="text-center text-gray-400 py-10">Nenhum membro encontrado.</div>'; return; }

    let html = `
    <table class="w-full text-left border-collapse">
        <thead>
            <tr class="text-xs font-extrabold text-gray-400 uppercase border-b border-gray-200">
                <th class="px-6 py-4">Colaborador</th>
                <th class="px-6 py-4">Status Conta</th>
                <th class="px-6 py-4">Conexão</th>
                <th class="px-6 py-4 text-right">Ações</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">`;

    html += lista.map(u => {
        const statusOnline = getStatusUsuario(u.ultimo_visto);
        const nomeExibicao = u.nome || u.username;
        const safeNome = (u.nome || '').replace(/'/g, "\\'");
        
        // Estilização baseada se está Ativo ou Inativo
        const opacityClass = u.ativo ? '' : 'opacity-50 grayscale';
        const badgeAtivo = u.ativo 
            ? '<span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200">Ativo</span>'
            : '<span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200">Inativo</span>';

        const clickEdit = `prepararEdicaoUsuario('${u.id}','${u.username}','${u.senha}','${u.perfil}', '${safeNome}', ${u.ativo})`;

        return `
        <tr class="hover:bg-blue-50/50 transition cursor-pointer group ${opacityClass}" onclick="${clickEdit}">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-lg relative shrink-0">
                        ${nomeExibicao.charAt(0).toUpperCase()}
                        ${u.ativo ? `<div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusOnline.color}"></div>` : ''}
                    </div>
                    <div>
                        <p class="font-bold text-gray-800 text-sm">${nomeExibicao}</p>
                        <p class="text-xs text-gray-400 font-mono">ID: ${u.username}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col items-start gap-1">
                    ${badgeAtivo}
                    <span class="text-[9px] font-bold uppercase text-gray-400">${u.perfil === 'admin' ? 'Administrador' : 'Colaborador'}</span>
                </div>
            </td>
            <td class="px-6 py-4"><p class="text-xs font-bold ${statusOnline.textColor}">${u.ativo ? statusOnline.label : 'Acesso Bloqueado'}</p></td>
            <td class="px-6 py-4 text-right">
                <button onclick="event.stopPropagation(); tentarDeletarUsuario('${u.id}','${u.username}', '${nomeExibicao}')" class="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50" title="Excluir"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>`;
    }).join('');

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function getStatusUsuario(dataString) {
    if (!dataString) return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-gray-400' };
    const diff = new Date() - new Date(dataString);
    const minutos = Math.floor(diff / 60000);
    if (minutos < 2) return { color: 'bg-green-500', label: 'Online', textColor: 'text-green-600' };
    if (minutos < 60) return { color: 'bg-yellow-500', label: `${minutos}m atrás`, textColor: 'text-yellow-600' };
    return { color: 'bg-gray-400', label: 'Offline', textColor: 'text-gray-400' };
}

// --- CRUD ---
function abrirModalUsuario() { 
    document.getElementById('id-user-edit').value=''; 
    document.getElementById('user-novo').value=''; 
    document.getElementById('nome-novo').value=''; 
    document.getElementById('pass-novo').value=''; 
    document.getElementById('perfil-novo').value='user';
    document.getElementById('ativo-novo').checked = true; // Padrão Ativo
    
    document.getElementById('modal-user-title').innerHTML='Novo Membro'; 
    document.getElementById('btn-salvar-user').innerText='Criar Conta'; 
    document.getElementById('modal-usuario').classList.remove('hidden'); 
}

function fecharModalUsuario() { document.getElementById('modal-usuario').classList.add('hidden'); }

function prepararEdicaoUsuario(id, username, senha, perfil, nome, ativo) { 
    document.getElementById('id-user-edit').value = id; 
    document.getElementById('user-novo').value = username; 
    document.getElementById('nome-novo').value = nome || ''; 
    document.getElementById('pass-novo').value = senha; 
    document.getElementById('perfil-novo').value = perfil || 'user';
    document.getElementById('ativo-novo').checked = ativo; // Carrega estado
    
    document.getElementById('modal-user-title').innerHTML = 'Editar Perfil'; 
    document.getElementById('btn-salvar-user').innerText = 'Salvar Alterações'; 
    document.getElementById('modal-usuario').classList.remove('hidden'); 
}

async function salvarUsuario() { 
    const id = document.getElementById('id-user-edit').value; 
    const u = document.getElementById('user-novo').value; 
    const n = document.getElementById('nome-novo').value;
    const p = document.getElementById('pass-novo').value; 
    const r = document.getElementById('perfil-novo').value;
    const ativo = document.getElementById('ativo-novo').checked;
    
    if(!u || !p || !n) return Swal.fire('Erro', 'Preencha todos os campos', 'warning'); 
    
    const nomeFormatado = n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    try { 
        if(id) { 
            await _supabase.from('usuarios').update({ username: u, nome: nomeFormatado, senha: p, perfil: r, ativo: ativo }).eq('id', id); 
            registrarLog('EDITAR_USER', `${u} (${ativo?'Ativo':'Inativado'})`); 
        } else { 
            await _supabase.from('usuarios').insert([{username: u, nome: nomeFormatado, senha: p, perfil: r, primeiro_acesso: true, ativo: true}]); 
            registrarLog('CRIAR_USER', `${u} (${nomeFormatado})`); 
        } 
        fecharModalUsuario(); carregarEquipe(); Swal.fire({icon: 'success', title: 'Salvo!', timer: 1500, showConfirmButton: false}); 
    } catch(e) { Swal.fire('Erro', e.message, 'error'); } 
}

// --- VALIDAÇÃO DE EXCLUSÃO ---
async function tentarDeletarUsuario(id, username, nomeExibicao) {
    // 1. Verifica se tem Logs
    const { count: qtdLogs } = await _supabase.from('logs').select('*', { count: 'exact', head: true }).eq('usuario', username);
    // 2. Verifica se criou Frases
    const { count: qtdFrases } = await _supabase.from('frases').select('*', { count: 'exact', head: true }).eq('revisado_por', username);
    
    const totalVinculos = (qtdLogs || 0) + (qtdFrases || 0);

    if (totalVinculos > 0) {
        // Bloqueia exclusão e sugere inativação
        Swal.fire({
            title: 'Não é possível excluir!',
            html: `O usuário <b>${nomeExibicao}</b> possui <b>${totalVinculos} registros</b> de histórico (logs ou frases).<br><br>Para manter a integridade dos dados, você deve <b>INATIVAR</b> o usuário ao invés de excluir.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Inativar Usuário',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d97706' // Laranja
        }).then(async (result) => {
            if (result.isConfirmed) {
                await _supabase.from('usuarios').update({ ativo: false }).eq('id', id);
                registrarLog('EDITAR_USER', `Inativou ${username} (Migrado de exclusão)`);
                carregarEquipe();
                Swal.fire('Inativado', 'O acesso do usuário foi revogado.', 'success');
            }
        });
    } else {
        // Permite excluir pois não tem histórico
        if((await Swal.fire({title: 'Excluir permanentemente?', text: "Esse usuário não tem histórico no sistema.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sim, excluir'})).isConfirmed) {
            await _supabase.from('usuarios').delete().eq('id', id);
            registrarLog('EXCLUIR_USER', username);
            carregarEquipe();
            Swal.fire('Removido', '', 'success');
        }
    }
}

// (Funções auxiliares do arquivo original mantidas: abrirGerenciadorMotivos, etc...)
async function abrirGerenciadorMotivos() { const { data: frases } = await _supabase.from('frases').select('motivo'); if(!frases) return; const contagem = {}; frases.forEach(f => { const nome = f.motivo || "Sem Motivo"; contagem[nome] = (contagem[nome] || 0) + 1; }); const listaAgrupada = Object.entries(contagem).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => a.nome.localeCompare(b.nome)); const tbody = document.getElementById('lista-motivos-unificacao'); tbody.innerHTML = listaAgrupada.map(m => `<tr class="hover:bg-orange-50 transition"><td class="px-6 py-3 font-bold text-gray-700">${m.nome}</td><td class="px-6 py-3 text-center"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">${m.qtd}</span></td><td class="px-6 py-3 text-right"><button onclick="renomearMotivo('${m.nome}')" class="text-blue-600 hover:text-blue-800 text-xs font-bold bg-white border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition"><i class="fas fa-edit mr-1"></i> Renomear / Mesclar</button></td></tr>`).join(''); document.getElementById('modal-motivos').classList.remove('hidden'); }
async function renomearMotivo(nomeAntigo) { const { value: novoNome } = await Swal.fire({title: 'Renomear Motivo', html: `Todas as frases com motivo <b>"${nomeAntigo}"</b> serão alteradas.`, input: 'text', inputValue: nomeAntigo, showCancelButton: true, confirmButtonText: 'Salvar'}); if (novoNome && novoNome !== nomeAntigo) { const nomeFormatado = formatarTextoBonito(novoNome, 'titulo'); Swal.fire({ title: 'Atualizando...', didOpen: () => Swal.showLoading() }); const { error } = await _supabase.from('frases').update({ motivo: nomeFormatado }).eq('motivo', nomeAntigo); if (!error) { registrarLog('EDITAR', `Renomeou motivo "${nomeAntigo}"`); abrirGerenciadorMotivos(); Swal.fire('Sucesso', '', 'success'); } else Swal.fire('Erro', '', 'error'); } }
async function abrirGerenciadorDocumentos() { const { data: frases } = await _supabase.from('frases').select('documento'); if(!frases) return; const contagem = {}; frases.forEach(f => { const nome = f.documento || "Sem Doc"; contagem[nome] = (contagem[nome] || 0) + 1; }); const listaAgrupada = Object.entries(contagem).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => a.nome.localeCompare(b.nome)); const tbody = document.getElementById('lista-documentos-unificacao'); tbody.innerHTML = listaAgrupada.map(m => `<tr class="hover:bg-blue-50 transition"><td class="px-6 py-3 font-bold text-gray-700">${m.nome}</td><td class="px-6 py-3 text-center"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">${m.qtd}</span></td><td class="px-6 py-3 text-right"><button onclick="renomearDocumento('${m.nome}')" class="text-blue-600 hover:text-blue-800 text-xs font-bold bg-white border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition"><i class="fas fa-edit mr-1"></i> Renomear / Mesclar</button></td></tr>`).join(''); document.getElementById('modal-documentos').classList.remove('hidden'); }
async function renomearDocumento(nomeAntigo) { const { value: novoNome } = await Swal.fire({title: 'Renomear Documento', html: `Todos os registros de <b>"${nomeAntigo}"</b> serão alterados.`, input: 'text', inputValue: nomeAntigo, showCancelButton: true, confirmButtonText: 'Salvar'}); if (novoNome && novoNome !== nomeAntigo) { const nomeFormatado = formatarTextoBonito(novoNome, 'titulo'); Swal.fire({ title: 'Atualizando...', didOpen: () => Swal.showLoading() }); const { error } = await _supabase.from('frases').update({ documento: nomeFormatado }).eq('documento', nomeAntigo); if (!error) { registrarLog('EDITAR', `Renomeou documento "${nomeAntigo}"`); abrirGerenciadorDocumentos(); Swal.fire('Sucesso', '', 'success'); } else Swal.fire('Erro', '', 'error'); } }
async function padronizarTodasFrases() { if(!(await Swal.fire({title: 'Padronizar TUDO?', text: 'Isso vai corrigir formatação e aspas em todas as frases.', icon: 'question', showCancelButton: true})).isConfirmed) return; Swal.fire({ title: 'Processando...', didOpen: () => Swal.showLoading() }); try { const { data: frases } = await _supabase.from('frases').select('*'); let count = 0; for (const f of frases) { const novoConteudo = limparTexto(f.conteudo); const novaEmpresa = formatarTextoBonito(f.empresa, 'titulo'); const novoMotivo = formatarTextoBonito(f.motivo, 'titulo'); const novoDoc = formatarTextoBonito(f.documento, 'titulo'); if (novoConteudo !== f.conteudo || novaEmpresa !== f.empresa || novoMotivo !== f.motivo || novoDoc !== f.documento) { await _supabase.from('frases').update({conteudo: novoConteudo, empresa: novaEmpresa, motivo: novoMotivo, documento: novoDoc}).eq('id', f.id); count++; } } if(count > 0) { registrarLog('LIMPEZA', `Padronizou ${count} frases`); Swal.fire('Sucesso!', `${count} frases corrigidas.`, 'success'); } else Swal.fire('Tudo certo!', 'Já estava tudo padronizado.', 'info'); } catch (e) { Swal.fire('Erro', '', 'error'); } }
function limparTexto(texto) { if (!texto) return ""; let t = texto.trim(); t = t.replace(/^["']+|["']+$/g, ''); t = t.replace(/\s+/g, ' '); t = t.charAt(0).toUpperCase() + t.slice(1); return t; }
async function baixarBackup() { const { data: f } = await _supabase.from('frases').select('*'); const { data: u } = await _supabase.from('usuarios').select('*'); const { data: l } = await _supabase.from('logs').select('*'); const blob = new Blob([JSON.stringify({ data: new Date(), sistema: 'Gupy Frases', dados: { frases: f, usuarios: u, logs: l } })], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `backup_gupy_${new Date().toISOString().slice(0,10)}.json`; a.click(); }
async function importarBackup(input) { const file = input.files[0]; if(!file) return; const r = new FileReader(); r.onload = async(e) => { try { const b = JSON.parse(e.target.result); Swal.fire({title: 'Restaurando...', didOpen: () => Swal.showLoading()}); if(b.dados.usuarios) await _supabase.from('usuarios').upsert(b.dados.usuarios); if(b.dados.frases) await _supabase.from('frases').upsert(b.dados.frases); if(b.dados.logs) await _supabase.from('logs').upsert(b.dados.logs); Swal.fire('Restaurado!', '', 'success').then(()=>location.reload()); } catch(err){ Swal.fire('Erro', err.message, 'error'); } }; r.readAsText(file); input.value = ''; }
