const ConnectionController = {
  socket: null,
  tenantId: null,

  init: function() {
    // 1. Blindagem contra LocalStorage vazio (Usuário deslogado)
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) {
      console.error("❌ Tentativa de acesso sem tenant. Redirecionando...");
      window.location.href = '/webpage/login.html';
      return;
    }
    
    this.tenantId = JSON.parse(tenantStr).id;

    // 2. Prevenção de Múltiplas Conexões (Padrão Singleton)
    if (this.socket && this.socket.connected) {
      console.log('⚡ Socket já conectado. Requisitando status atualizado...');
      // Apenas pede para o servidor mandar o status de novo, sem criar nova conexão
      this.socket.emit('join_tenant_room', this.tenantId);
      return;
    }

    // 3. Setup da URL Dinâmica (Facilita quando for para a Oracle Cloud)
    // Se o frontend estiver rodando no seu PC, usa localhost. Se estiver no Github Pages, usa o IP da sua VPS.
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'http://SEU_IP_DA_ORACLE_AQUI:3001'; 
    
    this.socket = io(serverUrl);
    this.bindEvents();
  },

  bindEvents: function() {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor Node.js');
      this.socket.emit('join_tenant_room', this.tenantId);
    });

    // 4. Tratamento de Queda de Servidor (Feedback visual vital para o cliente)
    this.socket.on('connect_error', (err) => {
      console.error('Falha na conexão WebSocket:', err.message);
      document.getElementById('connection-title').textContent = "Servidor Indisponível";
      document.getElementById('connection-subtitle').textContent = "Tentando reconectar automaticamente...";
    });

    this.socket.on('whatsapp_status', (data) => {
      if (data.state === 'WAITING_QR' || data.state === 'DISCONNECTED') {
        this.showQRCard();
      } else if (data.state === 'CONNECTED') {
        this.showConnectedCard(data.number, data.time);
      }
    });

    this.socket.on('whatsapp_qr', (qrBase64Image) => {
      this.showQRCard();
      document.getElementById('qr-image').src = qrBase64Image;
      document.getElementById('qr-image').classList.remove('hidden');
      document.getElementById('qr-loader').classList.add('hidden');
      document.getElementById('connection-title').textContent = "Aguardando Leitura";
    });

    this.socket.on('whatsapp_ready', (data) => {
      this.showConnectedCard(data.number, data.time);
    });
  },

  showQRCard: function() {
    document.getElementById('connected-container').classList.add('hidden');
    document.getElementById('qr-container').classList.remove('hidden');
    document.getElementById('qr-image').classList.add('hidden');
    document.getElementById('qr-loader').classList.remove('hidden');
    document.getElementById('connection-title').textContent = "Gerando código...";
    document.getElementById('connection-subtitle').textContent = "Comunicando com o servidor, aguarde.";
  },

  showConnectedCard: function(number, timeStr) {
    document.getElementById('qr-container').classList.add('hidden');
    document.getElementById('connected-container').classList.remove('hidden');
    
    document.getElementById('connected-number').textContent = `+${number}`;
    const d = new Date(timeStr);
    document.getElementById('connected-time').textContent = d.toLocaleDateString() + ' às ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
};
