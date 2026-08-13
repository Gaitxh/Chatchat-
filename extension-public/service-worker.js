const APP_PATH = "app/app.html";

async function openChatChatApp() {
  const appUrl = chrome.runtime.getURL(APP_PATH);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => typeof tab.url === "string" && tab.url.startsWith(appUrl));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }
  await chrome.tabs.create({ url: appUrl, active: true });
}

chrome.action.onClicked.addListener(() => {
  void openChatChatApp().catch((error) => {
    console.warn("ChatChat could not open the full-page consultation room", error);
  });
});
