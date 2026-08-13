## What does this add to ChatChat?

Describe the user-facing behavior or protocol change.

## Product check

- [ ] The primary browser experience still treats AI sources as independent, equal participants.
- [ ] I did not introduce a hidden chair/leader/delegation weighting into the consultation result.
- [ ] Round 1 independence and later shared-snapshot semantics remain intact where relevant.
- [ ] Different final positions remain visible instead of being silently collapsed.

## International UI

- [ ] New primary Side Panel copy is available in English and Simplified Chinese, or this PR does not add user-facing copy.
- [ ] Machine-readable event kinds remain language-neutral.

## Browser / privacy

- [ ] New site access is optional and user-initiated where possible.
- [ ] I did not commit passwords, cookies, tokens, private account identifiers or private conversations.
- [ ] Provider webpage content is treated as untrusted external content.
- [ ] This PR does not claim universal Provider support from a detector/unit test alone.

## Validation

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build:extension`

If this changes the primary Side Panel, please include or point to the deterministic bilingual CI showcase rather than using a screenshot from a private logged-in account.
