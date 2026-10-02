import { HailerApi } from '@hailer/app-sdk';

// 🎪 Conference Schedule calendar — created for this sync specifically.
const CALENDAR_ID = '6aa1523201361eeab8543f22';
// "Dashboard - Conferences" — exposes conferenceDatesStart/End (seconds).
const INSIGHT_CONFERENCES = '6a46119536433d11d17cebf3';
// Marks events this sync owns, so re-running only ever touches its own events
// — never anything manually added to the same calendar.
const SYNC_MARKER = '[conference-sync]';

interface ConferenceCalRow {
  id: string;
  name: string;
  phase: string;
  conferenceCode: string | null;
  location: string | null;
  conferenceDatesStart: number | null; // seconds
  conferenceDatesEnd: number | null; // seconds
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map((row) => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

// Most of the Hailer API is RPC-only, reachable over plain HTTP as
// POST /api/<operator with '.' replaced by '/'>, body = JSON array of args
// (see docs.hailer.com/api — "Under the hood: the HTTP path"). Calendar
// create/update/remove/load_events have no app-sdk module, so this is the
// only way to drive them from inside an app. hailer.http.fetch proxies the
// request through the parent frame, which attaches the session cookie
// automatically — no manual auth header needed.
async function callRpc(hailer: HailerApi, operator: string, args: unknown[]): Promise<any> {
  const res = await hailer.http.fetch(`https://api.hailer.com/api/${operator.split('.').join('/')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${operator} failed (${res.status}): ${res.body}`);
  }
  try { return JSON.parse(res.body); } catch { return res.body; }
}

export interface ConferenceSyncResult {
  created: number;
  removed: number;
  skipped: { name: string; reason: string }[];
}

// Full wipe-and-rebuild: removes every event this sync previously created on
// the Conference Schedule calendar, then recreates one per conference that
// has a full Conference Dates range set. Cancelled conferences are skipped —
// they never happened and aren't useful on a forward-looking calendar.
//
// Conference Dates is a daterange field the user picks directly (start day —
// end day, both inclusive), so unlike the trip sync (which derives an end
// from a day-count), start/end here are used as-is with no adjustment.
export async function syncConferencesToCalendar(hailer: HailerApi): Promise<ConferenceSyncResult> {
  const now = Date.now();
  const windowStart = now - 365 * 86400000;
  const windowEnd = now + 3 * 365 * 86400000;

  const existing = await callRpc(hailer, 'calendar.load_events', [{
    calendars: [CALENDAR_ID], start: windowStart, end: windowEnd,
  }]);
  const toRemove = (Array.isArray(existing) ? existing : [])
    .filter((e: any) => typeof e?.notes === 'string' && e.notes.includes(SYNC_MARKER));
  let removed = 0;
  for (const ev of toRemove) {
    await callRpc(hailer, 'calendar.remove_event', [ev._id]);
    removed++;
  }

  const data = await hailer.insight.data(INSIGHT_CONFERENCES, { update: true });
  const rows = parseInsight(data) as unknown as ConferenceCalRow[];

  let created = 0;
  const skipped: { name: string; reason: string }[] = [];

  for (const c of rows) {
    if (c.phase === 'Cancelled') continue;
    if (!c.conferenceDatesStart || !c.conferenceDatesEnd) {
      skipped.push({ name: c.name, reason: 'Conference Dates not set' });
      continue;
    }

    const start = c.conferenceDatesStart * 1000;
    const end = c.conferenceDatesEnd * 1000;

    await callRpc(hailer, 'calendar.create_event', [{
      calendar_id: CALENDAR_ID,
      title: `${c.name}${c.location ? ` (${c.location})` : ''}`,
      start,
      end,
      allDay: true,
      notes: `${SYNC_MARKER} conferenceId:${c.id}`,
    }]);
    created++;
  }

  return { created, removed, skipped };
}
