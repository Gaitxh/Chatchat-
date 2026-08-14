# Evidence Verifier Safety Boundary

ChatChat treats every URL claimed by an AI participant as untrusted input. Source Observation is a bounded convenience check, not a general-purpose browser or crawler.

## What the verifier promises

Before a request is sent, ChatChat accepts only ordinary `http` / `https` URLs on their default ports. It rejects localhost, single-label intranet names, common local-service suffixes, non-public IPv4 ranges, and non-public / transition IPv6 literal ranges. Embedded credentials and URL fragments are removed.

Requests omit credentials, send no referrer, bypass cache, time out after 8 seconds, and read at most 256 KiB. The verifier never automatically follows an HTTP redirect. If a source redirects, ChatChat fails closed and asks for the final public URL instead.

That redirect rule is a security invariant: checking a final URL after an automatic redirect is too late, because the redirected request has already been sent.

## What the verifier does **not** promise

A hostname that looks public can theoretically resolve differently over time or resolve to non-public infrastructure. The current Stable-browser architecture does not pre-resolve and attest DNS answers before `fetch`, so ChatChat does **not** claim complete DNS-rebinding protection.

Do not “solve” that limitation by silently sending user evidence domains to a third-party DNS service. That would introduce a new privacy boundary and must be an explicit product/security decision.

## Contributor invariants

Keep `redirect: "manual"` in the Evidence fetch path. Do not reintroduce `redirect: "follow"` for convenience or short-link compatibility. Expand the local URL boundary conservatively when new non-public address forms are discovered, and keep `tests/source-extract.test.mjs` as the executable contract.
