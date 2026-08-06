/**
 * Browser notification helpers for completion alerts.
 *
 * Permission is only requested on a user gesture (toggle change or button click).
 * Returns the resulting permission state as a string.
 */

export function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Read the current browser permission state without prompting.
 * Returns 'granted', 'denied', 'default', or 'unsupported'.
 */
export function getNotificationPermission() {
  if (!supportsNotifications()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission. Must be called from a user gesture
 * (click handler) for browsers to show the permission prompt.
 * Returns 'granted', 'denied', or 'unsupported'.
 */
export async function requestNotificationPermission() {
  if (!supportsNotifications()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Check whether notifications are currently enabled (no permission prompt).
 */
export function notificationsEnabled() {
  return supportsNotifications() && Notification.permission === 'granted';
}

/**
 * Show a desktop notification that a job has completed.
 * Does NOT request permission — only shows if already granted.
 * Returns true if the notification was shown, false otherwise.
 */
export function showCompletionNotification(jobId, jobName) {
  if (!supportsNotifications() || Notification.permission !== 'granted') return false;
  const title = 'Clipo AI — Export Ready';
  const body = jobName
    ? `"${jobName}" is ready to review and download.`
    : 'Your clip generation is complete. Open the results to review and download.';
  try {
    const n = new Notification(title, {
      body,
      tag: `clipo-complete-${jobId}`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: false,
    });
    if (n && typeof n.onclick === 'function') {
      n.onclick = () => {
        try { window.focus(); } catch { /* ignore */ }
        n.close();
      };
    }
    return true;
  } catch (err) {
    console.warn('Could not show completion notification:', err);
    return false;
  }
}

/**
 * Test the notification permission by sending a small test notification.
 * Used by the "Send test" button in the UI.
 */
export function showTestNotification() {
  if (!supportsNotifications()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: Notification.permission };
  try {
    new Notification('Clipo — Test notification', {
      body: 'If you can see this, completion alerts will work too.',
      tag: 'clipo-test',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', error: err };
  }
}
