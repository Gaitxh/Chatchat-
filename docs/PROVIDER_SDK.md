# ChatChat Provider SDK

> A provider is not a seat. A provider becomes a seat only when an adapter can turn it into a `CouncilAgent`.

ChatChat v0.4 introduces the extension boundary that will eventually let real AI websites sit at the Council table.

## The important separation

ChatChat deliberately separates three concepts:

1. **Provider manifest** — recognizes a website such as `chatgpt.com`.
2. **Provider profile** — the user's local configuration for one account/session.
3. **Provider adapter** — executable integration code that can authenticate, send Council turns and return structured contributions.

A URL being recognized does **not** mean the website is already automated.

## Provider manifest

```ts
interface ProviderAdapterManifest {
  id: string;
  providerId: string;
  displayName: string;
  version: string;
  domains: readonly string[];
  defaultUrl: string;
  monogram: string;
  capabilities: {
    webLogin: boolean;
    streaming: boolean;
    councilTurns: boolean;
  };
}
```

v0.4 ships catalog entries for ChatGPT, Claude, Gemini and DeepSeek. Unknown HTTP(S) URLs become `custom.browser` profiles instead of being rejected.

## Local Provider Profile

```ts
interface ProviderProfile {
  profileId: string;
  providerId: string;
  adapterId: string;
  displayName: string;
  url: string;
  origin: string;
  profileKey: string;
  authState: "login_required" | "ready" | "adapter_required" | "error";
  seatState: "bench" | "seated";
  createdAt: string;
  updatedAt: string;
}
```

`profileKey` is an opaque local isolation namespace. It is **not** a password, cookie or provider token.

Desktop profiles live in the same local SQLite database as Council history. Browser development uses localStorage as a fallback.

## Adapter contract

```ts
interface ProviderAdapter {
  readonly manifest: ProviderAdapterManifest;
  matches(url: URL): boolean;
  open(profile: ProviderProfile): Promise<ProviderAdapterSession>;
}

interface ProviderAdapterSession {
  readonly profile: ProviderProfile;
  getAuthState(): Promise<ProviderAuthState>;
  createCouncilAgent(): Promise<CouncilAgent>;
}
```

An adapter is ready for the Council only when `createCouncilAgent()` can produce the same `CouncilAgent` interface already used by deterministic mocks.

That means the Council engine does not care whether an advisor is powered by:

- a web UI adapter,
- an official API,
- an OpenAI-compatible endpoint,
- Ollama / LM Studio / vLLM,
- or another local model runtime.

## Planned web-login lifecycle

v0.5 will implement the runtime side of web profiles:

```text
ProviderProfile
      ↓
local isolated webview profile
      ↓
user logs in themselves
      ↓
auth state becomes READY
      ↓
Adapter creates CouncilAgent
      ↓
advisor may take a seat
```

The design goal is that ChatChat never asks the user to paste a password or upload a session cookie to a ChatChat server. There is no ChatChat relay server.

Webview storage isolation is platform-specific, so v0.5 must treat it as a runtime concern rather than baking a single path assumption into the Provider SDK.

## Adapter responsibilities

A real web adapter will eventually be responsible for:

- matching the correct provider URL,
- opening or attaching to the provider's local login webview,
- detecting whether the user is logged in,
- starting a clean conversation,
- injecting a Council turn,
- detecting generation start/end,
- extracting the provider response,
- converting the response into structured `CouncilContribution[]`,
- handling page changes without corrupting the Council state,
- failing explicitly when selectors or behavior are no longer compatible.

Adapters should never silently fabricate a successful response.

## Suggested community layout

```text
providers/
├── chatgpt-web/
├── claude-web/
├── gemini-web/
├── deepseek-web/
└── custom-example/
```

A future community adapter should be independently testable against recorded DOM fixtures so provider-site UI changes can be diagnosed without running an entire Council.

## Security principle

**Provider pages are untrusted external content.**

Future adapters should receive the minimum local capabilities required for their job. ChatChat should not expose arbitrary filesystem or shell access to a provider webview.

The theatrical rule stays the same:

> 外面是宫廷，里面是科研。
