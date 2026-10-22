import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeetingBackup, inspectMeetingBackup, BACKUP_FORMAT } from '../main/backup.mjs';

function example() {
  return {
    createdAt: '2026-10-22T09:00:00.000Z',
    skippedDamagedArchives: 0,
    seats: [{
      id: 'seat-alpha-1', providerId: 'alpha', name: 'Alpha', url: 'https://alpha.example/',
      cookie: 'NEVER_EXPORT_COOKIE', secretKey: 'NEVER_EXPORT_KEY',
    }],
    meetings: [{
      schema: 1, mode: 'balanced', maxRounds: 3,
      updatedAt: '2026-10-22T09:00:00.000Z',
      roster: [{
        id: 'seat-alpha-1', providerId: 'alpha', name: 'Alpha', url: 'https://alpha.example/',
        userProfilePath: 'NEVER_EXPORT_PROFILE',
      }],
      secretToken: 'NEVER_EXPORT_ARCHIVE_EXTRAS',
      meeting: {
        id: 'meeting-9aa13d9d-1234-4dcb-a5ea-56d1527d05d9',
        status: 'completed', phase: 'completed', proposal: 'Should we pilot?', round: 3,
        events: [{ id: 'event-1', actorId: 'seat-alpha-1', round: 1, kind: 'argument',
          content: 'Start small', stance: 'pilot', confidence: 0.8 }],
        report: { consensusStance: 'pilot', positions: [], disagreements: [], confidence: 0.8 },
        injectedCookie: 'NEVER_EXPORT_MEETING_EXTRAS',
      },
    }],
  };
}

test('full local backup is inspectable, self-checksummed and excludes browser authentication metadata', () => {
  const content = buildMeetingBackup(example());
  assert.match(content, /chatchat\.windows\.meetings\.backup\.v1/);
  assert.doesNotMatch(content, /NEVER_EXPORT_/);
  const data = JSON.parse(content);
  assert.equal(data.format, BACKUP_FORMAT);
  assert.equal(data.containsBrowserProfiles, false);
  assert.equal(data.containsLoginSessions, false);
  assert.equal(data.meetingCount, 1);
  assert.equal(data.seats.length, 1);
  assert.equal(data.meetings[0].meeting.proposal, 'Should we pilot?');
  assert.match(data.integrity.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(inspectMeetingBackup(content), {
    format: BACKUP_FORMAT, meetingCount: 1,
    seatBookmarkCount: 1, skippedDamagedArchives: 0,
  });
});

test('an edited meeting, fabricated hash or invalid JSON is rejected by offline backup inspection', () => {
  const source = buildMeetingBackup(example());
  const changed = JSON.parse(source);
  changed.meetings[0].meeting.proposal = 'Falsified';
  assert.throws(() => inspectMeetingBackup(JSON.stringify(changed)), /integrity/);
  changed.integrity.digest = 'b'.repeat(64);
  assert.throws(() => inspectMeetingBackup(JSON.stringify(changed)), /integrity/);
  const appended = JSON.parse(source);
  appended.loginCookie = 'MALICIOUS_ADDITIONAL_DATA';
  assert.throws(() => inspectMeetingBackup(JSON.stringify(appended)), /integrity/,
    'An attacker must not be able to append profile material while preserving the old hash');
  assert.throws(() => inspectMeetingBackup('not a json backup'), /JSON/);
  assert.throws(() => inspectMeetingBackup('{}'), /format/);
});

test('duplicate, unsafe or oversized meeting inputs never produce a plausible valid backup', () => {
  const source = example();
  source.meetings.push(structuredClone(source.meetings[0]));
  assert.throws(() => buildMeetingBackup(source), /cannot be included safely/);
  source.meetings.pop();
  source.meetings[0].meeting.id = '../../elsewhere';
  assert.throws(() => buildMeetingBackup(source), /cannot be included safely/);
  source.meetings[0].meeting.id = 'meeting-9aa13d9d-1234-4dcb-a5ea-56d1527d05d9';
  source.seats[0].id = '../badseat';
  assert.throws(() => buildMeetingBackup(source), /Invalid seat/);
});

test('empty history can preserve only seat bookmarks without confusing login sessions with backup', () => {
  const source = example();
  source.meetings = [];
  source.skippedDamagedArchives = 2;
  const backup = buildMeetingBackup(source);
  const parsed = JSON.parse(backup);
  assert.equal(parsed.meetingCount, 0);
  assert.equal(parsed.skippedDamagedArchives, 2);
  assert.equal(parsed.seats.length, 1);
  assert.deepEqual(inspectMeetingBackup(backup).skippedDamagedArchives, 2);
});
