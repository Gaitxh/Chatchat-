(() => {
  const selector = __CHATCHAT_COMPOSER_SELECTOR_JSON__;
  const message = __CHATCHAT_MESSAGE_JSON__;
  try {
    const element = document.querySelector(selector);
    if (!element) return { ok: false, error: 'Taught composer selector no longer resolves.' };
    if (element.matches('input[type="password"]')) return { ok: false, error: 'Refusing to write into a password field.' };
    element.focus();

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (!setter) return { ok: false, error: 'No native value setter is available for the taught composer.' };
      setter.call(element, message);
      try {
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
      } catch {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, kind: element.tagName.toLowerCase() };
    }

    if (element.isContentEditable) {
      element.textContent = message;
      try {
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
      } catch {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return { ok: true, kind: 'contenteditable' };
    }

    return { ok: false, error: 'Taught composer is not an input, textarea, or contenteditable surface.' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
})()
