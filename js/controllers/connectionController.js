const ConnectionController = {
  socket: null,
  tenantId: null,

  init: function() {
    // 1. Blindagem contra LocalStorage vazio ou corrompido
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) {
      console.error("❌ Tentativa de acesso sem tenant. Redirecionando...");
      window.location.href = '/webpage/login.html';
      return;
    }

    // Previne crash fatal caso a string salva no navegador não seja um JSON válido
    try {
      this.tenantId = JSON.parse(tenantStr).id;
    } catch (e) {
      console.error("❌ Dados de sessão corrompidos. Limpando e redirecionando...");
      localStorage.removeItem('lojabot_tenant');
      window.location.href = '/webpage/login.html';
      return;
    }

    // 2. Setup da URL Dinâmica
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Dica: Quando configurar SSL no Nginx, altere para https:// no servidor de produção
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'http://chatbotapi.mooo.com';

    // 3. Prevenção de Múltiplas Conexões (Padrão Singleton)
    if (this.socket) {
      if (this.socket.connected) {
        console.log('⚡ Socket já conectado. Requisitando status atualizado...');
        this.socket.emit('join_tenant_room', this.tenantId);
        return;
      } else {
        // Se o objeto existe mas a conexão caiu, forçamos a reconexão nativa
        this.socket.connect();
        return;
      }
    }

    // 4. Primeira Instanciação com resiliência de rede
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Força estabilidade passando pelo Proxy
      reconnection: true,                   // Tenta reconectar automaticamente
      reconnectionAttempts: Infinity,       // Não desiste de reconectar
      reconnectionDelay: 2000               // Espera 2 segundos entre as tentativas
    });
    
    this.bindEvents();
  },

  bindEvents: function() {
    // Limpa ouvintes antigos para evitar vazamento de memória (Memory Leak) na navegação da SPA
    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor Node.js');
      this.socket.emit('join_tenant_room', this.tenantId);
      
      // Restaura o texto original caso estivesse em erro
      this.safeUpdateDOM('connection-title', 'textContent', 'Conexão Estabelecida');
      this.safeUpdateDOM('connection-subtitle', 'textContent', 'Aguardando status do WhatsApp...');
    });

    // Tratamento de Queda de Servidor (Feedback visual seguro)
    this.socket.on('connect_error', (err) => {
      console.error('Falha na conexão WebSocket:', err.message);
      this.safeUpdateDOM('connection-title', 'textContent', "Servidor Indisponível");
      this.safeUpdateDOM('connection-subtitle', 'textContent', "Tentando reconectar automaticamente...");
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

  // =======================================================================
  // HELPERS DE BLINDAGEM DE DOM (O Segredo das SPAs Robustas)
  // =======================================================================

  /**
   * Atualiza uma propriedade de um elemento HTML apenas se ele existir na tela.
   */
  safeUpdateDOM: function(elementId, property, value) {
    const el = document.getElementById(elementId);
    if (el) {
      el[property] = value;
    }
  },

  /**
   * Adiciona ou remove uma classe CSS de um elemento HTML apenas se ele existir.
   */
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
