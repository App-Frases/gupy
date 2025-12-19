// Local: js/logs.js

let logsSubscription = null;

async function carregarLogs() {
    const containerAcessos = document.getElementById('col-acessos');
    const containerUso = document.getElementById('col-uso');
    const containerAuditoria = document.getElementById('col-auditoria');

    // Estado de "Carregando..."
    if(containerAcessos) containerAcessos.innerHTML = '<p class="text-center text-gray-300 text-xs py-10 animate-pulse">Carregando histórico...</p>';
    if(containerUso) containerUso.innerHTML = '<p class="text-center text-gray-300 text-xs py-10 animate-pulse">Carregando histórico...</p>';
    if(containerAuditoria) containerAuditoria.innerHTML = '<p class="text-center text-gray-300 text-xs py-10 animate-pulse">Carregando histórico...</p>';

    try {
        // 1. Busca os últimos 50 logs para preencher a tela inicial
        const { data, error } = await _supabase
            .from('logs')
            .select('*')
            .order('data_hora', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Limpa os containers antes de preencher
        limparContainers();

        // Distribui os logs históricos
        data.forEach(log => adicionarLogNaTela(log, false)); // false = não animar histórico

        // 2. Inicia a escuta em tempo real (se ainda não estiver ativa)
        iniciarEscutaRealtime();

    } catch (e) {
        console.error("Erro ao carregar logs:", e);
        Swal.fire('Erro', 'Não foi possível carregar o histórico de logs.', 'error');
    }
}

function limparContainers() {
    document.getElementById('col-acessos').innerHTML = '';
    document.getElementById('col-uso').innerHTML = '';
    document.getElementById('col-auditoria').innerHTML = '';
}

// --- FUNÇÃO MÁGICA: REALTIME ---
function iniciarEscutaRealtime() {
    // Se já existe uma subscrição, não cria outra para evitar duplicados
    if (logsSubscription) return;

    logsSubscription = _supabase
        .channel('tabela-logs-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'logs' },
            (payload) => {
                // Quando um novo log chega, adiciona-o à tela com animação
                adicionarLogNaTela(payload.new, true);
            }
        )
        .subscribe();
        
    console.log("📡 Logs em tempo real ativados.");
}

// --- RENDERIZAÇÃO INTELIGENTE ---
function adicionarLogNaTela(log, animar = false) {
    // 1. Determina a Categoria (Coluna)
    let containerId = 'col-auditoria'; // Padrão
    let icone = 'fa-info-circle';
    let corIcone = 'text-gray-400';
    let corBg = 'bg-gray-50';

    const acao = log.acao.toUpperCase();

    // Lógica de separação
    if (acao.includes('LOGIN') || acao.includes('ACESSO')) {
        containerId = 'col-acessos';
        icone = 'fa-key';
        corIcone = 'text-green-500';
        corBg = 'bg-green-50';
    } 
    else if (acao.includes('COPIAR')) {
        containerId = 'col-uso';
        icone = 'fa-copy';
        corIcone = 'text-blue-500';
        corBg = 'bg-blue-50';
    } 
    else if (acao.includes('CRIAR') || acao.includes('EDITAR') || acao.includes('EXCLUIR') || acao.includes('IMPORTACAO') || acao.includes('LIMPEZA')) {
        containerId = 'col-auditoria';
        icone = 'fa-exclamation-triangle';
        corIcone = 'text-orange-500';
        corBg = 'bg-orange-50';
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // 2. Formata a Data
    const dataObj = new Date(log.data_hora);
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    // Calcula tempo relativo simples
    const diffMinutos = Math.floor((new Date() - dataObj) / 60000);
    let tempoRelativo = diffMinutos < 1 ? 'Agora mesmo' : `${diffMinutos}m atrás`;
    if (!animar && diffMinutos > 60) tempoRelativo = `${dataFormatada} às ${horaFormatada}`;

    // 3. Monta o HTML
    // Se for 'animar' (novo log), adicionamos classes de animação
    const animClasses = animar ? 'animate-fade-in-down border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent';

    const html = `
        <div class="p-3 rounded-lg border border-gray-100 bg-white shadow-sm flex gap-3 items-start transition-all hover:bg-gray-50 ${animClasses}">
            <div class="mt-1 w-8 h-8 rounded-full ${corBg} flex items-center justify-center shrink-0">
                <i class="fas ${icone} ${corIcone} text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <p class="text-xs font-bold text-gray-700 truncate">${log.usuario}</p>
                    <span class="text-[9px] font-mono text-gray-400 whitespace-nowrap ml-2">${horaFormatada}</span>
                </div>
                <p class="text-[10px] font-bold uppercase text-gray-500 mt-0.5 tracking-wide">${log.acao}</p>
                <p class="text-xs text-gray-600 leading-tight mt-1 break-words">${log.detalhe || 'Sem detalhes'}</p>
            </div>
        </div>
    `;

    // 4. Insere no TOPO da lista (afterbegin)
    container.insertAdjacentHTML('afterbegin', html);

    // 5. Limpeza de Excesso (Opcional: mantém apenas os últimos 50 elementos para não pesar o browser)
    if (container.children.length > 50) {
        container.lastElementChild.remove();
    }
}

// Estilo extra para a animação de entrada (se não tiveres no tailwind config)
// Adicionamos via JS para garantir que funciona
const style = document.createElement('style');
style.innerHTML = `
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
    animation: fadeInDown 0.5s ease-out forwards;
}
`;
document.head.appendChild(style);
