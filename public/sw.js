// ─── Content Bite — Service Worker ────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push received ──────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { return }

  const { title = 'Content Bite', body = '', url = '/dashboard', tag = 'default', icon = '/icon-192.png' } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon-72.png',
      data:  { url },
      tag,
      renotify: true,
      requireInteraction: false,
    })
  )
})

// ── Notification click ─────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing tab if already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // Open new tab
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      })
  )
})
