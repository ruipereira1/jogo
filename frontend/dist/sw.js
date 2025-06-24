// ArteRápida Service Worker
const CACHE_NAME = 'arterapida-v2.1.2';
const RUNTIME_CACHE = 'runtime-cache-v2.1.2';

// Recursos críticos para cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Não incluir bundle.js específico pois o nome muda
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
    
    // Não cachear recursos externos
    if (urlObj.origin !== location.origin) {
      return false;
    }
    
    // Cachear recursos estáticos
    return staticResourceTypes.some(regex => regex.test(urlObj.pathname));
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
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch(error => {
        if (self.registration?.showNotification) {
          console.warn('Cache install failed:', error);
        }
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim()
    ])
  );
});

// Interceptar requests
self.addEventListener('fetch', event => {
  // Apenas interceptar requisições GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = event.request.url;
  
  // Não interceptar requisições de WebSocket ou Socket.IO
  if (url.includes('socket.io') || url.includes('ws://') || url.includes('wss://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retornar do cache se disponível
        if (response) {
          return response;
        }
        
        // Tentar buscar da rede
        return fetch(event.request)
          .then(response => {
            // Verificar se é uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Verificar se deve cachear
            if (shouldCache(event.request.url)) {
              const responseToCache = response.clone();
              
              caches.open(RUNTIME_CACHE)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                })
                .catch(() => {
                  // Falhar silenciosamente se não conseguir cachear
                });
            }
            
            return response;
          })
          .catch(() => {
            // Se falhar e for navegação, retornar página offline
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Para outros recursos, retornar resposta vazia
            return new Response('', {
              status: 200,
              statusText: 'OK'
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

// Message handling para comunicação com o app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
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