## What changed?

<!-- Describe the user-visible change and why ChatChat needs it. -->

## Layer

- [ ] Council Protocol / Blackboard
- [ ] Provider / Browser Bridge
- [ ] UI / Demo Theater
- [ ] Local history / persistence
- [ ] CI / packaging / release
- [ ] Documentation / community

## Verification

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` (if desktop/Rust changed)
- [ ] Gate-B real Provider validation documented (if live website behavior changed)

## Trust & privacy

- [ ] No passwords, cookies, tokens, private chats or account identifiers are included.
- [ ] Remote Provider content is still treated as untrusted.
- [ ] Provider pages did not receive new native/Tauri capabilities without an explicit security rationale.
- [ ] Any page-reading behavior is scoped to the narrowest necessary surface.

## Compatibility wording

- [ ] I did not use `supported` when I only proved `recognized`, `teachable`, `test-passed` or `council-ready`.
- [ ] Any runtime validation includes OS, ChatChat version/commit and Provider UI date.

## Council invariants

- [ ] Round 1 remains sealed.
- [ ] Models may disagree, revise, concede and remain uncertain.
- [ ] A failing advisor degrades safely instead of fabricating a confident answer.
- [ ] Minority opinions are not silently discarded.

## Screenshots / recordings

<!-- If UI changed, include a screenshot from the real build. If it shows a Provider account, remove all sensitive account/sidebar data first. -->
