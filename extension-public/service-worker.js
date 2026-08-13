const enablePanelOnAction = async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn("ChatChat could not enable action-click side panel behavior", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void enablePanelOnAction();
});

chrome.runtime.onStartup.addListener(() => {
  void enablePanelOnAction();
});

void enablePanelOnAction();
