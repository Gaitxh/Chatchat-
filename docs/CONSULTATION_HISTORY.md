# Consultation History

ChatChat keeps completed consultations as a **private local history** in the browser.

## What is saved

A local archive contains the information required to reopen and replay the consultation faithfully:

- User Proposal;
- final Consultation Report;
- every structured Blackboard event;
- participant identities used in that consultation;
- timestamps and rounds.

This is different from a public compatibility proof: local history is allowed to contain the user's actual proposal and AI event text because the archive is for the user, not for publishing to GitHub.

## What the list shows

The visible history list uses a lighter summary:

- short proposal preview;
- date/time;
- participant count;
- round count;
- event count;
- changed-mind count;
- alignment ratio;
- whether a different final position survived.

The list does not duplicate all model/event text.

## Local storage

Browser consultation history is stored in **IndexedDB** in the browser profile.

ChatChat does not upload it to a ChatChat server.

```text
Browser profile
   ↓
ChatChat IndexedDB
   ├── consultation summaries
   └── full consultation archives
```

The default retention is the newest **24 consultations**.

## Replay an old consultation

Open **Consultation History** and choose **OPEN REPLAY**.

The same Consultation Theater is rebuilt from the archived structured events:

```text
saved proposal + report + events
          ↓
read-only Consultation Theater
          ↓
changed-mind trails
influence ledger
local replay
source-event provenance
```

No AI Provider is contacted during archive replay.

## Current vs historical view

When you open an old consultation, the interface clearly labels it **ARCHIVE REPLAY**.

If a current consultation exists in memory, choose **RETURN TO CURRENT** to switch back without running the models again.

## Delete local history

Each record can be deleted individually. **CLEAR HISTORY** removes all ChatChat consultation archives from the local browser database.

Deleting a local archive does not delete conversations stored by the AI Provider itself.

## Privacy boundary

Local-first does not mean browser storage is magical secure storage. Anyone or any software with access to the same local browser profile may potentially access local browser data.

Do not export or publish an archive if it contains sensitive proposals or model responses.

ChatChat does not automatically send the archive anywhere.
