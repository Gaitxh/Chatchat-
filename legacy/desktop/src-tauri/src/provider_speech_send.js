(() => {
  const selector = __CHATCHAT_SEND_SELECTOR_JSON__;
  try {
    const element = document.querySelector(selector);
    if (!element) return { ok: false, error: 'Taught send selector no longer resolves.' };
    const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
    if (disabled) return { ok: false, error: 'Taught send control is disabled after composer input.' };
    if (!(element instanceof HTMLElement)) return { ok: false, error: 'Taught send selector is not an HTMLElement.' };
    element.focus();
    element.click();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
})()
