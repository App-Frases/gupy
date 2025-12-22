// js/utils.js

// Remove acentos e deixa minúsculo (para buscas)
function normalizar(t) { 
    return t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""; 
}

// Formata texto (Capitalize ou Título)
function formatarTextoBonito(t, tipo) { 
    if (!t) return ""; 
    let l = t.trim().replace(/\s+/g, ' '); 
    if (tipo === 'titulo') return l.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()); 
    return l.charAt(0).toUpperCase() + l.slice(1); 
}

// Nova função que criamos na última correção (agora acessível a todos)
function padronizarFraseInteligente(texto) {
    if (!texto) return "";
    const t = texto.trim().replace(/\s+/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// Máscara para Data DD/MM/AAAA
function mascaraData(i) { 
    let v = i.value.replace(/\D/g, ""); 
    if(v.length>2) v=v.substring(0,2)+"/"+v.substring(2); 
    if(v.length>5) v=v.substring(0,5)+"/"+v.substring(5,9); 
    i.value = v; 
}

// Log do Sistema (função global auxiliar)
async function registrarLog(acao, detalhe) { 
    if(usuarioLogado) {
        // Usa _supabase global definido em config.js
        await _supabase.from('logs').insert([{
            usuario: usuarioLogado.username, 
            acao: acao, 
            detalhe: detalhe
        }]); 
    }
}
