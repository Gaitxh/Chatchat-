> Legacy extension preview instructions. / 旧扩展预览说明。Windows 桌面用户请改读 [桌面版安装说明](../desktop/README.zh-CN.md)。

# Local installation · unsigned developer preview

This deliverable is a prebuilt browser extension with a browser-backed standalone consultation window. It requires desktop Chrome or Edge. It is not a signed native desktop application, a store release, or an offline AI model. End users need no Node, Git, Rust, source checkout, or terminal.

中文：[本地安装说明](LOCAL_INSTALL.zh-CN.md).

## Install a prebuilt package

1. Obtain `chatchat-<version>-unsigned-developer-preview.zip` from a maintainer. Extract the entire ZIP to a stable location you will keep. Open `START-HERE.html` for the bilingual offline guide. The package contains `extension/`, documentation, `RELEASE-METADATA.json`, and `SHA256SUMS`.
2. In the browser profile used for your AI websites, open `chrome://extensions` in Chrome or `edge://extensions` in Edge. Enable **Developer mode**, choose **Load unpacked**, and select the extracted **`extension/`** directory, which contains `manifest.json`. Select neither the ZIP nor its parent directory.
3. Use the browser’s Extensions menu to pin ChatChat, then click its icon to open the consultation room. Its standalone window is backed by the browser and uses that browser profile. Keep Chrome/Edge available; this is not an independent native runtime.
4. Choose your AI seats. Sign in manually on each provider’s own website in the **same browser profile**. A different Chrome/Edge profile does not share those sessions. Grant explicit site access to the origins you choose when asked. Site access, account login and connection readiness are separate; an open tab or recognized site is not proof of readiness.
5. Use fresh provider chats for each meeting, leaving existing private conversations out of meeting inputs. Check each seat’s connection status and complete any manual login or connection step shown. Choose at least two distinct sources for a peer consultation, then send one proposal. Every source participates equally; no chair has privileged authority.

There is no automatic installation. If a managed browser blocks Developer mode or Load unpacked, contact your administrator or wait for store distribution. Do not change enterprise policies to make this package load.

## Local orchestration, cloud inference

Meeting coordination and history stay in your browser profile. Prompts sent to selected AI websites are processed by those cloud providers under their own terms and account requirements. This download contains neither provider accounts nor offline models.

No arbitrary-site compatibility is guaranteed. Recognized URLs, taught selectors, synthetic demonstrations, successful package validation and a working window do not establish live provider readiness. Keep synthetic/demo sessions and live provider sessions separate. This packaging deliverable includes no provider login test or real website automation.

## Update and remove

Export important records **before updating or uninstalling**, using the room’s available record/receipt export or copy controls, and save them yourself. Exported records are not a guarantee of full restore. History is local to the current browser profile and extension ID; it is not a backup service.

Close meeting windows. Keep the installed extension, the **same folder path**, and the **same browser profile**. Replace the contents of the existing `extension/` folder with the new version (remove obsolete files), then click **Reload** on ChatChat’s extension-manager card. This keeps the unpacked extension ID and associated local history. Do not load a second version from a different path and expect it to inherit history. Moving the folder, changing profiles, clearing browser extension data, or removing and reinstalling the extension can break continuity.

To uninstall, export first, then choose **Remove** in the extension manager. ChatChat does not migrate or export your provider’s cloud-side chat history.

## Package identity and checksums

The maintainer output directory includes the versioned ZIP, `RELEASE-METADATA.json`, and `SHA256SUMS`. The external checksum file covers the ZIP and metadata. Inside the ZIP, another `SHA256SUMS` covers every payload file except itself. These detect changed bytes; without an authenticated source they do not authenticate a publisher. Checking them with an existing checksum tool is optional for installation.

Metadata records package version, Git commit when available, working-tree state, and the unsigned preview label. A modified tree is not identical to its named commit; `null`/`unknown` means commit information was unavailable. No build time, machine username, local absolute paths, credentials or account data are intentionally included. Do not add private material to the production assets: the entire extension build is shipped.

## Maintainers only

With project development prerequisites installed:

```bash
npm ci
npm run check
npm test
npm run test:package
npm run package:local
npm run check:package
```

`package:local` performs the ordinary production extension build, its existing validator, then packages it. Output is `dist/local-package/`. To package an **already completed** build without rebuilding, use `npm run package:extension`. Do not run these against a build another process is still writing.

Packaging copies the complete `dist-extension/` tree under `extension/`, including all public assets copied by Vite, such as `welcome.*` and `room-launcher.js` when present. It checks manifest/package version agreement, optional site permissions, required entries, built HTML asset references, and byte equality of every `extension-public/` file against the build. Missing, empty or inconsistent required artifacts fail packaging. The package check recomputes and compares outputs; it cannot prove a cloud website works or prove all compiled code matches uncommitted source edits. Build afresh before distribution.

The dependency-free ZIP writer uses stored entries, UTF-8 names, fixed timestamps, CRC32, SHA-256 checksums, and sorted paths. It rejects symlinks, non-regular files, unsafe/colliding paths, excessive nesting and oversized input. Limits: 4,096 archive files, 32 MiB per file, 128 MiB total file data, and 24 path segments. Each input tree also has a 4,096-entry traversal cap. No ZIP64 or compression is used.

See [release process](RELEASE.md) and [desktop roadmap](LOCAL_DESKTOP_ROADMAP.zh-CN.md).

### Conservative automatic connection

Automatic readiness accepts only a new reply in a recognized assistant-authored region. A page without those markers needs an explicitly taught response region; the runtime does not treat the user prompt echo, a historical READY token, or whole-page text as a successful new assistant reply. The package is not an all-provider compatibility certification.

For a new topic, remove and add the seats again, and check the actual provider page is a new conversation. This preview does not certify automatic context clearing or fresh-chat rollover across meetings on every provider.
