self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || '/icons/pwa-192x192.png',
        badge: '/icons/pwa-192x192.png',
        data: data.url || '/',
        vibrate: [200, 100, 200]
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Sloty', options)
      );
    } catch (e) {
      console.error('Error parsing push data', e);
      // Fallback for plain text
      event.waitUntil(
        self.registration.showNotification('Sloty', {
          body: event.data.text(),
          icon: '/icons/pwa-192x192.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
