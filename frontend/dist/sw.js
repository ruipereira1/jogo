// ArteRápida Service Worker
const CACHE_NAME = 'arte-rapida-v2.1.3';
const RUNTIME_CACHE = 'runtime-cache-v2.1.3';

// URLs de produção
const PROD_SERVER_URL = 'https://jogo-0vuq.onrender.com';
const FRONTEND_URL = 'https://desenharapido.netlify.app';

// Lista de recursos para cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/icon.svg',
  '/screenshots/home.webp'
];

// Recursos estáticos que devem ser cacheados
const staticResourceTypes = [
  /\.(?:js|css|html|json|woff2?|ttf|otf)$/,
  /\.(png|jpg|jpeg|gif|svg|webp|ico)$/
];

// Função para verificar se uma URL deve ser cacheada
function shouldCache(url) {
  try {
    const urlObj = new URL(url);
    
    // Não cachear recursos do servidor backend
    if (urlObj.origin === PROD_SERVER_URL) {
      return false;
    }
    
    // Não cachear WebSocket
    if (urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:') {
      return false;
    }
    
    // Cachear recursos estáticos do frontend
    if (urlObj.origin === FRONTEND_URL || urlObj.origin === location.origin) {
      return staticResourceTypes.some(regex => regex.test(urlObj.pathname));
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Função para limpar caches antigos
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name !== CACHE_NAME && name !== RUNTIME_CACHE
  );
  
  await Promise.all(
    oldCaches.map(cacheName => caches.delete(cacheName))
  );
}

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de cache: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  // Ignorar requisições para o socket.io
  if (event.request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a resposta bem-sucedida
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar, tentar buscar do cache
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline - Conteúdo não disponível', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then(clients => {
        // Se já há uma janela aberta, focar nela
        for (const client of clients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Caso contrário, abrir nova janela
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});

// Lidar com mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync (futuro)
self.addEventListener('sync', event => {
  if (event.tag === 'background-reconnect') {
    event.waitUntil(
      // Notificar clientes sobre tentativa de reconexão
      self.clients.matchAll()
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'BACKGROUND_SYNC',
              action: 'reconnect'
            });
          });
        })
    );
  }
});

// Periodic background sync (se suportado)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupOldCaches());
  }
}); 