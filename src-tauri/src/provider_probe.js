(() => {
  try {
    const visible = (element) => { const style = window.getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; };
    const describe = (element) => ({ tag: element.tagName.toLowerCase(), id: element.id || null, role: element.getAttribute('role'), ariaLabel: element.getAttribute('aria-label'), placeholder: element.getAttribute('placeholder'), dataTestId: element.getAttribute('data-testid'), inputType: element.getAttribute('type'), contentEditable: element.isContentEditable === true, disabled: element.matches(':disabled') });
    const composers = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])')).filter(visible).slice(0,12).map(describe);
    const actions = Array.from(document.querySelectorAll('button')).filter(visible).map(describe).filter((item)=>item.id||item.role||item.ariaLabel||item.dataTestId).slice(0,24);
    return { ok:true,url:window.location.href,origin:window.location.origin,title:document.title,readyState:document.readyState,composerCandidates:composers,actionCandidates:actions,counts:{forms:document.forms.length,textareas:document.querySelectorAll('textarea').length,contentEditables:document.querySelectorAll('[contenteditable="true"]').length,buttons:document.querySelectorAll('button').length},probedAt:new Date().toISOString() };
  } catch (error) { return {ok:false,url:window.location.href,origin:window.location.origin,title:document.title,readyState:document.readyState,composerCandidates:[],actionCandidates:[],counts:{forms:0,textareas:0,contentEditables:0,buttons:0},probedAt:new Date().toISOString(),error:String(error)}; }
})()
