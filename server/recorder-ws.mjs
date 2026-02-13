import { WebSocketServer } from "ws";

const PORT = Number(process.env.RECORDER_WS_PORT || 3001);

const wss = new WebSocketServer({ port: PORT });

const broadcast = (data, sender) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client !== sender) {
      client.send(data);
    }
  });
};

wss.on("connection", (socket) => {
  // eslint-disable-next-line no-console
  console.log("[Recorder WS] client connected");
  socket.on("message", (message) => {
    const data = message.toString();
    // eslint-disable-next-line no-console
    console.log("[Recorder WS] message", data);
    broadcast(data, socket);
  });

  socket.on("error", () => {
    // Ignore socket errors; clients will reconnect as needed.
  });
  socket.on("close", () => {
    // eslint-disable-next-line no-console
    console.log("[Recorder WS] client disconnected");
  });
});

// eslint-disable-next-line no-console
console.log(`Recorder WebSocket server running on ws://localhost:${PORT}`);
