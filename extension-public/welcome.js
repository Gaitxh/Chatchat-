import { OPEN_MEETING_ROOM } from "./room-launcher.js";

export function setupWelcomePage(page, runtime) {
  const button = page.getElementById("open-meeting-room");
  const status = page.getElementById("launch-status");

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = "Opening your meeting room… / 正在打开会议室…";
    try {
      const response = await runtime.sendMessage({ type: OPEN_MEETING_ROOM });
      if (response?.ok !== true) throw new Error("Room launch failed");
      status.textContent = "Your meeting room is open. / 会议室已打开。";
    } catch {
      status.textContent = "Could not open the room. Try again or use the ChatChat toolbar icon. / 无法打开会议室，请重试或点击 ChatChat 工具栏图标。";
    } finally {
      button.disabled = false;
    }
  });
}

if (typeof document !== "undefined") {
  setupWelcomePage(document, globalThis.chrome?.runtime);
}
