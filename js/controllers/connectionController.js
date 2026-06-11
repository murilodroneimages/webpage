const ConnectionController = {
  socket: null,
  tenantId: null,
  timerInterval: null,
  timeLeft: 20,

  init: function() {
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) return window.location.href = '/webpage/login.html';
    
    this.tenantId = JSON.parse(tenantStr).id;

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'https://chatbotapi.mooo.com';

    // Se o socket já existe, garante que pede o status atualizado da sessão
    if (this.socket && this.socket.connected) {
      this.socket.emit('request_current_status', this.tenantId);
      this.bindDOMEvents();
      return;
    }

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });
    this.bindSocketEvents();
    this.bindDOMEvents();
  },

  bindSocketEvents: function() {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor Node.js. Requisitando estado...');
      // Pergunta para a Oracle Cloud: "Como está o motor do meu WhatsApp agora?"
      this.socket.emit('request_current_status', this.tenantId);
    });

    this.socket.on('whatsapp_status', (data) => {
      console.log('📊 Status recebido do servidor:', data.state);
      
      if (data.state === 'DISCONNECTED') {
        this.switchState('disconnected');
      }
      if (data.state === 'STARTING') {
        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Iniciando o navegador no servidor...';
      }
      if (data.state === 'QR_READY') {
        // Se o servidor já gerou o QR nos bastidores, ativa o botão de mostrar imediatamente!
        this.switchState('qr-ready');
      }
      if (data.state === 'CONNECTED') {
        this.showConnected(data.number);
      }
    });

    this.socket.on('deliver_qr_code', (qrBase64) => {
      this.switchState('qr-visible');
      document.getElementById('qr-image').src = qrBase64;
      this.startCountdown();
    });

    this.socket.on('whatsapp_ready', (data) => {
      this.stopCountdown();
      this.showConnected(data.number);
    });
  },

  // Vincula as ações de Clique nos Botões
  bindDOMEvents: function() {
    const btnStart = document.getElementById('btn-start-session');
    const btnShowQR = document.getElementById('btn-show-qr');

    if (btnStart) {
      btnStart.onclick = () => {
        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Iniciando container no servidor...';
        this.socket.emit('action_start_session', this.tenantId);
      };
    }

    if (btnShowQR) {
      btnShowQR.onclick = () => {
        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Buscando imagem segura...';
        this.socket.emit('action_get_qr', this.tenantId);
      };
    }
  },

  // ==========================================
  // HELPERS DE TELA E TIMER
  // ==========================================
  
  startCountdown: function() {
    this.stopCountdown(); // Garante que não tem outro rodando
    this.timeLeft = 20;
    const timerEl = document.getElementById('qr-timer');
    timerEl.textContent = this.timeLeft;

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      timerEl.textContent = this.timeLeft;

      if (this.timeLeft <= 0) {
        this.stopCountdown();
        // O tempo acabou, esconde o QR e volta pro botão "Mostrar QR"
        this.switchState('qr-ready');
      }
    }, 1000);
  },

  stopCountdown: function() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  },

  switchState: function(stateName) {
    const states = ['disconnected', 'loading', 'qr-ready', 'qr-visible', 'connected'];
    states.forEach(s => {
      const el = document.getElementById(`state-${s}`);
      if (el) {
        if (s === stateName) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });
  },

  showConnected: function(number) {
    this.switchState('connected');
    const el = document.getElementById('connected-number');
    if (el) el.textContent = `+${number}`;
  }
};
