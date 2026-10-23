# ChatChat local preview release process

The current distribution target is the Manifest V3 browser extension. Its standalone room window runs on Chrome/Edge. The local package is an **unsigned developer preview**, not a finished signed desktop application or browser-store release. Keep `0.x` versioning until the evidence supports a stable release.

## Build a reviewable local package

Maintainers use the repository root:

```bash
npm ci
npm run check
npm test
npm run test:package
npm run package:local
npm run check:package
```

`package:local` runs the existing production extension build and validation, then creates:

```text
dist/local-package/
  chatchat-<version>-unsigned-developer-preview.zip
  RELEASE-METADATA.json
  SHA256SUMS
```

The ZIP opens to:

```text
START-HERE.html
start-here.css
extension/                 # complete production dist-extension tree
docs/                      # English/Chinese installation and release/roadmap notes
RELEASE-METADATA.json
SHA256SUMS                 # all payload files except this checksum file
```

All public assets are included through the ordinary Vite build, including new welcome and room-launcher files. Packaging fails if public source assets are missing or differ from their built copies, manifest and package versions disagree, required entries or HTML asset references are missing, or path/size checks fail. The existing extension validator also runs. `package:extension` packages an already completed build; `check:package` recomputes outputs and rejects differences without writing them. Build again whenever source changes; these checks do not prove every compiled source module is current.

ZIP entry order and timestamps are fixed. Identical payload and source metadata produce identical ZIP bytes. Git metadata records the commit and clean/modified state when available; unavailable information is explicitly `null`/`unknown`. A modified tree must not be presented as an exact build of the named commit. No local paths, account identifiers or credentials are added to metadata. The complete production tree is shipped, so maintainers must keep private data out of it.

The outer `SHA256SUMS` covers the ZIP and metadata. Checksums detect corruption or changed bytes; they are not a publisher signature. Do not describe this as signed, notarized, store-approved or automatically updated.

## Manual artifact workflow

`.github/workflows/local-package.yml` is triggered only through **workflow_dispatch**. It installs development dependencies, runs existing checks and tests plus the focused package tests, builds the extension, validates the local package, and uploads the ZIP/checksums/metadata as a GitHub Actions artifact.

The workflow has read-only repository permissions. It does not publish a GitHub Release, browser-store listing or native installer, and requires no signing keys or provider credentials. A workflow artifact is a maintainer candidate, not proof of provider compatibility. Its existence here does not mean a hosted run has succeeded.

The existing `ci.yml` checks the browser product and synthetic bilingual UI. Rust/Tauri compilation is not a gate of this browser-package workflow. The legacy native source is under `apps/desktop/src-tauri/`; there is no current `release-candidate.yml` native packaging workflow. Do not follow obsolete instructions referring to a root `src-tauri/` release config or claim an absent workflow produces signed desktop bundles.

## Validate the right claims

Before sharing a preview, verify the extracted package in a separate test browser profile: load `extension/` manually, pin the icon, open the room, read the offline guide, and check update behavior. This is a manual follow-up, not something the packaging tests have established.

Real provider validation is separate and user-authorized. A user must grant explicit origin permission and sign in on the provider’s own website in the same browser profile. Use fresh provider chats for each meeting. Preserve independent equal peers, sealed first-round responses, shared immutable later-round snapshots, and visible differing final positions. Synthetic/demo sessions are not live provider evidence; packaging must not log in or automate real websites.

Describe compatibility using the contribution guide’s **recognized → teachable → test-passed → consultation-ready → runtime-validated → officially supported** vocabulary and document the actual environment and limits. Do not equate a recognized URL, an open window, a package test or a synthetic fixture with login readiness. Never promise arbitrary websites will work. Local coordination does not turn cloud inference into local inference.

Before stable distribution, document privacy-safe live multi-provider evidence, update/history/export behavior, known browser limitations, signing/store status and maintained compatibility targets. Never include private account data in release evidence.

See [English installation](LOCAL_INSTALL.md), [中文安装](LOCAL_INSTALL.zh-CN.md), and the [desktop roadmap](LOCAL_DESKTOP_ROADMAP.zh-CN.md). A future signed native installer and browser helper require their own implementation, threat review, signing/updater process and validation; they are not delivered by this ZIP.
