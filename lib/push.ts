// ─── Push Notification Utilities (client-side only) ───────────────────────────

export type NotificationFrequency = 'off' | '1h' | '3h' | '6h' | '12h' | '24h' | 'update'

export const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: 'off',    label: 'Off' },
  { value: 'update', label: 'Every update' },
  { value: '1h',     label: 'Every 1 hour' },
  { value: '3h',     label: 'Every 3 hours' },
  { value: '6h',     label: 'Every 6 hours' },
  { value: '12h',    label: 'Every 12 hours' },
  { value: '24h',    label: 'Every 24 hours' },
]

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output  = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready
    return reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing

    return await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
    })
  } catch {
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const sub = await getExistingSubscription()
    return sub ? sub.unsubscribe() : true
  } catch {
    return false
  }
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
