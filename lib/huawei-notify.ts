import { buildNotification, type HuaweiLoggable } from './huawei-health';

export type NotifyResult = 'shown' | 'denied' | 'unsupported';

// Una sola notificación: cada comida reemplaza a la anterior
const TAG = 'xcal-huawei';

/**
 * Deja una notificación con los datos de la comida, para leerlos desde Huawei
 * Health sin cambiar de app. Pide permiso la primera vez. Nunca lanza.
 */
export async function showHuaweiNotification(log: HuaweiLoggable): Promise<NotifyResult> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return 'denied';

    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    const { title, body } = buildNotification(log);
    await registration.showNotification(title, { body, tag: TAG, icon: '/favicon.png' });
    return 'shown';
  } catch (error) {
    console.error('No se pudo mostrar la notificación:', error);
    return 'unsupported';
  }
}
