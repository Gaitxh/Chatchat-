(() => {
  if (location.protocol !== "chrome-extension:") return;
  if (!globalThis.chrome?.runtime?.getURL || !globalThis.chrome?.tabs?.query) return;
  const appUrl = chrome.runtime.getURL("app/app.html");
  Promise.resolve().then(async () => {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find((tab) => typeof tab.url === "string" && tab.url.startsWith(appUrl));
    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      return;
    }
    await chrome.tabs.create({ url: appUrl, active: true });
  }).catch((error) => console.warn("ChatChat could not open the full-page room", error));
})();
