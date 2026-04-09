const AgentController = {
  apiUrl: "https://aiqpxlxrynlfyylsrrrl.supabase.co/functions/v1/manage-agent-instruction",
  agentsList: [], // Guarda os dados em memória para não precisar fazer fetch ao clicar em Editar
  isModalBotEnabled: true,

  init: function() {
    this.bindEvents();
    this.loadData();
  },

  bindEvents: function() {
    const toggleBtn = document.getElementById('toggle-bot');
    const form = document.getElementById('agentForm');

    // Remove listeners antigos para evitar duplicação em SPAs
    toggleBtn.replaceWith(toggleBtn.cloneNode(true));
    form.replaceWith(form.cloneNode(true));
    
    document.getElementById('toggle-bot').addEventListener('click', () => this.toggleBotStatus());
    document.getElementById('agentForm').addEventListener('submit', (e) => this.saveData(e));
  },

  getToken: function() {
    const session = JSON.parse(localStorage.getItem('lojabot_session'));
    return session?.access_token || '';
  },

  showMainAlert: function(msg, type) {
    const box = document.getElementById('mainAlertBox');
    box.className = `mb-4 p-4 text-sm rounded-md flex items-center gap-2 ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
    document.getElementById('mainAlertIcon').className = type === 'success' ? 'ph ph-check-circle text-lg' : 'ph ph-warning-circle text-lg';
    document.getElementById('mainAlertMessage').textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 5000);
  },

  // ==========================================
  // LÓGICA DE TABELA E FETCH
  // ==========================================
  loadData: async function() {
    const tbody = document.getElementById('agentTableBody');
    try {
      const res = await fetch(this.apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        this.agentsList = data.result || [];
        this.renderTable();
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro ao carregar dados.</td></tr>`;
    }
  },

  renderTable: function() {
    const tbody = document.getElementById('agentTableBody');
    if (this.agentsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">Nenhum agente cadastrado. Clique em "Novo Agente" para criar.</td></tr>`;
      return;
    }

    let html = '';
    this.agentsList.forEach(agent => {
      const statusBadge = agent.habilitado 
        ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>`
        : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Pausado</span>`;
      
      const dateStr = new Date(agent.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });

      html += `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${agent.nome_agente}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dateStr}</td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="AgentController.openModal(${agent.id})" class="text-blue-600 hover:text-blue-900 mr-3" title="Editar"><i class="ph ph-pencil-simple text-lg"></i></button>
            <button onclick="AgentController.deleteData(${agent.id})" class="text-red-600 hover:text-red-900" title="Excluir"><i class="ph ph-trash text-lg"></i></button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  },

  // ==========================================
  // LÓGICA DO MODAL
  // ==========================================
  openModal: function(id = null) {
    this.clearForm();
    const modal = document.getElementById('agentModal');
    const title = document.getElementById('modalTitle');
    
    if (id) {
      // É uma EDIÇÃO: Preenche os campos
      title.textContent = "Editar Instrução do Agente";
      const agent = this.agentsList.find(a => a.id === id);
      if (agent) {
        document.getElementById('agent_id').value = agent.id;
        document.getElementById('nome_agente').value = agent.nome_agente;
        document.getElementById('instrucao_agente').value = agent.instrucao_agente;
        if (!agent.habilitado) this.toggleBotStatus(false);
      }
    } else {
      // É um NOVO
      title.textContent = "Cadastrar Novo Agente";
    }
    
    modal.classList.remove('hidden');
  },

  closeModal: function() {
    document.getElementById('agentModal').classList.add('hidden');
    document.getElementById('modalAlert').classList.add('hidden');
  },

  clearForm: function() {
    document.getElementById('agent_id').value = '';
    document.getElementById('nome_agente').value = '';
    document.getElementById('instrucao_agente').value = '';
    this.toggleBotStatus(true); // Reseta para habilitado por padrão
    document.getElementById('modalAlert').classList.add('hidden');
  },

  toggleBotStatus: function(forceState = null) {
    this.isModalBotEnabled = forceState !== null ? forceState : !this.isModalBotEnabled;
    const btn = document.getElementById('toggle-bot');
    const knob = document.getElementById('toggle-knob');
    const txt = document.getElementById('status-text');

    if (this.isModalBotEnabled) {
      btn.classList.replace('bg-gray-200', 'bg-blue-600');
      knob.classList.replace('translate-x-0', 'translate-x-5');
      txt.textContent = "Habilitado";
      txt.classList.replace('text-gray-500', 'text-blue-700');
    } else {
      btn.classList.replace('bg-blue-600', 'bg-gray-200');
      knob.classList.replace('translate-x-5', 'translate-x-0');
      txt.textContent = "Pausado";
      txt.classList.replace('text-blue-700', 'text-gray-500');
    }
  },

  // ==========================================
  // SALVAR E DELETAR (API)
  // ==========================================
  saveData: async function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveAgentBtn');
    const alertBox = document.getElementById('modalAlert');
    
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Salvando...';
    btn.disabled = true;
    alertBox.classList.add('hidden');

    const id = document.getElementById('agent_id').value;
    const payload = {
      nome_agente: document.getElementById('nome_agente').value,
      instrucao_agente: document.getElementById('instrucao_agente').value,
      habilitado: this.isModalBotEnabled
    };
    if (id) payload.id = parseInt(id);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        this.closeModal();
        this.showMainAlert(data.message, 'success');
        this.loadData(); // 🔥 Atualiza a tabela imediatamente
      } else {
        alertBox.textContent = data.error;
        alertBox.classList.remove('hidden');
      }
    } catch (e) {
      alertBox.textContent = "Erro de conexão com o servidor.";
      alertBox.classList.remove('hidden');
    } finally {
      btn.innerHTML = '<i class="ph ph-floppy-disk text-lg"></i> Salvar';
      btn.disabled = false;
    }
  },

  deleteData: async function(id) {
    if (!confirm("Tem certeza que deseja excluir esta instrução? A IA não poderá mais utilizá-la.")) return;

    try {
      const res = await fetch(this.apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
        body: JSON.stringify({ id: id })
      });
      const data = await res.json();
      
      if (res.ok) {
        this.showMainAlert("Instrução excluída com sucesso.", 'success');
        this.loadData(); // Atualiza a tabela
      } else {
        this.showMainAlert(data.error, 'error');
      }
    } catch (e) {
      this.showMainAlert("Erro de conexão.", 'error');
    }
  }
};
