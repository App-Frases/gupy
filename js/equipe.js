// Local: js/equipe.js

async function carregarEquipe() {
    const container = document.getElementById('lista-equipe-container');
    if (!usuarioLogado || usuarioLogado.perfil !== 'admin' || !container) return;

    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando equipe...</div>';

    try {
        const { data, error } = await _supabase.from('usuarios').select('*').order('nome', { ascending: true });
        if (error) throw error;

        if(!data.length) { container.innerHTML = '<div class="p-8 text-center text-slate-400">Nenhum membro encontrado.</div>'; return; }

        let html = `
        <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr><th class="p-4">Membro</th><th class="p-4">Login</th><th class="p-4">Perfil</th><th class="p-4">Status</th><th class="p-4 text-right">Ações</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">`;

        html += data.map(u => `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-4 font-bold text-slate-700">${u.nome || '---'}</td>
                <td class="p-4 text-slate-500 font-mono text-xs">${u.username}</td>
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${u.perfil==='admin'?'bg-yellow-100 text-yellow-700':'bg-blue-100 text-blue-700'}">${u.perfil.toUpperCase()}</span></td>
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${u.ativo?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${u.ativo ? 'ATIVO' : 'BLOQUEADO'}</span></td>
                <td class="p-4 text-right">
                    <button onclick='editarUsuario(${JSON.stringify(u)})' class="text-blue-500 hover:text-blue-700 font-bold text-xs mr-3"><i class="fas fa-pen mr-1"></i>Editar</button>
                    ${u.username !== usuarioLogado.username ? `<button onclick="excluirUsuario(${u.id})" class="text-red-400 hover:text-red-600 font-bold text-xs"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="p-8 text-center text-red-400">Erro ao carregar equipe.</div>';
    }
}

// Funções de Modal e CRUD de Usuário
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
        Swal.fire('Sucesso', 'Dados salvos!', 'success');
    } catch(e) {
        Swal.fire('Erro', 'Falha ao salvar usuário', 'error');
    }
}

async function excluirUsuario(id) {
    if((await Swal.fire({title:'Tem certeza?', text: "O acesso será revogado.", icon: 'warning', showCancelButton:true})).isConfirmed) {
        await _supabase.from('usuarios').delete().eq('id', id);
        carregarEquipe();
    }
}

function filtrarEquipe(termo) {
    const linhas = document.querySelectorAll('#lista-equipe-container tbody tr');
    linhas.forEach(tr => {
        if(tr.innerText.toLowerCase().includes(termo)) tr.classList.remove('hidden');
        else tr.classList.add('hidden');
    });
}

function baixarBackup() {
    // Implementação simples de backup JSON
    _supabase.from('frases').select('*').then(({data}) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_frases_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });
}
