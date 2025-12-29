// Local: js/ui-modals.js

// --- Modal CEP ---
function fecharModalCEP() { 
    document.getElementById('modal-cep').classList.add('hidden'); 
}

// --- Modal Idade (Calculadora) ---
function abrirModalCalculadora() {
    // 1. Reseta o input principal
    const inputMain = document.getElementById('calc-data-input');
    if(inputMain) inputMain.value = '';
    
    // 2. Abre no modo padrão (Intervalo)
    // Verifica se a função existe no app.js antes de chamar
    if(typeof mudarModoCalculadora === 'function') {
        mudarModoCalculadora('intervalo');
    }
    
    // 3. Exibe o modal
    document.getElementById('modal-idade').classList.remove('hidden');
}

function fecharModalIdade() { 
    document.getElementById('modal-idade').classList.add('hidden'); 
}

// --- Modal Frase ---
function fecharModalFrase() { 
    document.getElementById('modal-frase').classList.add('hidden'); 
}

// --- Modal Usuário ---
function abrirModalUsuario() {
    // Limpa os campos
    document.getElementById('id-user-edit').value = '';
    document.getElementById('nome-novo').value = '';
    document.getElementById('user-novo').value = '';
    document.getElementById('pass-novo').value = '';
    document.getElementById('perfil-novo').value = 'user';
    document.getElementById('ativo-novo').checked = true;
    
    document.getElementById('modal-user-title').innerText = "Novo Membro";
    document.getElementById('modal-usuario').classList.remove('hidden');
}

function fecharModalUsuario() { 
    document.getElementById('modal-usuario').classList.add('hidden'); 
}

// --- Toggle de Filtros ---
function toggleFiltros() {
    const panel = document.getElementById('filter-panel');
    const btn = document.getElementById('btn-toggle-filters');
    
    if(panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-200');
    } else {
        panel.classList.add('hidden');
        btn.classList.remove('bg-blue-50', 'text-blue-600', 'border-blue-200');
    }
}
