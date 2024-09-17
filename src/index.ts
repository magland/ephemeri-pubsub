import cors from "cors";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { publishHandler, subscribeHandler } from "./requestHandlers";
import { Subscription, SubscriptionManager } from "./SubscriptionManager";
import {
  isPublishRequest,
  isSubscribeRequest,
  SubscribeResponse,
} from "./types";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://neurosift.app",
    ],
  })
);

app.use(express.json());

const subscriptionManager = new SubscriptionManager();

app.post("/publish", (req, res) => {
  const request = req.body;
  if (!isPublishRequest(request)) {
    res.status(400).send("Invalid request");
    return;
  }
  publishHandler(request, subscriptionManager)
    .then((response) => {
      res.json(response);
    })
    .catch((error) => {
      console.error("Failed to handle publish", error);
      res.status(500).send("Failed to handle publish");
    });
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let receivedFirstMessage = false;
  let connectionInitialized = false;

  const subscriptionId = createRandomSubscriptionId();
  const sendWebsocketMessageToClient = (message: any) => {
    if (ws.readyState !== WebSocket.CLOSED) {
      ws.send(JSON.stringify(message));
    }
  };
  const subscription = new Subscription(
    subscriptionId,
    sendWebsocketMessageToClient
  );

  const timeAllowedBeforeFirstMessageMsec = 2000;
  setTimeout(() => {
    if (!receivedFirstMessage) {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close(1008, "No initial message received");
        console.log("Connection closed due to no initial message");
        subscription.close();
      }
    }
  }, timeAllowedBeforeFirstMessageMsec);

  ws.on("message", async (messageBuf) => {
    const msg = JSON.parse(messageBuf.toString());
    if (!receivedFirstMessage) {
      receivedFirstMessage = true;
      if (!isSubscribeRequest(msg)) {
        ws.close(1008, "Invalid initial message");
        console.log("Connection closed due to invalid initial message");
        subscription.close();
        return;
      }
      let response: SubscribeResponse;
      try {
        response = await subscribeHandler(msg);
      } catch (e) {
        console.error("Failed to handle subscribe", e);
        ws.close(1008, "Failed to handle subscribe");
        subscription.close();
        return;
      }

      sendWebsocketMessageToClient(response);
      connectionInitialized = true;
      subscription.setChannels(msg.channels);
      subscriptionManager.addSubscription(subscription);
    } else {
      if (!connectionInitialized) {
        ws.close(1008, "Connection not initialized");
        console.log("Connection closed due to uninitialized connection");
        subscription.close();
        return;
      }
      // Handle subsequent messages
      try {
        await subscription.handleWebsocketMessage(msg);
      } catch (e) {
        console.error("Failed to handle message", e);
        ws.close(1008, "Failed to handle message");
        subscription.close();
        return;
      }
    }
  });

  ws.on("close", () => {
    subscription.close();
    subscriptionManager.removeSubscription(subscription);
  });
});

const createRandomSubscriptionId = (): string => {
  const numChars = 16;
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < numChars; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
