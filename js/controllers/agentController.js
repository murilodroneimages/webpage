const AgentController = {
  isBotEnabled: true,
  apiUrl: "https://aiqpxlxrynlfyylsrrrl.supabase.co/functions/v1/manage-agent-instruction",

  // Função chamada pelo router.js logo após injetar o HTML na tela
  init: function() {
    this.bindEvents();
    this.loadData();
  },

  // Vincula os cliques dos botões aos elementos injetados na tela
  bindEvents: function() {
    const toggleBtn = document.getElementById('toggle-bot');
    const form = document.getElementById('agentForm');

    toggleBtn.addEventListener('click', () => {
      this.isBotEnabled = !this.isBotEnabled;
      const knob = document.getElementById('toggle-knob');
      const statusText = document.getElementById('status-text');

      if (this.isBotEnabled) {
        toggleBtn.classList.replace('bg-gray-200', 'bg-blue-600');
        knob.classList.replace('translate-x-0', 'translate-x-5');
        statusText.textContent = "Bot Ativado";
      } else {
        toggleBtn.classList.replace('bg-blue-600', 'bg-gray-200');
        knob.classList.replace('translate-x-5', 'translate-x-0');
        statusText.textContent = "Bot Pausado";
      }
    });

    form.addEventListener('submit', (e) => this.saveData(e));
  },

  showAlert: function(msg, type) {
    const box = document.getElementById('agentAlertBox');
    box.className = `p-4 text-sm mx-6 mt-4 rounded-md flex items-center gap-2 ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
    document.getElementById('agentAlertIcon').className = type === 'success' ? 'ph ph-check-circle text-lg' : 'ph ph-warning-circle text-lg';
    document.getElementById('agentAlertMessage').textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 5000);
  },

  getToken: function() {
    const session = JSON.parse(localStorage.getItem('lojabot_session'));
    return session.access_token;
  },

  loadData: async function() {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      const data = await res.json();
      
      if (res.ok && data.result) {
        document.getElementById('nome_agente').value = data.result.nome_agente || '';
        document.getElementById('instrucao_agente').value = data.result.instrucao_agente || '';
        if (data.result.habilitado === false && this.isBotEnabled) {
          document.getElementById('toggle-bot').click();
        }
      }
    } catch (e) {
      console.error("Erro ao carregar instrução", e);
    }
  },

  saveData: async function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveAgentBtn');
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Salvando...';
    btn.disabled = true;

    const payload = {
      nome_agente: document.getElementById('nome_agente').value,
      instrucao_agente: document.getElementById('instrucao_agente').value,
      habilitado: this.isBotEnabled
    };

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) this.showAlert('Instruções salvas com sucesso!', 'success');
      else this.showAlert(data.error || 'Erro ao salvar configurações.', 'error');
    } catch (e) {
      this.showAlert('Erro de conexão.', 'error');
    } finally {
      btn.innerHTML = '<i class="ph ph-floppy-disk text-lg"></i> Salvar Configurações';
      btn.disabled = false;
    }
  }
};
