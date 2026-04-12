const ConnectionController = {
  socket: null,

  init: function() {
    const tenant = JSON.parse(localStorage.getItem('lojabot_tenant'));
    
    // Conecta ao backend Node.js (Ajuste localhost para o IP da sua Oracle Cloud em Produção)
    this.socket = io('http://localhost:3001');

    this.socket.on('connect', () => {
      this.socket.emit('join_tenant_room', tenant.id);
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
  },

  showConnectedCard: function(number, timeStr) {
    document.getElementById('qr-container').classList.add('hidden');
    document.getElementById('connected-container').classList.remove('hidden');
    
    document.getElementById('connected-number').textContent = `+${number}`;
    const d = new Date(timeStr);
    document.getElementById('connected-time').textContent = d.toLocaleDateString() + ' às ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
};
