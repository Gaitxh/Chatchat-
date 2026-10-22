import { createHash } from 'node:crypto';

export const BACKUP_FORMAT = 'chatchat.windows.meetings.backup.v1';
const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_MEETINGS = 2500;
const MAX_SEATS = 8;
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function checkedSnapshot({ meetings, seats, skippedDamagedArchives = 0, createdAt }) {
  if (!Array.isArray(meetings) || meetings.length > MAX_MEETINGS
    || !Array.isArray(seats) || seats.length > MAX_SEATS
    || !Number.isSafeInteger(skippedDamagedArchives) || skippedDamagedArchives < 0
    || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid local backup inventory.');
  }
  const seen = new Set();
  const clean = [];
  let totalBytes = 0;
  for (const record of meetings) {
    const meeting = record?.meeting;
    if (record?.schema !== 1 || typeof meeting?.id !== 'string'
      || !/^meeting-[0-9a-f-]{36}$/.test(meeting.id) || seen.has(meeting.id)
      || typeof meeting.proposal !== 'string' || meeting.proposal.length > 8000
      || !Array.isArray(meeting.events) || meeting.events.length > 432
      || !Array.isArray(record.roster) || record.roster.length > MAX_SEATS) {
      throw new Error('One saved meeting cannot be included safely in a backup.');
    }
    seen.add(meeting.id);
    // Never copy incidental browser runtime metadata, cookie jars, provider
    // authentication details, or unknown archive fields.
    const savedMeeting = {
      id: meeting.id, proposal: meeting.proposal, status: meeting.status,
      phase: meeting.phase, round: meeting.round,
      events: structuredClone(meeting.events),
      ...(meeting.report ? { report: structuredClone(meeting.report) } : {}),
      ...(meeting.synthesis ? { synthesis: structuredClone(meeting.synthesis) } : {}),
      ...(meeting.participatingSeatIds
        ? { participatingSeatIds: structuredClone(meeting.participatingSeatIds) } : {}),
      ...(meeting.error ? { error: meeting.error } : {}),
    };
    const saved = {
      schema: 1,
      meeting: savedMeeting,
      roster: record.roster.map((seat) => ({
        id: seat.id, providerId: seat.providerId, name: seat.name, url: seat.url,
      })),
      mode: record.mode,
      maxRounds: record.maxRounds,
      updatedAt: record.updatedAt,
    };
    totalBytes += Buffer.byteLength(JSON.stringify(saved), 'utf8');
    if (totalBytes > MAX_BACKUP_BYTES) throw new Error('Saved meetings exceed the local backup limit.');
    clean.push(saved);
  }
  const cleanSeats = [];
  for (const seat of seats) {
    if (!seat || typeof seat.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(seat.id)
      || typeof seat.providerId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(seat.providerId)
      || typeof seat.name !== 'string' || seat.name.length > 100
      || typeof seat.url !== 'string' || seat.url.length > 2048) {
      throw new Error('Invalid seat bookmark in local backup.');
    }
    cleanSeats.push({ id: seat.id, providerId: seat.providerId, name: seat.name, url: seat.url });
  }
  return {
    format: BACKUP_FORMAT,
    createdAt,
    containsLoginSessions: false,
    containsBrowserProfiles: false,
    meetingCount: clean.length,
    skippedDamagedArchives,
    seats: cleanSeats,
    meetings: clean,
  };
}

export function buildMeetingBackup(data) {
  const payload = checkedSnapshot(data);
  const digest = sha256(JSON.stringify(payload));
  const result = JSON.stringify({ ...payload, integrity: { algorithm: 'sha256', digest } }, null, 2);
  if (Buffer.byteLength(result, 'utf8') > MAX_BACKUP_BYTES) {
    throw new Error('Saved meetings exceed the export limit; export individual meetings first.');
  }
  return result;
}

/** For a future opt-in restore flow. This function never writes to the disk. */
export function inspectMeetingBackup(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES) {
    throw new Error('Backup exceeds the allowed size.');
  }
  let decoded;
  try { decoded = JSON.parse(content); } catch { throw new Error('Backup is not valid JSON.'); }
  if (!decoded || decoded.format !== BACKUP_FORMAT
    || typeof decoded.integrity?.digest !== 'string'
    || decoded.integrity.algorithm !== 'sha256') throw new Error('Unknown or unsigned local backup format.');
  const snapshot = checkedSnapshot(decoded);
  const expected = { ...snapshot, integrity: {
    algorithm: 'sha256', digest: sha256(JSON.stringify(snapshot)),
  } };
  // Reject appended fields instead of silently accepting JSON that smuggles
  // browser authentication material alongside an otherwise valid checksum.
  if (JSON.stringify(decoded) !== JSON.stringify(expected)
    || sha256(JSON.stringify(snapshot)) !== decoded.integrity.digest) {
    throw new Error('Saved backup did not pass its SHA-256 integrity check.');
  }
  return { format: BACKUP_FORMAT, meetingCount: snapshot.meetingCount,
    seatBookmarkCount: snapshot.seats.length, skippedDamagedArchives: snapshot.skippedDamagedArchives };
}
