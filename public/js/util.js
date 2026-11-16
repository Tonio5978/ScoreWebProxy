// Small helpers shared by the page modules.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Readable text color (dark or white) on a #rrggbb background. */
export function textOn(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#07090d' : '#ffffff';
}

let timeZone = 'Europe/Paris';
export const setTimeZone = (tz) => { timeZone = tz || timeZone; };

function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** "Auj.", "Demain", "Hier" or "mar. 17" for an ISO instant. */
export function dayWord(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const key = dayKey(date);
  if (key === dayKey(now)) return 'Auj.';
  if (key === dayKey(new Date(now.getTime() + 86400000))) return 'Demain';
  if (key === dayKey(new Date(now.getTime() - 86400000))) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric' }).format(date);
}

/** "dans 25 min", "dans 3 h", "dans 2 j" — empty when the instant is past. */
export function untilText(iso) {
  if (!iso) return '';
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (minutes <= 0) return '';
  if (minutes < 60) return `dans ${minutes} min`;
  if (minutes < 24 * 60) return `dans ${Math.round(minutes / 60)} h`;
  return `dans ${Math.round(minutes / 1440)} j`;
}

export function clockTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));
}

/** Minute "45'+2'" → 45.02 for sorting goals and cards. */
export function minuteValue(text) {
  const m = /(\d+)(?:'?\s*\+\s*(\d+))?/.exec(String(text || ''));
  return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0) : 0;
}
