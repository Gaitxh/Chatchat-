(() => {
  const selector = __CHATCHAT_RESPONSE_SELECTOR_JSON__;
  const limit = 100000;
  try {
    const elements = Array.from(document.querySelectorAll(selector));
    const element = elements.at(-1) ?? null;
    const raw = element?.textContent ?? '';
    return {
      ok: true,
      count: elements.length,
      text: raw.slice(0, limit),
      truncated: raw.length > limit
    };
  } catch (error) {
    return { ok: false, count: 0, text: '', truncated: false, error: String(error) };
  }
})()
