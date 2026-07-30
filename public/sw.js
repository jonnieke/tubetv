self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    let targetUrl = '/';
    try {
      const candidate = new URL(data.url || '/', self.location.origin);
      if (candidate.origin === self.location.origin) targetUrl = candidate.href;
    } catch {
      targetUrl = '/';
    }
    const options = {
      body: data.body,
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: targetUrl
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      const url = event.notification.data.url;
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
