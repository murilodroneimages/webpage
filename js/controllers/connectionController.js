const ConnectionController = {
  socket: null,
  tenantId: null,
  isProcessing: false,
  currentPairingCode: null, // Memória isolada para o código

  init: function() {
    const tenantStr = localStorage.getItem('lojabot_tenant');
    if (!tenantStr) {
      window.location.href = '/webpage/login.html';
      return;
    }
    
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

  // ==========================================
  // COMUNICAÇÃO COM O SERVIDOR (WEBSOCKETS)
  // ==========================================
  bindSocketEvents: function() {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao Gateway. Solicitando estado da máquina...');
      this.socket.emit('request_current_status', this.tenantId);
    });

    this.socket.on('whatsapp_status', (data) => {
      console.log(`📊 Transição de Estado: [${data.state}]`);
      this.isProcessing = false; 
      
      switch(data.state) {
        case 'DISCONNECTED':
          this.switchState('disconnected');
          if (data.error) {
            alert(`Falha na Conexão: ${data.error}`);
          }
          break;
          
        case 'STARTING':
          this.switchState('loading');
          this.updateLoadingText('A criar instância segura com a Meta...');
          break;
          
        case 'PAIRING_CODE_READY':
          // REGRA 2: O sistema recebeu o código, guarda na memória e mostra o botão!
          if (data.code) {
            this.currentPairingCode = data.code;
            this.switchState('pairing-ready');
          } else {
            console.error("Servidor reportou PAIRING_CODE_READY mas não enviou o código.");
            this.switchState('disconnected');
          }
          break;
          
        case 'CONNECTED':
          // REGRA 4: Conexão bem sucedida. Mostra a tela final.
          this.currentPairingCode = null; // Limpa da memória por segurança
          this.showConnected(data.number);
          break;
      }
    });

    this.socket.on('disconnect', () => {
      this.switchState('loading');
      this.updateLoadingText('Tentando reconectar ao servidor interno...');
    });
  },

  // ==========================================
  // EVENTOS DE CLIQUE DO UTILIZADOR
  // ==========================================
  bindDOMEvents: function() {
    const btnRequestCode = document.getElementById('btn-request-code');
    const btnShowCode = document.getElementById('btn-show-code');
    const btnCancel = document.getElementById('btn-cancel-pairing');

    // REGRA 1: Usuário preenche e clica em conectar
    if (btnRequestCode) {
      btnRequestCode.onclick = () => {
        if (this.isProcessing) return;

        const ddi = document.getElementById('country-code').value;
        const phoneInput = document.getElementById('phone-number').value;
        const cleanPhone = phoneInput.replace(/\D/g, ''); // Limpa espaços e traços

        if (cleanPhone.length < 10) {
          alert("Por favor, informe um número de telefone válido com o DDD.");
          return;
        }

        const fullNumber = `${ddi}${cleanPhone}`;
        
        this.isProcessing = true;
        this.switchState('loading');
        this.updateLoadingText('A solicitar código de emparelhamento...');
        
        // Dispara para o Backend gerar o código
        this.socket.emit('action_request_pairing_code', { 
            tenantId: this.tenantId, 
            phoneNumber: fullNumber 
        });
      };
    }

    // REGRA 3: Após clique no botão, mostra o código em ecrã
    if (btnShowCode) {
      btnShowCode.onclick = () => {
        if (!this.currentPairingCode) {
          alert("Erro: O código não foi encontrado em memória. Tente gerar novamente.");
          this.switchState('disconnected');
          return;
        }
        this.renderPairingCode(this.currentPairingCode);
      };
    }

    // Botão auxiliar de cancelamento
    if (btnCancel) {
      btnCancel.onclick = () => {
        this.currentPairingCode = null;
        this.switchState('disconnected');
      }
    }
  },

  // ==========================================
  // HELPERS DE RENDERIZAÇÃO E FORMATAÇÃO
  // ==========================================

  switchState: function(stateName) {
    const states = ['disconnected', 'loading', 'pairing-ready', 'pairing-visible', 'connected'];
    states.forEach(s => {
      const el = document.getElementById(`state-${s}`);
      if (el) {
        if (s === stateName) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });
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
        // Formata o código para a leitura humana (ex: ABCD - 1234)
        const cleanCode = String(rawCode).replace(/[^a-zA-Z0-9]/g, '');
        const formattedCode = cleanCode.match(/.{1,4}/g).join(' - ');
        displayEl.textContent = formattedCode;
      } catch (err) {
        console.warn("Falha ao formatar código visualmente. Exibindo raw:", err);
        displayEl.textContent = rawCode; 
      }
    }
  },

  showConnected: function(number) {
    this.switchState('connected');
    const el = document.getElementById('connected-number');
    if (el) {
      // Adiciona o "+" à frente do número para ficar padrão internacional
      el.textContent = number.toString().startsWith('+') ? number : `+${number}`;
    }
  }
};

// Auto-inicialização segura após carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    ConnectionController.init();
});
