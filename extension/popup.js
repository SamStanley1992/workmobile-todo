const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const recordButton = document.getElementById("recordButton");

const setStatus = (connected, recording) => {
  statusText.textContent = connected ? "Connected" : "Disconnected";
  statusDot.classList.toggle("connected", connected);
  recordButton.disabled = !connected;
  recordButton.textContent = recording ? "Stop Recording" : "Start Recording";
};

const requestStatus = () => {
  chrome.runtime.sendMessage({ type: "getStatus" }, (response) => {
    if (!response) return;
    setStatus(response.connected, response.recording);
  });
};

recordButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "toggleRecording" }, (response) => {
    if (!response) return;
    setStatus(response.connected, response.recording);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "status") {
    setStatus(message.connected, message.recording);
  }
});

requestStatus();
