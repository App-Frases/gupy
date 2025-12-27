// ... (código anterior da função navegar permanece igual)

// --- ATUALIZADO: Controle da Busca Global ---

function debounceBusca() { 
    // 1. Controle Visual do Botão "X" (Imediato)
    const input = document.getElementById('global-search');
    const btnLimpar = document.getElementById('btn-clear-search');
    
    if (input.value.trim().length > 0) {
        btnLimpar.classList.remove('hidden');
    } else {
        btnLimpar.classList.add('hidden');
    }

    // 2. Execução da Busca (Com delay para performance)
    clearTimeout(debounceTimer); 
    debounceTimer = setTimeout(() => {
        const termo = input.value.toLowerCase();
        if (abaAtiva === 'biblioteca' && typeof aplicarFiltros === 'function') aplicarFiltros();
        if (abaAtiva === 'equipe' && typeof filtrarEquipe === 'function') filtrarEquipe(termo);
        if (abaAtiva === 'logs' && typeof filtrarLogs === 'function') filtrarLogs(termo);
    }, 300); 
}

function limparBuscaGlobal() {
    const input = document.getElementById('global-search');
    input.value = '';
    document.getElementById('btn-clear-search').classList.add('hidden');
    
    // Dispara a limpeza imediatamente (sem delay)
    if (abaAtiva === 'biblioteca' && typeof aplicarFiltros === 'function') aplicarFiltros();
    if (abaAtiva === 'equipe' && typeof filtrarEquipe === 'function') filtrarEquipe('');
    if (abaAtiva === 'logs' && typeof filtrarLogs === 'function') filtrarLogs('');
    
    input.focus(); // Devolve o foco para o input
}

// ... (restante do código: carregarNomesChat, etc)
