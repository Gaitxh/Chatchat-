# ChatChat Teach Mode

> Three clicks turn an unknown page layout into a local Adapter Recipe.

Teach Mode is the bridge between **“ChatChat can open this AI website”** and **“ChatChat knows where to interact with this AI website.”**

It is deliberately user-guided. Instead of shipping a brittle CSS selector for every provider and hoping it never changes, the user can teach ChatChat the current page layout on their own machine.

## Flow

```text
Provider Profile
      ↓
LOGIN · isolated WebView
      ↓
(optional) 御前试音 / DOM probe
      ↓
教我输入框
      ↓
user clicks composer
      ↓
教我发送按钮
      ↓
user clicks send control
      ↓
教我回答区域
      ↓
user clicks assistant-response surface
      ↓
Adapter Recipe · 3/3
```

## What is stored

A recipe contains only locally generated selectors:

```ts
interface AdapterRecipe {
  profileId: string;
  composerSelector: string | null;
  sendSelector: string | null;
  responseSelector: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Desktop recipes are stored in `sqlite:chatchat.db`. Browser development uses localStorage.

Recipes are tied to a local Provider Profile and are removed when that profile is removed.

## Selection UX

When a Teach step starts, ChatChat injects a temporary local selection overlay into the managed Provider WebView:

- a small `ChatChat Teach Mode` marker appears at the top;
- hovering a valid candidate adds a gold outline;
- clicking prevents the provider page's normal click action;
- ChatChat generates a selector from stable-looking attributes when possible;
- the selection is returned to the local ChatChat window;
- the overlay cleans itself up.

Selector preference is roughly:

1. unique `id`;
2. `data-testid`;
3. `data-message-author-role`;
4. `aria-label`;
5. unique `role` selector;
6. short structural path using `:nth-of-type` only when needed.

The generated recipe is diagnostic data, not a claim that the selector will remain stable forever.

## Privacy and safety boundaries

Teach Mode records **where an element is**, not the private content inside it.

It does not intentionally read or save:

- cookies;
- localStorage/sessionStorage;
- composer text values;
- passwords;
- conversation body text;
- account names or tokens.

Password inputs are rejected in two layers:

1. the injected selection script returns an error instead of a selector;
2. TypeScript recipe validation refuses any selection whose input type is `password`.

Teach commands may only be invoked by the local `main` ChatChat window, and selection is only armed when the managed WebView is on the expected Provider host.

Provider remote pages still receive no ChatChat remote capability.

## Why use a custom navigation signal?

The provider page itself is intentionally not granted a ChatChat IPC API.

After a click, the injected selector stores the result in an ephemeral in-page variable and attempts navigation to:

```text
chatchat-teach://selected
```

The WebView host intercepts and cancels that navigation. Rust then emits a local event to the `main` ChatChat window, which asks the host to read the temporary selection result.

So the completion signal crosses the host boundary without granting arbitrary ChatChat commands to the remote page.

## A 3/3 recipe is not yet a speaking advisor

Teach Mode solves **element discovery**, not the complete Browser Adapter lifecycle.

The next execution layer still needs to safely implement:

- validate that all taught selectors still resolve;
- put a Council turn into the composer;
- dispatch the correct input/change events;
- activate the send control;
- detect generation start/end;
- read only the taught assistant-response surface;
- enforce timeouts and response size limits;
- return the response to a provider-specific parser;
- convert it into `CouncilContribution[]`;
- only then expose a real `CouncilAgent`.

Until that succeeds, ChatChat must not mark the advisor `READY` or give it a Council seat.
