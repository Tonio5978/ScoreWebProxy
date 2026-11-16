import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, footballKickoff, frDay, frNight, nbaKickoff, parseTime, todayIn, zonedToUtc } from '../server/time.js';

test('parseTime reads 12 h and 24 h times', () => {
  assert.deepEqual(parseTime('7:00 PM'), { h: 19, m: 0 });
  assert.deepEqual(parseTime('12:00 AM'), { h: 0, m: 0 });
  assert.deepEqual(parseTime('12:30 PM'), { h: 12, m: 30 });
  assert.deepEqual(parseTime('20:45'), { h: 20, m: 45 });
  assert.equal(parseTime('TBD'), null);
  assert.equal(parseTime(''), null);
});

test('zonedToUtc handles winter and summer time in Paris', () => {
  assert.equal(zonedToUtc('2026-11-16', 20, 45, 'Europe/Paris').toISOString(), '2026-11-16T19:45:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', 20, 45, 'Europe/Paris').toISOString(), '2026-07-01T18:45:00.000Z');
});

test('NBA games after midnight in Paris belong to the next calendar day', () => {
  assert.deepEqual(nbaKickoff('2026-11-16', '1:00 AM', 'Europe/Paris'), { time: '01:00', kickoff: '2026-11-17T00:00:00.000Z' });
  // Sunday matinee: 1 PM in New York is 19:00 in Paris, same day
  assert.deepEqual(nbaKickoff('2026-11-15', '7:00 PM', 'Europe/Paris'), { time: '19:00', kickoff: '2026-11-15T18:00:00.000Z' });
  assert.deepEqual(nbaKickoff('2026-11-15', 'TBD', 'Europe/Paris'), { time: 'TBD', kickoff: null });
});

test('football kickoff stays on the board day', () => {
  assert.deepEqual(footballKickoff('2026-11-17', '20:45', 'Europe/Paris'), { time: '20:45', kickoff: '2026-11-17T19:45:00.000Z' });
});

test('French day labels', () => {
  assert.equal(frDay('2026-11-16'), 'lun. 16 nov.');
  assert.equal(frNight('2026-11-15'), 'nuit du dim. 15 au lun. 16 nov.');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(todayIn('Europe/Paris', new Date('2026-11-16T23:30:00Z')), '2026-11-17');
});
