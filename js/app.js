// Local: js/app.js

// ... (Configurações iniciais do Supabase iguais)

function iniciarChat() { 
    const msgContainer = document.getElementById('chat-messages');
    if(!msgContainer) return;

    // Carrega histórico
    _supabase.from('chat_mensagens').select('*').order('created_at',{ascending:true}).limit(50)
    .then(({data}) => {
        msgContainer.innerHTML = '';
        if(data) data.forEach(m => addMsg(m, true));
    });

    // Escuta novas mensagens em tempo real
    _supabase.channel('public:chat_mensagens')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, payload => {
        addMsg(payload.new, false);
    })
    .subscribe(); 
}

async function enviarMensagem() { 
    const input = document.getElementById('chat-input');
    const texto = input.value.trim();
    if(!texto) return;

    const { error } = await _supabase.from('chat_mensagens').insert([{
        usuario: usuarioLogado.username,
        mensagem: texto,
        perfil: usuarioLogado.perfil
    }]);

    if(!error) input.value = '';
}

function addMsg(msg, isHistory) {
    const c = document.getElementById('chat-messages');
    if(!c) return;
    const me = msg.usuario === usuarioLogado.username;
    const nome = cacheNomesChat[msg.usuario] || msg.usuario;

    const msgHtml = `
        <div class="flex flex-col ${me ? 'items-end' : 'items-start'} mb-2 animate-fade-in">
            <span class="text-[9px] text-slate-400 font-bold px-1">${me ? '' : nome}</span>
            <div class="px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm 
                ${me ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}">
                ${msg.mensagem}
            </div>
        </div>`;
    
    c.insertAdjacentHTML('beforeend', msgHtml);
    c.scrollTop = c.scrollHeight;

    // Alerta de nova mensagem se o chat estiver fechado
    if (!isHistory && !chatAberto && !me) {
        document.getElementById('badge-unread').classList.remove('hidden');
        document.getElementById('chat-toggle-btn').classList.add('animate-bounce', 'bg-orange-500');
    }
}
