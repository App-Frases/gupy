// Local: js/app.js

function entrarNoSistema() {
    // 1. Esconde login e mostra o app
    const loginFlow = document.getElementById('login-flow');
    const appFlow = document.getElementById('app-flow');
    if(loginFlow) loginFlow.classList.add('hidden');
    if(appFlow) appFlow.classList.remove('hidden');
    
    // 2. Tenta mostrar o nome do usuário (com verificação de segurança)
    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay && usuarioLogado) {
        nameDisplay.innerText = usuarioLogado.nome || usuarioLogado.username;
    }
    
    // 3. Mostra menu administrativo se for admin
    const adminMenu = document.getElementById('admin-menu-items');
    if (adminMenu && usuarioLogado.perfil === 'admin') {
        adminMenu.classList.remove('hidden');
    }

    // 4. Inicia as funções do sistema
    if (typeof iniciarChat === 'function') iniciarChat();
    if (typeof carregarFrases === 'function') carregarFrases();
}
