// Time helpers: the proxy gives wall-clock times in the display time zone, we need instants and French labels.

const partsFormatters = new Map();

function partsFormatter(tz) {
  if (!partsFormatters.has(tz)) {
    partsFormatters.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return partsFormatters.get(tz);
}

function zonedParts(date, tz) {
  return Object.fromEntries(partsFormatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
}

/** Offset of `tz` from UTC at `date`, in ms (Paris: +3600000 in winter). */
export function tzOffsetMs(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant of the wall-clock time `h:m` on `isoDate` (YYYY-MM-DD) in `tz`. */
export function zonedToUtc(isoDate, h, m, tz) {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  const offset = tzOffsetMs(new Date(guess), tz);
  let t = guess - offset;
  const offset2 = tzOffsetMs(new Date(t), tz); // DST change between the guess and the result
  if (offset2 !== offset) t = guess - offset2;
  return new Date(t);
}

export function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in `tz`. */
export function todayIn(tz, now = new Date()) {
  const p = zonedParts(now, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "7:00 PM" or "20:45" → {h, m}; null when unreadable (e.g. "TBD"). */
export function parseTime(text) {
  const match = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(String(text || '').trim());
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  if (match[3]) {
    const pm = match[3].toUpperCase() === 'PM';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || m > 59) return null;
  return { h, m };
}

const pad = (n) => String(n).padStart(2, '0');
export const hhmm = ({ h, m }) => `${pad(h)}:${pad(m)}`;

/**
 * NBA start time. The proxy gives the US game day (`date`) and the time in the display time zone; seen from
 * Europe, evening games start after midnight, so times before noon belong to the next calendar day.
 */
export function nbaKickoff(usDate, startTime, tz) {
  const t = parseTime(startTime);
  if (!usDate || !t) return { time: startTime || '', kickoff: null };
  const day = t.h < 12 ? addDays(usDate, 1) : usDate;
  return { time: hhmm(t), kickoff: zonedToUtc(day, t.h, t.m, tz).toISOString() };
}

/** Football start time: `startTime` is already "HH:MM" in the display time zone, on the board's day. */
export function footballKickoff(date, startTime, tz) {
  const t = parseTime(startTime);
  if (!date || !t) return { time: startTime || '', kickoff: null };
  return { time: hhmm(t), kickoff: zonedToUtc(date, t.h, t.m, tz).toISOString() };
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayNoMonthFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const atNoon = (isoDate) => new Date(`${isoDate}T12:00:00Z`);

/** "2026-11-16" → "lun. 16 nov." */
export function frDay(isoDate) {
  return dayFormat.format(atNoon(isoDate));
}

/** US game day "2026-11-15" → "nuit du dim. 15 au lun. 16 nov." */
export function frNight(usDate) {
  return `nuit du ${dayNoMonthFormat.format(atNoon(usDate))} au ${frDay(addDays(usDate, 1))}`;
}
