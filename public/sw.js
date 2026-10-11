// Service worker mínimo: existe solo porque Chrome en Android no permite mostrar
// notificaciones sin uno. No guarda nada en caché ni intercepta peticiones.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Al tocar la notificación se vuelve a xCal
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
