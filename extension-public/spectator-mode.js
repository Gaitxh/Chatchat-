(() => {
  if (document.documentElement.dataset.surface !== "web-app") return;
  const KEY = "chatchat.spectator.mode.v1";
  const locale = () => document.documentElement.lang?.toLowerCase().startsWith("zh") ? "zh" : "en";
  const copy = {
    en: { label:"SPECTATOR", quiet:"Quiet", live:"Live", arena:"Arena", quietHint:"Focus on the proposal and outcome.", liveHint:"Watch public turning points.", arenaHint:"Open the full event-backed relationship battlefield." },
    zh: { label:"观赛模式", quiet:"安静", live:"直播", arena:"竞技场", quietHint:"专注提案和最终结果。", liveHint:"观看公开的关键转折。", arenaHint:"打开完整的、由真实事件驱动的 AI 关系战场。" }
  };
  const root = document.getElementById("spectator-mode-root");
  if (!root) return;
  let mode = localStorage.getItem(KEY);
  if (!["quiet","live","arena"].includes(mode)) mode = "live";
  root.className = "spectator-control";
  const render = () => {
    document.documentElement.dataset.spectatorMode = mode;
    localStorage.setItem(KEY, mode);
    const t = copy[locale()];
    root.innerHTML = `<span>${t.label}</span><div class="spectator-buttons"><button data-mode="quiet">◌ ${t.quiet}</button><button data-mode="live">◉ ${t.live}</button><button data-mode="arena">⚡ ${t.arena}</button></div><small>${mode==="quiet"?t.quietHint:mode==="arena"?t.arenaHint:t.liveHint}</small>`;
    for (const button of root.querySelectorAll("button")) {
      if (button.dataset.mode === mode) button.classList.add("is-active");
      button.addEventListener("click", () => { mode = button.dataset.mode; render(); });
    }
  };
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  render();
})();
