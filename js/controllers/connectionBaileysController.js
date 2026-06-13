/**
 * ConnectionBaileysController
 * Gerenciador de Estado do Frontend para o Motor de WebSockets Direto (Baileys)
 */
const ConnectionBaileysController = {
  socket: null,
  tenantId: null,
  timerInterval: null,
  timeLeft: 20,
  isProcessingAction: false, // Flag anti-clique duplo para evitar lag de requisições

  init: function() {
    // 1. Extração segura do Tenant
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) return window.location.href = '/webpage/login.html';
    
    this.tenantId = JSON.parse(tenantStr).id;

    // 2. Roteamento Inteligente de Portas (Baileys roda na 3002)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3002' : 'https://chatbotapi.mooo.com:3002';

    // 3. Gerenciamento Single-Instance do Socket para evitar estouro de listeners
    if (this.socket && this.socket.connected) {
      this.socket.emit('request_current_status', this.tenantId);
      this.bindDOMEvents();
      return;
    }

    this.socket = io(serverUrl, { 
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    this.bindSocketEvents();
    this.bindDOMEvents();
  },

  bindDOMEvents: function() {
    const btnStart = document.getElementById('btn-start-session');
    const btnShowQR = document.getElementById('btn-show-qr');

    if (btnStart) {
      btnStart.onclick = () => {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Alocando canais de memória na Oracle Cloud...';
        
        this.socket.emit('action_start_session', this.tenantId);
        
        setTimeout(() => { this.isProcessingAction = false; }, 1000);
      };
    }

    if (btnShowQR) {
      btnShowQR.onclick = () => {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Recuperando chaves seguras do buffer...';
        
        this.socket.emit('action_get_qr', this.tenantId);

        setTimeout(() => { this.isProcessingAction = false; }, 1000);
      };
    }
  },

  bindSocketEvents: function() {
    this.socket.on('connect', () => {
      console.log('[Lojabot] Sincronizado com o ecossistema Baileys. Requisitando estado...');
      this.socket.emit('request_current_status', this.tenantId);
    });

    // Ouvinte Único Centralizado (Garante que o backend dita o estado da tela)
    this.socket.on('whatsapp_status', (data) => {
      console.log('[Lojabot] Mudança de estado reportada pelo motor:', data.state);
      
      switch (data.state) {
        case 'DISCONNECTED':
          this.stopCountdown();
          this.switchState('disconnected');
          break;
        case 'STARTING':
          this.switchState('loading');
          break;
        case 'QR_READY':
          // Se o temporizador já estiver rodando, significa que o usuário já abriu o QR. 
          // Não tiramos ele da tela se novos QRs de atualização chegarem em background.
          const isCurrentlyViewingQR = !document.getElementById('state-qr-visible').classList.contains('hidden');
          if (!isCurrentlyViewingQR) {
            this.switchState('qr-ready');
          } else {
            // Se ele já está vendo, renovamos a imagem silenciosamente
            this.socket.emit('action_get_qr', this.tenantId);
          }
          break;
        case 'CONNECTED':
          this.stopCountdown();
          this.showConnected(data.number);
          break;
      }
    });

    this.socket.on('deliver_qr_code', (qrBase64) => {
      this.switchState('qr-visible');
      document.getElementById('qr-image').src = qrBase64;
      this.startCountdown();
    });

    this.socket.on('disconnect', () => {
      console.warn('[Lojabot] Ligação perdida com o servidor. Aguardando re-sincronização...');
      this.switchState('loading');
      document.getElementById('loading-text').textContent = 'A reestabelecer ligação com o motor...';
    });
  },

  // =========================================================
  // SISTEMA DE RELÓGIO REATIVO (UX ANTI-LAG)
  // =========================================================
  
  startCountdown: function() {
    this.stopCountdown(); // Elimina vazamento de memória se houver outro intervalo ativo
    this.timeLeft = 20;
    const timerEl = document.getElementById('qr-timer');
    timerEl.textContent = this.timeLeft;

    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      timerEl.textContent = this.timeLeft;

      // Alerta de Usabilidade: Se faltar menos de 5 segundos, mudamos a atenção visual do contador
      if (this.timeLeft <= 5) {
        timerEl.classList.add('animate-pulse');
      } else {
        timerEl.classList.remove('animate-pulse');
      }

      if (this.timeLeft <= 0) {
        this.stopCountdown();
        // Quando o timer do front bate zero, ele volta para o estado estável de QR_READY
        this.switchState('qr-ready');
      }
    }, 1000);
  },

  stopCountdown: function() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  switchState: function(stateName) {
    const states = ['disconnected', 'loading', 'qr-ready', 'qr-visible', 'connected'];
    states.forEach(s => {
      const el = document.getElementById(`state-${s}`);
      if (el) {
        if (s === stateName) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });
  },

  showConnected: function(number) {
    this.switchState('connected');
    const el = document.getElementById('connected-number');
    if (el) el.textContent = `+${number}`;
  }
};

// Auto-inicialização segura no carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  ConnectionBaileysController.init();
});
