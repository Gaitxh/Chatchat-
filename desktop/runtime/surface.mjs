/** Runs only in the pinned page's main frame. No account, sidebar, cookie or storage reads. */
export function managedPageSurface({ origin, adapter, action = 'inspect', expectedPrompt, capture, expectedChatUrl }) {
  if (location.origin !== origin) return { issue: 'ORIGIN_DRIFT' };
  if (expectedChatUrl && location.href !== expectedChatUrl) return { issue: 'UNEXPECTED_CHAT' };
  if (/(?:^|\/)(?:auth|oauth|oauth2|login|log-in|signin|sign-in|signup|sign-up|accounts?|sso|challenge|captcha)(?:\/|$)/i.test(location.pathname)) {
    return { issue: 'LOGIN_REQUIRED' };
  }
  const visible = (element) => {
    const style = getComputedStyle(element);
    return element.isConnected && !element.closest('[inert], [aria-hidden="true"]')
      && style.display !== 'none' && style.visibility !== 'hidden'
      && element.getClientRects().length > 0;
  };
  const roots = (elements) => [...new Set(elements)].filter((element, _, all) =>
    !all.some((other) => other !== element && other.contains(element)));
  const scopes = roots([...document.querySelectorAll(adapter.scope)].filter(visible));
  if (scopes.length !== 1) return { issue: scopes.length ? 'AMBIGUOUS_SURFACE' : 'SURFACE_UNAVAILABLE' };
  const scope = scopes[0];
  const editors = [...scope.querySelectorAll(adapter.composer)].filter((element) => visible(element)
    && (element.tagName === 'TEXTAREA' || element.isContentEditable)
    && !element.disabled && element.getAttribute('aria-disabled') !== 'true'
    && !element.readOnly && element.getAttribute('autocomplete') !== 'current-password'
    && element.getAttribute('autocomplete') !== 'username');
  if (editors.length !== 1) return { issue: editors.length ? 'AMBIGUOUS_SURFACE' : 'SURFACE_UNAVAILABLE' };
  const editor = editors[0];
  // The send control must share the composer's nearest unambiguous container.
  let container = editor.parentElement;
  let send = null;
  for (let depth = 0; container && scope.contains(container) && depth < 12; depth++, container = container.parentElement) {
    const buttons = [...container.querySelectorAll(adapter.send)].filter((element) => element.tagName === 'BUTTON' && visible(element));
    if (buttons.length > 1) return { issue: 'AMBIGUOUS_SURFACE' };
    if (buttons.length === 1) { send = buttons[0]; break; }
    if (container === scope) break;
  }
  if (!send) return { issue: 'SURFACE_UNAVAILABLE' };
  const users = roots([...scope.querySelectorAll(adapter.user)]);
  const assistants = roots([...scope.querySelectorAll(adapter.assistant)]);
  if (users.length > 512 || assistants.length > 512) return { issue: 'UNEXPECTED_CHAT' };
  const draft = editor.tagName === 'TEXTAREA' ? editor.value : editor.innerText;
  const hasDraft = Boolean(draft?.trim());
  const matchesPrompt = expectedPrompt === undefined ? undefined : draft === expectedPrompt;
  const busy = [...scope.querySelectorAll(adapter.busy)].some(visible);
  const sendEnabled = !send.disabled && send.getAttribute('aria-disabled') !== 'true';
  if (action === 'composer') return editor;
  if (action === 'send') {
    if (!matchesPrompt || busy || !sendEnabled || users.length !== capture.users || assistants.length !== capture.assistants) return null;
    return send;
  }
  const result = { hasDraft, matchesPrompt, busy, sendEnabled, userCount: users.length, assistantCount: assistants.length };
  // Read ONLY the newly added user bubble, and only when capturing an
  // explicitly sent prompt. Never inspect existing/private transcript turns.
  if (capture && typeof capture.expectedPrompt === 'string'
    && users.length === capture.users + 1
    && assistants.length <= capture.assistants + 1) {
    const normalize = (text) => text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
    const bubble = users.at(-1);
    const rendered = bubble.innerText;
    const expected = normalize(capture.expectedPrompt);
    // Chromium innerText collapses source newlines when a Provider renders a
    // multi-line prompt in an ordinary div. Check the exact underlying
    // textContent only as a fallback; this preserves meaningful source
    // whitespace without accepting a different textual prompt.
    const raw = typeof rendered === 'string' && normalize(rendered) !== expected
      ? bubble.textContent : undefined;
    result.userPromptMatches = visible(bubble) && (
      typeof rendered === 'string' && normalize(rendered) === expected
      || typeof raw === 'string' && normalize(raw) === expected
    );
  }
  // Capture exactly one new assistant turn after exactly one user turn.
  if (capture && users.length === capture.users + 1 && assistants.length === capture.assistants + 1) {
    const assistant = assistants.at(-1);
    const contents = roots([...assistant.querySelectorAll(adapter.text)]).filter(visible);
    if (!contents.length) return { ...result, issue: 'REPLY_UNAVAILABLE' };
    const text = contents.map((element) => element.innerText).join('\n');
    if (text.length > 65_536) return { ...result, issue: 'RESPONSE_TOO_LARGE' };
    result.responseText = text;
    // Some sites put the copy action on the message's immediate wrapper.
    const parent = assistant.parentElement;
    const controls = parent && parent !== scope && scope.contains(parent)
      && roots([...parent.querySelectorAll(adapter.assistant)]).length === 1 ? parent : assistant;
    result.replyComplete = [...controls.querySelectorAll(adapter.complete)].some(visible);
  }
  return result;
}
