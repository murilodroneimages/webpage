const ConnectionController = {
  socket: null,
  tenantId: null,
  isProcessing: false,
  currentPairingCode: null,

  init: function() {
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) {
      window.location.href = '/webpage/login.html';
      return;
    }
    
    this.tenantId = JSON.parse(tenantStr).id;

    // Configuração de URL baseada no ambiente
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalhost ? 'http://localhost:3001' : 'https://chatbotapi.mooo.com';

    // Evita duplicação de sockets
    if (this.socket && this.socket.connected) {
      this.socket.emit('request_current_status', this.tenantId);
      this.bindDOMEvents();
      return;
    }

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });
    this.bindSocketEvents();
    this.bindDOMEvents();
    this.bindInputMasks();
  },

  // ==========================================
  // COMUNICAÇÃO COM O SERVIDOR (WEBSOCKETS)
  // ==========================================
  bindSocketEvents: function() {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao Gateway Node.js. Solicitando estado da FSM...');
      this.socket.emit('request_current_status', this.tenantId);
    });

    this.socket.on('whatsapp_status', (data) => {
      console.log(`📊 Transição de Estado Recebida: [${data.state}]`);
      this.isProcessing = false; 
      
      switch(data.state) {
        case 'DISCONNECTED':
          // Se houve erro de rede ou o código expirou/foi recusado
          this.currentPairingCode = null;
          this.switchState('disconnected');
          if (data.error) {
            this.showError(data.error);
          }
          break;
          
        case 'STARTING':
          this.hideError();
          this.switchState('loading');
          this.updateLoadingText('A alocar instância segura nos servidores...');
          break;
          
        case 'PAIRING_CODE_READY':
          // REGRA 2: Servidor gerou o código. Escondemos e mostramos o botão de revelar.
          if (data.code) {
            this.currentPairingCode = data.code;
            this.switchState('pairing-ready');
          } else {
            console.error("Erro Crítico: Estado PAIRING_CODE_READY recebido sem o código no payload.");
            this.showError("Ocorreu uma falha na geração do código. Tente novamente.");
            this.switchState('disconnected');
          }
          break;
          
        case 'CONNECTED':
          // REGRA 4: WhatsApp conectado. Sucesso total.
          this.currentPairingCode = null;
          this.switchState('connected');
          this.renderConnectedNumber(data.number);
          break;
      }
    });

    this.socket.on('disconnect', () => {
      this.switchState('loading');
      this.updateLoadingText('A rede caiu. Tentando reestabelecer ligação...');
    });
  },

  // ==========================================
  // EVENTOS DE INTERAÇÃO DO UTILIZADOR
  // ==========================================
  bindDOMEvents: function() {
    const btnRequestCode = document.getElementById('btn-request-code');
    const btnShowCode = document.getElementById('btn-show-code');
    const btnCancel1 = document.getElementById('btn-cancel-pairing-1');
    const btnCancel2 = document.getElementById('btn-cancel-pairing-2');

    // REGRA 1: Validar input e pedir código
    if (btnRequestCode) {
      btnRequestCode.onclick = () => {
        if (this.isProcessing) return;
        this.hideError();

        const ddi = document.getElementById('country-code').value;
        const phoneInput = document.getElementById('phone-number').value;
        const cleanPhone = phoneInput.replace(/\D/g, ''); // Garante apenas números

        if (cleanPhone.length < 10) {
          this.showError("Por favor, digite um número válido com o código de área (DDD).");
          return;
        }

        const fullNumber = `${ddi}${cleanPhone}`;
        
        this.isProcessing = true;
        this.switchState('loading');
        this.updateLoadingText('A solicitar credenciais à Meta...');
        
        this.socket.emit('action_request_pairing_code', { 
            tenantId: this.tenantId, 
            phoneNumber: fullNumber 
        });
      };
    }

    // REGRA 3: O utilizador atesta que está pronto para ver o código
    if (btnShowCode) {
      btnShowCode.onclick = () => {
        if (!this.currentPairingCode) {
          this.showError("O código expirou da memória. Por favor, gere novamente.");
          this.switchState('disconnected');
          return;
        }
        this.renderPairingCode(this.currentPairingCode);
      };
    }

    // Fluxos de Cancelamento (Reseta a interface)
    const handleCancel = () => {
      this.currentPairingCode = null;
      document.getElementById('phone-number').value = ''; // Limpa o campo
      this.switchState('disconnected');
    };

    if (btnCancel1) btnCancel1.onclick = handleCancel;
    if (btnCancel2) btnCancel2.onclick = handleCancel;
  },

  bindInputMasks: function() {
    // Impede o utilizador de colar letras ou símbolos no campo de telefone
    const phoneInput = document.getElementById('phone-number');
    if (phoneInput) {
      phoneInput.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    }
  },

  // ==========================================
  // MANIPULAÇÃO DO DOM E ESTADOS VISUAIS
  // ==========================================

  switchState: function(stateName) {
    const states = ['disconnected', 'loading', 'pairing-ready', 'pairing-visible', 'connected'];
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

  showError: function(message) {
    const errorBox = document.getElementById('error-alert');
    const errorMsg = document.getElementById('error-message');
    if (errorBox && errorMsg) {
      errorMsg.textContent = message;
      errorBox.classList.remove('hidden');
    }
  },

  hideError: function() {
    const errorBox = document.getElementById('error-alert');
    if (errorBox) errorBox.classList.add('hidden');
  },

  updateLoadingText: function(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
  },

  renderPairingCode: function(rawCode) {
    this.switchState('pairing-visible');
    const displayEl = document.getElementById('pairing-code-display');
    
    if (displayEl && rawCode) {
      try {
        // Ex: De "ABCD1234" para "ABCD - 1234"
        const cleanCode = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
        const formattedCode = cleanCode.match(/.{1,4}/g).join(' - ');
        displayEl.textContent = formattedCode;
      } catch (err) {
        console.warn("[FSM] Falha ao formatar código. A exibir em modo raw.", err);
        displayEl.textContent = rawCode; 
      }
    }
  },

  renderConnectedNumber: function(number) {
    const el = document.getElementById('connected-number');
    if (el && number) {
      // Garante formatação internacional bonita na tela final
      const strNum = String(number);
      el.textContent = strNum.startsWith('+') ? strNum : `+${strNum}`;
    }
  }
};

// Injeta o controlador quando o DOM estiver completamente pronto
document.addEventListener('DOMContentLoaded', () => {
    ConnectionController.init();
});
