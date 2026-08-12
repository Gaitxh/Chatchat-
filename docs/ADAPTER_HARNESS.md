# ChatChat Adapter Harness

v0.6 adds a metadata-only probe between the Provider Login Gate and a real Provider Adapter.

## Why probe first?

Provider websites are moving targets. A hard-coded adapter that assumes one CSS selector without diagnostics will silently rot.

The Adapter Harness lets ChatChat ask an already-open Provider WebView what *structural surfaces* exist before an adapter starts sending messages.

```text
Provider Login WebView
        ↓
Host-side eval_with_callback
        ↓
metadata-only DOM probe
        ↓
composer/action candidates
        ↓
Provider-specific Adapter
```

## Privacy rule

The built-in probe deliberately does **not** access:

- `document.cookie`
- localStorage/sessionStorage
- input or textarea `.value`
- password contents
- page body text
- chat message text

It collects only structural metadata such as element tag, id, role, ARIA label, placeholder, `data-testid`, input type, disabled state and element counts.

The probe only runs when the managed Provider WebView has navigated back to the Provider Profile's expected host. This avoids injecting the harness into third-party OAuth identity pages.

## Host-controlled execution

The remote provider page receives no ChatChat remote capability. The main local ChatChat window asks Rust to probe the managed webview. Rust uses Tauri's host-side `WebviewWindow::eval_with_callback`, which returns the JavaScript evaluation result to the host.

This gives adapters a useful two-way observation primitive without letting the external page invoke arbitrary ChatChat commands.

## Next step

A provider-specific adapter can build on this harness with narrowly-scoped operations:

1. `detectAuth()`
2. `detectComposer()`
3. `startConversation()`
4. `sendTurn()`
5. `detectGeneration()`
6. `readLatestAssistantResponse()`
7. transform the result into `CouncilContribution[]`

The first real advisor should graduate only after these operations work consistently against one provider.
