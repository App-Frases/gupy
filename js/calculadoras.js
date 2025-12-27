// Local: js/calculadoras.js

let modoCalculadora = 'intervalo';

function alternarModoCalculadora(modo) {
    modoCalculadora = modo;
    
    // Atualiza botões
    const btnIntervalo = document.getElementById('btn-mode-intervalo');
    const btnSoma = document.getElementById('btn-mode-soma');
    const tabIntervalo = document.getElementById('tab-calc-intervalo');
    const tabSoma = document.getElementById('tab-calc-soma');

    if (modo === 'intervalo') {
        btnIntervalo.className = "flex-1 py-2 rounded-l-xl font-bold text-sm bg-blue-600 text-white shadow-md transition";
        btnSoma.className = "flex-1 py-2 rounded-r-xl font-bold text-sm bg-slate-100 text-slate-500 hover:bg-slate-200 transition";
        tabIntervalo.classList.remove('hidden');
        tabSoma.classList.add('hidden');
    } else {
        btnIntervalo.className = "flex-1 py-2 rounded-l-xl font-bold text-sm bg-slate-100 text-slate-500 hover:bg-slate-200 transition";
        btnSoma.className = "flex-1 py-2 rounded-r-xl font-bold text-sm bg-blue-600 text-white shadow-md transition";
        tabIntervalo.classList.add('hidden');
        tabSoma.classList.remove('hidden');
    }
}

// --- MODO 1: INTERVALO (Diferença entre datas) ---
function calcularDatas() {
    const val = document.getElementById('nasc-input').value;
    if(val.length !== 10) return Swal.fire('Data incompleta', 'Formato DD/MM/AAAA', 'warning');
    
    const parts = val.split('/'); 
    const dAlvo = new Date(parts[2], parts[1]-1, parts[0]);
    const hoje = new Date(); 
    dAlvo.setHours(0,0,0,0); hoje.setHours(0,0,0,0);
    
    if (isNaN(dAlvo.getTime())) return Swal.fire('Erro', 'Data inválida', 'error');

    // CORREÇÃO: Permitir datas futuras
    const isFuturo = dAlvo > hoje;
    const diffTime = Math.abs(dAlvo - hoje);
    const totalDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let anos = 0, meses = 0, dias = 0;
    
    // Lógica precisa de calendário
    const d1 = isFuturo ? hoje : dAlvo;
    const d2 = isFuturo ? dAlvo : hoje;

    anos = d2.getFullYear() - d1.getFullYear();
    meses = d2.getMonth() - d1.getMonth();
    dias = d2.getDate() - d1.getDate();

    if (dias < 0) {
        meses--;
        dias += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }

    const semanas = Math.floor(totalDias / 7);

    // Atualiza UI
    document.getElementById('data-nasc-display').innerText = val;
    document.getElementById('res-total-dias').innerText = totalDias.toLocaleString('pt-BR');
    
    // Muda a cor e texto dependendo se é futuro ou passado
    const labelStatus = document.getElementById('label-status-data');
    if (isFuturo) {
        labelStatus.innerHTML = '<span class="text-indigo-500"><i class="fas fa-hourglass-half mr-1"></i>Faltam</span>';
        document.getElementById('box-destaque-data').className = "bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 flex flex-col justify-center items-center text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden group";
    } else {
        labelStatus.innerHTML = '<span class="text-blue-200"><i class="fas fa-history mr-1"></i>Passaram</span>';
        document.getElementById('box-destaque-data').className = "bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4 flex flex-col justify-center items-center text-white shadow-xl shadow-blue-200/50 relative overflow-hidden group";
    }

    document.getElementById('res-anos').innerText = anos;
    document.getElementById('res-meses').innerText = meses;
    document.getElementById('res-semanas').innerText = semanas;
    document.getElementById('res-dias').innerText = dias;
    
    document.getElementById('idade-resultado-box').classList.remove('hidden');
}

// --- MODO 2: SOMA (Data + Dias) ---
function calcularSomaDias() {
    const valData = document.getElementById('soma-start-input').value;
    const valDias = parseInt(document.getElementById('soma-days-input').value);

    if(valData.length !== 10) return Swal.fire('Data incompleta', 'Formato DD/MM/AAAA', 'warning');
    if(isNaN(valDias)) return Swal.fire('Erro', 'Digite a quantidade de dias', 'warning');

    const parts = valData.split('/'); 
    const dataBase = new Date(parts[2], parts[1]-1, parts[0]);
    
    if (isNaN(dataBase.getTime())) return Swal.fire('Erro', 'Data inválida', 'error');

    // Adiciona os dias
    const dataFinal = new Date(dataBase);
    dataFinal.setDate(dataBase.getDate() + valDias);

    const dia = String(dataFinal.getDate()).padStart(2, '0');
    const mes = String(dataFinal.getMonth() + 1).padStart(2, '0');
    const ano = dataFinal.getFullYear();
    const diaSemana = dataFinal.toLocaleDateString('pt-BR', { weekday: 'long' });

    // Exibe Resultado
    document.getElementById('res-soma-data').innerText = `${dia}/${mes}/${ano}`;
    document.getElementById('res-soma-semana').innerText = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    
    document.getElementById('soma-resultado-box').classList.remove('hidden');
}

// --- CEP (Movido do app.js para cá) ---
async function buscarCEP() {
    const cep = document.getElementById('cep-input').value.replace(/\D/g, ''); 
    const resArea = document.getElementById('cep-resultado'); 
    const loading = document.getElementById('cep-loading');
    if(cep.length !== 8) return Swal.fire('Atenção', 'Digite um CEP válido', 'warning');
    resArea.classList.add('hidden'); loading.classList.remove('hidden');
    try { 
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`); 
        const data = await res.json(); 
        loading.classList.add('hidden');
        if(data.erro) return Swal.fire('Não Encontrado', 'CEP não existe', 'info');
        document.getElementById('cep-logradouro').innerText = data.logradouro || '---'; 
        document.getElementById('cep-bairro').innerText = data.bairro || '---'; 
        document.getElementById('cep-localidade').innerText = `${data.localidade}-${data.uf}`;
        document.getElementById('cep-display-num').innerText = cep.replace(/^(\d{5})(\d{3})/, "$1-$2");
        resArea.classList.remove('hidden');
    } catch(e) { loading.classList.add('hidden'); Swal.fire('Erro', 'Falha na conexão', 'error'); }
}

// Funções de Header (atalhos)
function calcularIdadeHeader() {
    const val = document.getElementById('quick-idade').value;
    if(val.length === 10) { 
        document.getElementById('nasc-input').value = val; 
        calcularDatas(); 
        document.getElementById('quick-idade').value = ''; 
        document.getElementById('modal-idade').classList.remove('hidden'); 
        alternarModoCalculadora('intervalo'); // Força a aba correta
    }
}
function buscarCEPHeader() {
    const val = document.getElementById('quick-cep').value;
    if(val.length >= 8) { 
        document.getElementById('cep-input').value = val; 
        buscarCEP(); 
        document.getElementById('quick-cep').value = ''; 
        document.getElementById('modal-cep').classList.remove('hidden'); 
    }
}
