# Real Provider Manual Validation — browser-backed local preview

This is the acceptance checklist for the current browser extension and independent meeting window. Historical desktop/WebView instructions are archived in [MANUAL_PROVIDER_TEST_DESKTOP_0_9.md](archive/MANUAL_PROVIDER_TEST_DESKTOP_0_9.md). There is no current `tauri:dev` installation step.

## Evidence boundaries

Automated type checks, deterministic tests, packaged extension loading and synthetic UI demonstrations are distinct from actual model inference. A site is not runtime-validated because its URL is recognized, its login is visible, or a synthetic scenario passes. Record a dated configuration only after a real consultation succeeds.

Use the [local installation guide](LOCAL_INSTALL.md) ([中文](LOCAL_INSTALL.zh-CN.md)). Load the prebuilt `extension/` folder in the browser profile holding the intended model login. Do not copy cookies, change enterprise policies, disable browser protections or enter provider passwords into ChatChat.

## 1. Installation and entry

Open ChatChat from the toolbar. A separate meeting window should open. Repeat the action: the same live room should be focused without a second room or reset. A previously opened synthetic demo must not be reused as the live meeting. Help should remain available from extension details. Update/startup must not unexpectedly open AI websites.

Record OS, browser/version, extension version and source revision. Do not record account identifiers or private sidebar contents.

## 2. Choose seats and permissions

Choose two different providers with the add-seat control. Decline one site permission initially: no prompt should be sent and the error should explain the next action. Then grant only the intended site from an explicit user action. A provider alias must not create a second seat or request permission for the wrong destination.

Existing tabs may be used to discover a provider, not as permission to write into an existing personal conversation. For custom websites, explicitly identify and confirm a new-chat entry; this is not a compatibility certification.

## 3. Normal login and clean-chat boundary

Complete login/MFA normally on the provider website when needed. Confirm that already authenticated sessions in the same browser profile do not ask for an unnecessary second login. Other profiles' logins must not be imported or exposed.

Keep an old conversation open with a harmless sentinel. Add the provider and run connection checks. The old conversation must receive zero injected prompts, sends, navigations or new messages. Inspect the dedicated consultation chat on the actual website: a new tab or homepage navigation alone does not prove a new conversation. A website that restores the old thread fails this check.

Repeat for a second consultation: prior meeting context must not silently leak into the new one.

## 4. Verify page controls and real responses

Where automatic connection succeeds, inspect what was actually sent and received. Where a manual recipe is needed, use only the intended composer, Send control and assistant-response region. Never accept a password field, a broad `main`/body scrape, an unrelated Send button or the echoed user prompt as an AI response.

READY requires the actual consultation handshake, not merely a logged-in homepage. Record completion/timeout explicitly. A partial/truncated reply, expired session, CAPTCHA or rate limit must remain visible and must not be represented by a fabricated successful turn. Respect provider restrictions; do not bypass challenges or limits.

## 5. Run a real two-provider consultation

Use a non-sensitive, bounded task. Confirm:

- independent first views are not delivered to peers until the first batch closes;
- subsequent discussion references actual public events;
- claimed revisions identify the participant-authored event that changed the position;
- unavailable providers do not become agreement votes;
- unresolved questions and uncertainty remain visible;
- the final output corresponds to real captured contributions, not synthetic fixtures.

A test need not force disagreement or a revision. Use a separately labeled deterministic fixture to cover rare protocol paths, never to claim a real model was persuaded.

## 6. Failure and recovery

Close one dedicated provider tab, navigate another to an unexpected origin, interrupt network access and expire a login in separate controlled runs. No prompt may be sent to an unrelated origin. Other seats must not be silently marked as having answered. A lost send acknowledgement must not cause an automatic duplicate submission. Record any unsupported cancellation/resume behavior as a failed acceptance item rather than assuming exactly-once delivery.

Check the two-UI case (Full Room plus Side Panel), repeated clicks and browser restart. Existing private tabs remain untouched. Save/export local meeting history before update or uninstall; record what the current implementation actually restores.

## 7. Retained evidence

Keep only privacy-reviewed evidence: date, software versions, provider display/model label as visible (or unknown), test case, pass/fail, redacted receipts and unresolved defects. Do not publish passwords, tokens, cookies, account emails, full private chat URLs, private transcripts or account sidebars.

Passing these checks for a specific provider/browser/date does not prove permanent compatibility with all websites or replace a provider's terms and account limits. Stable support requires maintained adapters and repeatable live evidence.
