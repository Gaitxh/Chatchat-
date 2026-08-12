# Provider Window Health 🫀

A ChatChat seat represents a live browser execution channel, not merely a row in SQLite.

That distinction matters because a real Provider WebView can change state at any time:

```text
healthy chat page
→ OAuth/MFA redirect
→ provider chat page
→ user closes window
```

A stale `READY` badge after the real browser channel disappears would be worse than an obvious error. It would make LIVE COUNCIL visually dishonest.

## Health states

The Tauri host emits a local `provider-window-health` event when a managed Provider WebView loads a page or is destroyed.

ChatChat maps the WebView to one of three states:

### `provider`

The window is open and its current host is the expected Provider host (or an allowed subdomain).

UI:

```text
● PROVIDER HOST
```

This state means the browser channel is structurally usable. It does **not** by itself prove that the user is authenticated; Test Speech and Council Gate remain separate trust gates.

### `external`

The window is physically open but is currently on another host—for example an OAuth/MFA/identity page.

UI:

```text
◐ AUTH / EXTERNAL
```

While off-host, ChatChat disables Probe / Teach / Test / Council Gate / seating operations.

Any runtime proof tied to the old page is invalidated.

### `closed`

The managed Provider window was destroyed.

UI:

```text
○ WINDOW CLOSED
```

A closed Provider cannot remain a live Council seat.

## Automatic demotion

If a profile is `READY` or `SEATED` and the window becomes `external` or `closed`, ChatChat automatically persists:

```text
authState = login_required
seatState = bench
```

It also removes volatile Probe / Test Speech / Council Gate proof from the current UI state.

The user can reopen the Provider and revalidate it.

## Why the recipe survives

A WebView going unhealthy does **not** automatically delete the user's local 3/3 Adapter Recipe.

The recipe represents a learned page layout and may still be useful when the Provider returns. Runtime proof represents what works **right now**.

```text
Recipe       = durable local knowledge
Test/Gate    = current runtime evidence
Seat         = current user choice + healthy browser channel
```

Keeping those concepts separate makes recovery faster without pretending stale evidence is current.

## Council behavior during a sudden disconnect

The Council Orchestrator captures its participating agents when a session starts.

If a Provider window disappears during an already-running turn, the browser call will fail and that advisor should degrade to an `uncertain` contribution / zero-confidence final uncertainty rather than crash the entire Council.

At the same time the UI health event revokes the persistent seat. The next Council session will not include that advisor until it is healthy and revalidated.

## Demo moment

A strong real demo after two Providers unlock LIVE mode:

```text
🔥 LIVE COUNCIL · 2 REAL
        ↓
close one Provider WebView
        ↓
○ WINDOW CLOSED
🪑 seat revoked
        ↓
⚗️ HYBRID · 1 REAL
```

Close the second Provider:

```text
🎭 DEMO · MOCK
```

This is intentionally visible. ChatChat should never preserve a theatrical LIVE badge after the actual browser channel is gone.

## Security boundary

Window Health is host-level state, not page-content inspection.

The event carries:

```text
profile id
state
current URL
onProviderHost boolean
observation timestamp
```

It does not need passwords, cookies, storage, or chat-body text.

The same host-validation philosophy is used before Provider automation commands: remote pages are untrusted, and privileged host operations should only target the managed window at the expected Provider host.
