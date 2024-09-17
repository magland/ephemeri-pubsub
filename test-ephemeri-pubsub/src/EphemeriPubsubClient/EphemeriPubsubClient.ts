/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PublishRequest,
  PublishTokenObject,
  PubsubMessage,
  SubscribeRequest,
  SubscribeTokenObject,
  isPublishResponse,
  isPubsubMessage,
  isSubscribeResponse
} from "./types";

// const baseUrl = "http://localhost:8080";
// const websocketUrl = "ws://localhost:8080";

const baseUrl = "https://ephemeri-pubsub-1-b7f355f72152.herokuapp.com/";
const websocketUrl = "wss://ephemeri-pubsub-1-b7f355f72152.herokuapp.com/";

export class EphemeriPubsubClient {
  #onMessageHandlers: ((m: PubsubMessage) => void)[] = [];
  #websocketConnection: WebSocket | undefined = undefined;
  constructor(
    public apiKey: string
  ) {}
  onMessage(callback: (m: PubsubMessage) => void) {
    this.#onMessageHandlers.push(callback);
  }
  async publish(channel: string, message: object | string) {
    const messageJson = JSON.stringify(message);
    const messageSha1 = await sha1(messageJson);
    const publishTokenObject: PublishTokenObject = {
      timestamp: Date.now(),
      channel,
      messageSize: messageJson.length,
      messageSha1,
    };
    const publishToken = JSON.stringify(publishTokenObject);
    const tokenSignature = await sha1(publishToken + this.apiKey);
    const req2: PublishRequest = {
      type: "publishRequest",
      publishToken,
      tokenSignature,
      messageJson,
    };
    const resp2 = await postApiRequest("publish", req2);
    if (!isPublishResponse(resp2)) {
      throw new Error("Invalid response");
    }
  }
  async subscribeToChannels(channels: string[]) {
    if (this.#websocketConnection) {
      this.#websocketConnection.close();
      this.#websocketConnection = undefined;
    }
    const subscribeTokenObject: SubscribeTokenObject = {
      timestamp: Date.now(),
      channels,
    };
    const subscribeToken = JSON.stringify(subscribeTokenObject);
    const tokenSignature = await sha1(subscribeToken + this.apiKey);
    const initialMessage: SubscribeRequest = {
      type: "subscribeRequest",
      channels,
      subscribeToken,
      tokenSignature: tokenSignature,
    };
    const onWebsocketMessage = async (wsMessage: any) => {
      try {
        if (typeof wsMessage !== "object") {
          throw new Error("Invalid message, not an object");
        }
        const type0 = wsMessage.type;
        if (type0 !== "pubsubMessage") {
          throw new Error("Invalid message type");
        }
        const channel0 = wsMessage.channel;
        if (!channel0) {
          throw new Error("No channel");
        }
        if (!channels.includes(channel0)) {
          throw new Error("Invalid channel");
        }
        const message = wsMessage.message;
        if (!isPubsubMessage(message)) {
          throw new Error("Not a pubsub message");
        }
        this.#onMessageHandlers.forEach((h) => h(message));
      } catch (e) {
        console.error("Failed to handle message", e);
        this.#websocketConnection?.close();
      }
    };
    this.#websocketConnection = await openWebsocketConnection(
      initialMessage,
      onWebsocketMessage
    );
  }
}

const openWebsocketConnection = async (
  initialMessage: SubscribeRequest,
  onWebsocketMessage: (message: object) => void
) => {
  const ws = new WebSocket(websocketUrl);
  let gotFirstMessage = false;
  const timeoutDuration = 2000;
  return new Promise<WebSocket>((resolve, reject) => {
    ws.onopen = () => {
      ws.send(JSON.stringify(initialMessage));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!gotFirstMessage) {
        if (!isSubscribeResponse(msg)) {
          reject(new Error("Invalid initial message"));
          ws.close();
          return;
        }
        gotFirstMessage = true;
        resolve(ws);
        return;
      }
      // subsequent messages
      onWebsocketMessage(msg);
    };
    setTimeout(() => {
      if (!gotFirstMessage) {
        reject(new Error("Timeout"));
        ws.close();
      }
    }, timeoutDuration);
  });
};

const postApiRequest = async (endpoint: string, req: any) => {
  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

const sha1 = async (input: string) => {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};
