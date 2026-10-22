# ChatChat Windows Desktop

A standalone Windows desktop deliberation harness—not a browser extension or PWA.

The per-user Setup.exe bundles Electron and a separate full Chromium runtime. Users need no Node, Python, Git, browser extension, developer mode or mandatory API key. Install, open ChatChat, click a + seat, and sign in directly on the provider website in the managed browser. The app retains its own login profiles and never imports a personal Chrome/Edge profile.

See [中文安装与使用说明](README.zh-CN.md). Online providers still need internet access. This unsigned developer preview targets Windows 10/11 x64; Native Windows 11 tests and installer packaging have passed, but do not establish first-install/upgrade/uninstall acceptance or live-provider compatibility. Do not disable OS security protections.

Core deliberation preserves independent first opinions, later shared snapshots, revisions, dissent and runtime failure provenance. A preview seat catalog is not a universal compatibility promise. Unsupported providers remain manual/non-ready, not fabricated automatic participants.

Security note: the managed Chromium browser now routes through a loopback-authenticated, public-IP-pinned HTTPS tunnel and checks critical browser files before launch. These protections can prevent local-callback logins and do not prove real-provider compatibility. See [security boundaries (中文)](SECURITY.zh-CN.md).
