# ChatChat Windows Desktop

A standalone Windows desktop deliberation harness—not a browser extension or PWA.

The per-user Setup.exe bundles Electron and a separate full Chromium runtime. Users need no Node, Python, Git, browser extension, developer mode or mandatory API key. Install, open ChatChat, click a + seat, and sign in directly on the provider website in the managed browser. The app retains its own login profiles and never imports a personal Chrome/Edge profile.

See [中文安装与使用说明](README.zh-CN.md). Online providers still need internet access. This unsigned developer preview targets Windows 10/11 x64; Native Windows 11 tests and installer packaging have passed, but do not establish first-install/upgrade/uninstall acceptance or live-provider compatibility. Do not disable OS security protections.

Core deliberation preserves independent first opinions, later shared snapshots, revisions, dissent and runtime failure provenance. A preview seat catalog is not a universal compatibility promise. Unsupported providers remain manual/non-ready, not fabricated automatic participants.

Security note: the managed Chromium browser now routes through a loopback-authenticated, public-IP-pinned HTTPS tunnel and checks critical browser files before launch. These protections can prevent local-callback logins and do not prove real-provider compatibility. See [security boundaries (中文)](SECURITY.zh-CN.md).

## Optional peer-reviewed answer (0.10.3)

The initial council always preserves every real participant's final position. It does **not** silently initiate additional web-model requests. After a just-completed meeting, users may explicitly click **Generate reviewed answer**: one actual participant drafts a response grounded in at least two distinct authored discussion events, and the other available original participants each independently review it. Every extra Provider request counts toward that site's limits. Missing, rejected, or malformed reviews never count as approval. All outcomes, dissent, and original source-event IDs are retained for local replay and Markdown export; interrupted reviews are never automatically resent on restart. This workflow is experimentally implemented, not yet verified with live third-party model accounts.

## Full local-history backup and integrity check (0.10.3)

From the History dialog, users may manually export all validated saved meetings and non-secret seat bookmarks as a bounded, SHA-256-checksummed JSON backup. Backup creation and read-only file verification never send Provider prompts or copy managed Chromium profiles/cookies. Backup content is plain text and may include sensitive user prompts and Provider replies: keep the exported file private. Full automatic restore is **not yet available**, and a reinstall may require signing in again. A pending-seat readiness check now preserves access to optional post-meeting peer synthesis instead of mistakenly invalidating the completed conversation.

## Offline Electron ZIP for Windows builds

Maintainers may set CHATCHAT_ELECTRON_DIST to an absolute path to electron-v45.0.0-win32-x64.zip before running npm run package:win. The archive filename, version, architecture, and SHA-256 are checked against the pinned electron npm package checksums before packaging. Invalid archives fail closed. This is a developer build option, not an end-user setup requirement; the normal CI download path remains unchanged.

## Opt-in safe archive restore (0.10.4)

Users can now open History → Preview Restore → Confirm Restore. The backup is inspected locally before a separate native Windows confirmation, re-read and SHA-256 checked immediately before commit, and imported only into missing meeting IDs. Existing meetings are never replaced; credentials, cookies, managed browser profiles, and seat bookmarks are not imported. Historical viewing and restore never dispatch Provider prompts. Import uses app-owned temporary files and no-overwrite hard links; a crash may leave some completed entries, and an idempotent retry skips those rather than overwriting them. A checksum is not a digital signature; restore backups only from trusted sources. Native Electron cancellation, post-preview tamper, and successful import are covered by an offline fixture.

## Manual seats and experimental Provider adapters (0.10.5)

MiniMax, Xiaomi MiMo and custom public HTTPS websites can be added with **+** and opened in their own managed browser for human-operated login and chat. They now show an explicit **Manual seat** state; this is not a failed login or an automated READY participant. Manual seats are excluded from automatic council proposals, deliberation, and synthesis. Two separately verified READY experimental seats are enough for a meeting even if other seats are manual or unavailable.

If a website changes its chat layout, ChatChat now reports a layout/adapter issue rather than falsely claiming the user was logged out. Only a known login route is classified as requiring login. A five-Provider Chromium fixture suite verifies the basic adapter DOM contract and the changed-layout failure behavior for ChatGPT, Claude, DeepSeek, Qwen, and Gemini. The fixtures contain NO real Provider account data, do not contact these sites, and are not live compatibility certifications.
