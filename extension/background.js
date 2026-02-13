const WS_URL = "ws://localhost:3001";
const DEBUG_WS = true;

let socket = null;
let connected = false;
let recording = false;
let reconnectTimer = null;

const notifyStatus = () => {
  chrome.runtime.sendMessage(
    {
      type: "status",
      connected,
      recording,
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore when popup is closed or no listeners are available.
      }
    }
  );
};

const connect = () => {
  if (socket) {
    socket.close();
  }
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    connected = true;
    notifyStatus();
    if (DEBUG_WS) console.log("[Recorder] WS open", WS_URL);
  };

  socket.onclose = () => {
    connected = false;
    recording = false;
    notifyStatus();
    if (DEBUG_WS) console.log("[Recorder] WS closed", WS_URL);
    reconnectTimer = setTimeout(connect, 2000);
  };

  socket.onerror = () => {
    connected = false;
    notifyStatus();
    if (DEBUG_WS) console.warn("[Recorder] WS error", WS_URL);
  };
};

connect();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (DEBUG_WS) console.log("[Recorder] Message", message);

  if (message?.type === "ping") {
    sendResponse({ ok: true, connected, recording });
    return true;
  }

  if (message?.type === "getStatus") {
    sendResponse({ connected, recording });
    return true;
  }

  if (message?.type === "event") {
    if (DEBUG_WS) console.log("[Recorder] Event", message.payload);
    if (!connected || !recording) return false;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message.payload));
      if (DEBUG_WS) console.log("[Recorder] Sent", message.payload);
    }
    return false;
  }

  if (message?.type === "toggleRecording") {
    if (!connected) {
      sendResponse({ connected, recording });
      return true;
    }
    recording = !recording;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "recording",
          active: recording,
          timestamp: Date.now(),
          source: "extension",
        })
      );
    }
    sendResponse({ connected, recording });
    notifyStatus();
    return true;
  }

  return false;
});

chrome.runtime.onSuspend.addListener(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) socket.close();
});
