(() => {
  if (document.documentElement.dataset.surface !== "web-app") return;

  function init() {
    const MODE_KEY = "chatchat.spectator.mode.v1";
    const MODES = new Set(["quiet", "live", "arena"]);
    const root = document.getElementById("spectator-mode-root");
    if (!root || root.dataset.mounted === "true") return;
    root.dataset.mounted = "true";
    const style = document.createElement("style");
    style.dataset.chatchatSpectator = "true";
    style.textContent = `
      .spectator-control{position:fixed;z-index:90;top:18px;right:20px;width:min(360px,calc(100vw - 40px));padding:10px 12px;border:1px solid rgba(44,41,36,.13);border-radius:14px;background:rgba(250,248,243,.94);box-shadow:0 14px 42px rgba(34,31,27,.13);backdrop-filter:blur(18px)}
      .spectator-control>span{display:block;margin-bottom:6px;color:#837d73;font-size:8px;font-weight:850;letter-spacing:.12em}.spectator-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
      .spectator-buttons button{border:0;border-radius:8px;padding:7px 8px;background:#ebe8e0;color:#716c63;font-size:9px;font-weight:760}.spectator-buttons button.is-active{background:#1d2025;color:#fff}.spectator-control small{display:block;margin-top:6px;color:#8e887f;font-size:7px;line-height:1.45}
      html[data-spectator-mode=quiet] .live-room-card,html[data-spectator-mode=quiet] .shared-board-card,html[data-spectator-mode=quiet] #relationship-summary-root,html[data-spectator-mode=quiet] #consultation-theater-root,html[data-spectator-mode=quiet] #evidence-root,html[data-spectator-mode=quiet] #source-observation-root,html[data-spectator-mode=quiet] #next-move-root,html[data-spectator-mode=quiet] #consultation-receipt-root,html[data-spectator-mode=quiet] #consultation-history-root{display:none!important}
      html[data-spectator-mode=live] .relationship-map{display:none!important}
      html[data-spectator-mode=arena] .moment-card.is-latest{animation:ccArenaPop .34s ease-out}
      html[data-spectator-mode=arena] .relationship-node.is-active{animation:ccArenaPulse .9s ease-in-out infinite alternate}
      html[data-spectator-mode=arena] .relationship-edge{filter:drop-shadow(0 0 4px rgba(242,191,103,.28))}
      html[data-spectator-mode=arena] .live-room-card{box-shadow:0 0 0 1px rgba(224,164,88,.20),0 22px 70px rgba(44,35,28,.13)}
      @keyframes ccArenaPop{from{transform:translateY(7px) scale(.982);opacity:.35}to{transform:none;opacity:1}}
      @keyframes ccArenaPulse{from{filter:brightness(1)}to{filter:brightness(1.22)}}
      @media(max-width:760px){.spectator-control{position:sticky;top:6px;margin:6px auto 10px}}
      @media(prefers-reduced-motion:reduce){html[data-spectator-mode=arena] .moment-card.is-latest,html[data-spectator-mode=arena] .relationship-node.is-active{animation:none!important}.relationship-edge,.moment-card,.relationship-node{transition:none!important}}
    `;
    document.head.appendChild(style);

    let mode = window.localStorage.getItem(MODE_KEY);
    if (!MODES.has(mode)) mode = "live";
    const copy = {
      en: { label: "SPECTATOR MODE", quiet: "Quiet", live: "Live", arena: "Arena", quietHint: "Proposal and outcome only. The meeting still runs exactly the same.", liveHint: "Watch public positions and event-backed turning points.", arenaHint: "Full relationship battlefield, stronger motion — same consultation underneath." },
      zh: { label: "观赛模式", quiet: "安静", live: "直播", arena: "竞技场", quietHint: "只看提案与结果。会议本身完全照常运行。", liveHint: "观看公开立场和由真实事件触发的关键转折。", arenaHint: "关系战场与动效全开——底层协商仍然完全相同。" },
    };
    function locale() { return document.documentElement.lang?.toLowerCase().startsWith("zh") ? "zh" : "en"; }
    function render() {
      const strings = copy[locale()];
      document.documentElement.dataset.spectatorMode = mode;
      window.localStorage.setItem(MODE_KEY, mode);
      root.className = "spectator-control";
      root.innerHTML = `<span>${strings.label}</span><div class="spectator-buttons"><button type="button" data-mode="quiet">◌ ${strings.quiet}</button><button type="button" data-mode="live">◉ ${strings.live}</button><button type="button" data-mode="arena">⚡ ${strings.arena}</button></div><small>${mode === "quiet" ? strings.quietHint : mode === "arena" ? strings.arenaHint : strings.liveHint}</small>`;
      for (const button of root.querySelectorAll("button[data-mode]")) {
        if (button.dataset.mode === mode) button.classList.add("is-active");
        button.addEventListener("click", () => {
          const next = button.dataset.mode;
          if (!MODES.has(next)) return;
          mode = next;
          render();
        });
      }
    }
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
