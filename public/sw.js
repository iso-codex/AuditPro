self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const options = {
        body: payload.message || payload.body,
        icon: '/favicon.ico',
        data: {
          url: payload.link || '/'
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(payload.title || 'AuditPro Notification', options)
      );
    } catch (e) {
      console.error('Error parsing push payload', e);
      // Fallback
      event.waitUntil(
        self.registration.showNotification('AuditPro Notification', {
          body: event.data.text(),
          icon: '/favicon.ico'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
