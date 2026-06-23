const ConnectionController = {
  socket: null,
  tenantId: null,
  isProcessing: false, // Flag de proteção contra cliques múltiplos

  init: function() {
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) return window.location.href = '/webpage/login.html';
    
    this.tenantId = JSON.parse(tenantStr).id;

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'https://chatbotapi.mooo.com';

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
      this.socket.emit('request_current_status', this.tenantId);
    });

    this.socket.on('whatsapp_status', (data) => {
      console.log('📊 Status recebido do servidor:', data.state);
      this.isProcessing = false; // Libera a tela de qualquer processamento pendente
      
      switch(data.state) {
        case 'DISCONNECTED':
          this.switchState('disconnected');
          // Se houver mensagem de erro (ex: bloqueio por spam de código), pode alertar o usuário
          if (data.error) alert(`Aviso do sistema: ${data.error}`);
          break;
        case 'STARTING':
          this.switchState('loading');
          document.getElementById('loading-text').textContent = 'Comunicando com os servidores da Meta...';
          break;
        case 'PAIRING_CODE_READY':
          this.showPairingCode(data.code);
          break;
        case 'CONNECTED':
          this.showConnected(data.number);
          break;
      }
    });

    this.socket.on('disconnect', () => {
      this.switchState('loading');
      document.getElementById('loading-text').textContent = 'Tentando reconectar ao servidor...';
    });
  },

  bindDOMEvents: function() {
    const btnRequestCode = document.getElementById('btn-request-code');

    if (btnRequestCode) {
      btnRequestCode.onclick = () => {
        if (this.isProcessing) return;

        const ddi = document.getElementById('country-code').value;
        const phoneInput = document.getElementById('phone-number').value;
        
        // Remove tudo o que não for número (espaços, traços, parênteses)
        const cleanPhone = phoneInput.replace(/\D/g, '');

        // Validação básica
        if (cleanPhone.length < 10) {
          alert("Por favor, insira um número de telefone válido com o DDD.");
          return;
        }

        const fullNumber = `${ddi}${cleanPhone}`;
        
        this.isProcessing = true;
        this.switchState('loading');
        document.getElementById('loading-text').textContent = 'Gerando código de emparelhamento...';
        
        // Dispara a nova ação criada no backend
        this.socket.emit('action_request_pairing_code', { 
            tenantId: this.tenantId, 
            phoneNumber: fullNumber 
        });
      };
    }
  },

  // ==========================================
  // HELPERS DE TELA E FORMATAÇÃO
  // ==========================================

  switchState: function(stateName) {
    const states = ['disconnected', 'loading', 'pairing-ready', 'connected'];
    states.forEach(s => {
      const el = document.getElementById(`state-${s}`);
      if (el) {
        if (s === stateName) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });
  },

  showPairingCode: function(code) {
    console.log("🎨 A desenhar o Pairing Code no ecrã:", code);
    this.switchState('pairing-ready');
    const displayEl = document.getElementById('pairing-code-display');
    
    if (displayEl && code) {
      try {
        // 🔥 VACINA 3: Remove qualquer formatação suja e força blocos de 4
        const cleanCode = String(code).replace(/[^a-zA-Z0-9]/g, '');
        const formattedCode = cleanCode.match(/.{1,4}/g).join(' - ');
        displayEl.textContent = formattedCode;
      } catch (err) {
        console.error("Erro ao formatar código visualmente:", err);
        displayEl.textContent = code; // Fallback de segurança absoluto
      }
    }
  },
  showConnected: function(number) {
    this.switchState('connected');
    const el = document.getElementById('connected-number');
    if (el) el.textContent = `+${number}`;
  }
};

// Auto-inicialização
document.addEventListener('DOMContentLoaded', () => {
    ConnectionController.init();
});
