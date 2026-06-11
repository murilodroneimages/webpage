const ConnectionController = {
  socket: null,
  tenantId: null,

  init: function() {
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) {
      console.error("❌ Tentativa de acesso sem tenant.");
      window.location.href = '/webpage/login.html';
      return;
    }

    try {
      this.tenantId = JSON.parse(tenantStr).id;
    } catch (e) {
      localStorage.removeItem('lojabot_tenant');
      window.location.href = '/webpage/login.html';
      return;
    }

    // AVISO IMPORTANTE: Se o seu front for para produção (ex: mooo.com), 
    // ele usará o protocolo seguro. Logo, seu servidor DEVE usar https://.
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'https://chatbotapi.mooo.com';

    // Gerenciamento Singleton com Reconexão
    if (this.socket) {
      if (this.socket.connected) {
        console.log('⚡ Socket conectado. Requisitando status...');
        this.socket.emit('join_tenant_room', this.tenantId);
      } else {
        console.log('⚡ Reconectando socket...');
        this.socket.connect();
      }
      return; // Se o socket já existe, NÃO rodamos o bindEvents() novamente!
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000
    });
    
    this.bindEvents();
  },

  bindEvents: function() {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor Node.js');
      this.socket.emit('join_tenant_room', this.tenantId);
      
      this.safeUpdateDOM('connection-title', 'textContent', 'Conexão Estabelecida');
      this.safeUpdateDOM('connection-subtitle', 'textContent', 'Aguardando status do WhatsApp...');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Falha na conexão WebSocket:', err.message);
      this.safeUpdateDOM('connection-title', 'textContent', "Servidor Indisponível");
      this.safeUpdateDOM('connection-subtitle', 'textContent', "Verifique o SSL e a rede.");
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
      this.safeUpdateDOM('qr-image', 'src', qrBase64Image);
      this.safeToggleClass('qr-image', 'remove', 'hidden');
      this.safeToggleClass('qr-loader', 'add', 'hidden');
      this.safeUpdateDOM('connection-title', 'textContent', "Aguardando Leitura");
    });

    this.socket.on('whatsapp_ready', (data) => {
      this.showConnectedCard(data.number, data.time);
    });
  },

  safeUpdateDOM: function(elementId, property, value) {
    const el = document.getElementById(elementId);
    if (el) {
      el[property] = value;
    }
  },

  safeToggleClass: function(elementId, action, className) {
    const el = document.getElementById(elementId);
    if (el) {
      if (action === 'add') el.classList.add(className);
      if (action === 'remove') el.classList.remove(className);
    }
  },

  showQRCard: function() {
    this.safeToggleClass('connected-container', 'add', 'hidden');
    this.safeToggleClass('qr-container', 'remove', 'hidden');
    this.safeToggleClass('qr-image', 'add', 'hidden');
    this.safeToggleClass('qr-loader', 'remove', 'hidden');
    
    this.safeUpdateDOM('connection-title', 'textContent', "Gerando código...");
    this.safeUpdateDOM('connection-subtitle', 'textContent', "Comunicando com o servidor, aguarde.");
  },

  showConnectedCard: function(number, timeStr) {
    this.safeToggleClass('qr-container', 'add', 'hidden');
    this.safeToggleClass('connected-container', 'remove', 'hidden');
    
    this.safeUpdateDOM('connected-number', 'textContent', `+${number}`);
    
    const d = new Date(timeStr);
    const formatada = d.toLocaleDateString() + ' às ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    this.safeUpdateDOM('connected-time', 'textContent', formatada);
  }
};
