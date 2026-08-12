# ChatChat Release Process

ChatChat should not call itself `v1.0` merely because the code compiles.

The first stable release has two separate evidence gates.

## Gate A — repository automation

Required before a release candidate is interesting:

```text
TypeScript type checks
Council Core tests
Provider SDK tests
Teach Mode tests
Test Speech tests
Real Council Bridge tests
Provider Window Health tests
production Vite build
real production UI screenshot
Rust/Tauri compile
```

The normal CI workflow runs these deterministic checks.

## Gate RC — desktop packaging

`.github/workflows/release-candidate.yml` is intentionally manual.

It builds unsigned desktop candidates on:

```text
macOS
Ubuntu 22.04
Windows
```

The workflow:

1. installs Node/Rust and platform prerequisites;
2. runs Gate-A TypeScript/tests again;
3. generates platform icons from `assets/chatchat-avatar-pixel.png`;
4. enables bundling through `src-tauri/tauri.release.conf.json`;
5. runs the official Tauri GitHub action;
6. uploads candidate bundle directories as GitHub Actions artifacts.

It does **not** automatically publish a public GitHub Release and does not imply binaries are signed/notarized.

### Why candidates are unsigned for now

Signing/notarization introduces platform credentials and secret-management policy. That should be added deliberately after the project has a maintainer release process, rather than putting long-lived signing secrets into the repository on day one.

Unsigned artifacts are suitable for maintainers to verify packaging mechanics. Public stable distribution should document platform warning behavior and signing status explicitly.

## Gate B — real Provider validation

A real web Provider cannot be fully validated by GitHub CI because CI cannot sign into the user's external AI account.

Before calling a Provider compatibility target runtime-validated, perform:

```text
Invite URL
→ isolated WebView login
→ Provider Window Health
→ metadata probe
→ Teach Recipe 3/3
→ Test Speech
→ Council Gate
→ Fresh Session
→ Hybrid Council
→ Live Council with another real Provider
```

Use [`MANUAL_PROVIDER_TEST.md`](MANUAL_PROVIDER_TEST.md) and the Provider compatibility issue form.

## Proposed v1.0 minimum bar

Before publishing the first stable release:

- Gate A green on `main`;
- Release Candidate workflow produces artifacts on all three desktop OS jobs;
- Provider Window Health has no known ghost-seat bug;
- at least two real Provider configurations have documented user-local Gate-B validation so a real-only Council can actually be demonstrated;
- README contains a privacy-reviewed real LIVE Council screenshot/GIF in addition to the deterministic production-build screenshot;
- compatibility wording uses the project's recognized/teachable/test-passed/council-ready/runtime-validated vocabulary;
- release notes state signing/notarization status honestly;
- no secrets or account data appear in committed demo assets.

## Versioning before v1

Until that bar is reached, continue `0.x` versions even if the internal milestone is called “v1 readiness.”

A version number should summarize evidence, not ambition.

## Future stable release automation

Once v1 is validated, the manual candidate workflow can evolve into a tag-driven release workflow using the same Tauri build matrix, adding:

- GitHub Release creation;
- changelog generation;
- code signing/notarization;
- updater artifacts/signatures if ChatChat adopts Tauri's updater;
- provenance/SBOM where practical.

Keep release publication separate from Provider compatibility claims: a binary can be correctly packaged while a third-party website changes its UI the next morning.
