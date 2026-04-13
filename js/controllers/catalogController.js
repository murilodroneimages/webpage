const CatalogController = {
  apiUrl: "https://aiqpxlxrynlfyylsrrrl.supabase.co/functions/v1/manage-catalog",
  productList: [],

  init: function() {
    this.bindEvents();
    this.loadData();
  },

  bindEvents: function() {
    const form = document.getElementById('catalogForm');
    form.replaceWith(form.cloneNode(true));
    document.getElementById('catalogForm').addEventListener('submit', (e) => this.saveData(e));
  },

  getToken: function() {
    const session = JSON.parse(localStorage.getItem('lojabot_session'));
    return session?.access_token || '';
  },

  showAlert: function(msg, type) {
    const box = document.getElementById('catalogAlertBox');
    box.className = `mb-4 p-4 text-sm rounded-md flex items-center gap-2 ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
    document.getElementById('catalogAlertIcon').className = type === 'success' ? 'ph ph-check-circle text-lg' : 'ph ph-warning-circle text-lg';
    document.getElementById('catalogAlertMessage').textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 5000);
  },

  loadData: async function() {
    const tbody = document.getElementById('catalogTableBody');
    try {
      const res = await fetch(this.apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        this.productList = data.result || [];
        this.renderTable();
      } else throw new Error(data.error);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Erro ao carregar catálogo.</td></tr>`;
    }
  },

  renderTable: function() {
    const tbody = document.getElementById('catalogTableBody');
    if (this.productList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Nenhum produto cadastrado.</td></tr>`;
      return;
    }

    let html = '';
    this.productList.forEach(prod => {
      const statusBadge = prod.disponivel 
        ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>`
        : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Indisponível</span>`;
      
      const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.valor_un);

      html += `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4">
            <div class="text-sm font-medium text-gray-900">${prod.nome_produto}</div>
            <div class="text-xs text-gray-500">SKU: ${prod.sku}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${precoFormatado}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${prod.qtd} un.</td>
          <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="CatalogController.openModal(${prod.id})" class="text-blue-600 hover:text-blue-900 mr-3"><i class="ph ph-pencil-simple text-lg"></i></button>
            <button onclick="CatalogController.deleteData(${prod.id})" class="text-red-600 hover:text-red-900"><i class="ph ph-trash text-lg"></i></button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  },

  openModal: function(id = null) {
    document.getElementById('catalogForm').reset();
    document.getElementById('prod_id').value = '';
    document.getElementById('catalogModalAlert').classList.add('hidden');
    const title = document.getElementById('catalogModalTitle');
    
    if (id) {
      title.textContent = "Editar Produto";
      const prod = this.productList.find(p => p.id === id);
      if (prod) {
        document.getElementById('prod_id').value = prod.id;
        document.getElementById('prod_nome').value = prod.nome_produto;
        document.getElementById('prod_sku').value = prod.sku;
        document.getElementById('prod_valor').value = prod.valor_un;
        document.getElementById('prod_qtd').value = prod.qtd;
        document.getElementById('prod_descricao').value = prod.descricao || '';
        document.getElementById('prod_imagem').value = prod.imagens_urls || '';
        document.getElementById('prod_disponivel').checked = prod.disponivel;
      }
    } else {
      title.textContent = "Novo Produto";
      document.getElementById('prod_disponivel').checked = true;
    }
    
    document.getElementById('catalogModal').classList.remove('hidden');
  },

  closeModal: function() {
    document.getElementById('catalogModal').classList.add('hidden');
  },

  saveData: async function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveCatalogBtn');
    const alertBox = document.getElementById('catalogModalAlert');
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Salvando...';
    btn.disabled = true;
    alertBox.classList.add('hidden');

    const id = document.getElementById('prod_id').value;
    const payload = {
      sku: document.getElementById('prod_sku').value,
      nome_produto: document.getElementById('prod_nome').value,
      valor_un: parseFloat(document.getElementById('prod_valor').value),
      qtd: parseInt(document.getElementById('prod_qtd').value),
      descricao: document.getElementById('prod_descricao').value,
      imagens_urls: document.getElementById('prod_imagem').value,
      disponivel: document.getElementById('prod_disponivel').checked
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
        this.showAlert(data.message, 'success');
        this.loadData();
      } else {
        alertBox.textContent = data.error;
        alertBox.classList.remove('hidden');
      }
    } catch (e) {
      alertBox.textContent = "Erro de conexão.";
      alertBox.classList.remove('hidden');
    } finally {
      btn.innerHTML = '<i class="ph ph-floppy-disk text-lg"></i> Salvar';
      btn.disabled = false;
    }
  },

  deleteData: async function(id) {
    if (!confirm("Excluir este produto permanentemente?")) return;
    try {
      const res = await fetch(this.apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
        body: JSON.stringify({ id: id })
      });
      if (res.ok) {
        this.showAlert("Produto excluído.", 'success');
        this.loadData();
      }
    } catch (e) {
      this.showAlert("Erro ao excluir.", 'error');
    }
  }
};
