// O dicionário de rotas (Mapeia o nome do menu para o arquivo HTML real)
const routes = {
  'home': '/webpage/views/home.html',
  'agent': '/webpage/views/agent.html',
  'catalog': '/webpage/views/catalog.html',
  'connection': '/webpage/views/connection.html'
};

async function navigateTo(viewName) {
  const contentArea = document.getElementById('app-content');
  
  // 1. Feedback visual de carregamento rápido
  contentArea.innerHTML = '<div class="flex justify-center items-center h-full"><i class="ph ph-spinner animate-spin text-4xl text-blue-500"></i></div>';

  try {
    // 2. Busca o arquivo HTML parcial no servidor silenciosamente
    const response = await fetch(routes[viewName]);
    if (!response.ok) throw new Error('Tela não encontrada');
    
    const html = await response.text();
    
    // 3. Injeta o HTML na tela sem dar refresh
    contentArea.innerHTML = html;

    // 4. Atualiza a UI do Menu e Cabeçalho
    updateMenuUI(viewName);

    // 5. ROTEAMENTO DE LÓGICA (O Pulo do Gato)
    // Como o navegador não executa tags <script> injetadas via innerHTML,
    // nós chamamos os controladores (JS separados) manualmente após a tela carregar.
    if (viewName === 'agent') {
      // Chama o arquivo agentController.js
      if (typeof AgentController !== 'undefined') AgentController.init();
    }
    if (viewName === 'connection') {
      // 🔥 Aciona o WebSocket quando o lojista clica no menu Conexão
      if (typeof ConnectionController !== 'undefined') ConnectionController.init();
    }
    if (viewName === 'catalog') {
      // 🔥 Aciona o WebSocket quando o lojista clica no menu Conexão
      if (typeof CatalogController !== 'undefined') CatalogController.init();
    }
    // if (viewName === 'catalog') CatalogController.init();

  } catch (error) {
    contentArea.innerHTML = `<div class="p-6 text-red-500">Erro ao carregar a tela: ${error.message}</div>`;
  }
}

function updateMenuUI(activeView) {
  // Reseta todos os botões do menu
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-gray-800', 'text-white');
    btn.classList.add('text-gray-300');
  });

  // Pinta o botão clicado
  const activeBtn = document.getElementById(`menu-${activeView}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-gray-800', 'text-white');
    activeBtn.classList.remove('text-gray-300');
    
    // Atualiza o Título do cabeçalho
    const title = activeBtn.querySelector('span').textContent;
    document.getElementById('page-title').textContent = title;
  }
}

// Quando o dashboard carregar pela primeira vez, abre a Home
document.addEventListener('DOMContentLoaded', () => {
  navigateTo('home');
});
