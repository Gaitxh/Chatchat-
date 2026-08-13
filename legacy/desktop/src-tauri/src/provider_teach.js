(() => {
  window.__CHATCHAT_TEACH_CLEANUP__?.();
  window.__CHATCHAT_TEACH_SELECTION__ = null;

  const role = __CHATCHAT_ROLE_JSON__;
  const marker = document.createElement('div');
  marker.textContent = 'ChatChat Teach Mode · ' + role + ' · click one element';
  Object.assign(marker.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#102330',
    color: '#f2d28f',
    border: '1px solid #caa85f',
    font: '600 12px system-ui',
    pointerEvents: 'none'
  });
  document.documentElement.appendChild(marker);

  let hovered = null;
  const esc = (value) => CSS.escape(value);
  const attr = (value) => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const unique = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };

  const targetFor = (raw) => {
    if (!(raw instanceof Element)) return null;
    if (role === 'composer') {
      return raw.closest('textarea, input, [contenteditable="true"]');
    }
    if (role === 'send') {
      return raw.closest('button, [role="button"]');
    }
    return raw.closest(
      '[data-message-author-role], [data-testid], article, [role="article"], [role="listitem"]'
    ) || raw;
  };

  const selectorFor = (el) => {
    if (el.id) {
      const selector = '#' + esc(el.id);
      if (unique(selector)) return selector;
    }

    const attributes = ['data-testid', 'data-message-author-role', 'aria-label'];
    for (const name of attributes) {
      const value = el.getAttribute(name);
      if (!value) continue;
      const selector = el.tagName.toLowerCase() + '[' + name + '="' + attr(value) + '"]';
      if (unique(selector) || name === 'data-message-author-role') return selector;
    }

    const roleValue = el.getAttribute('role');
    if (roleValue) {
      const selector = el.tagName.toLowerCase() + '[role="' + attr(roleValue) + '"]';
      if (unique(selector)) return selector;
    }

    const parts = [];
    let node = el;
    for (let depth = 0; node && node !== document.body && depth < 6; depth += 1) {
      let part = node.tagName.toLowerCase();
      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).filter((candidate) => candidate.tagName === node.tagName)
        : [];
      if (siblings.length > 1) {
        part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      const candidate = parts.join(' > ');
      if (unique(candidate)) return candidate;
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const clear = () => {
    if (hovered) hovered.style.outline = '';
    marker.remove();
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('click', pick, true);
    window.__CHATCHAT_TEACH_CLEANUP__ = null;
  };

  const move = (event) => {
    const target = targetFor(event.target);
    if (target === hovered) return;
    if (hovered) hovered.style.outline = '';
    hovered = target;
    if (hovered) hovered.style.outline = '2px solid #e4bd68';
  };

  const pick = (event) => {
    const target = targetFor(event.target);
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const inputType = target.getAttribute('type');
    const sensitive = inputType && inputType.toLowerCase() === 'password';
    const base = {
      role,
      selector: sensitive ? '' : selectorFor(target),
      tag: target.tagName.toLowerCase(),
      id: target.id || null,
      ariaLabel: target.getAttribute('aria-label'),
      dataTestId: target.getAttribute('data-testid'),
      dataMessageAuthorRole: target.getAttribute('data-message-author-role'),
      inputType,
      contentEditable: target.isContentEditable === true,
      selectedAt: new Date().toISOString()
    };

    window.__CHATCHAT_TEACH_SELECTION__ = sensitive
      ? { ...base, error: 'Password fields cannot be taught.' }
      : base;

    clear();
    setTimeout(() => {
      window.location.href = 'chatchat-teach://selected';
    }, 0);
  };

  window.__CHATCHAT_TEACH_CLEANUP__ = clear;
  document.addEventListener('pointermove', move, true);
  document.addEventListener('click', pick, true);

  return { armed: true, role };
})()
