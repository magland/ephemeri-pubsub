import { useEffect, useReducer, useState } from "react";
import { EphemeriPubsubClient } from "./EphemeriPubsubClient/EphemeriPubsubClient";
import { PubsubMessage } from "./EphemeriPubsubClient/types";

type MessagesState = PubsubMessage[];

type MessagesAction = {
  type: "add";
  message: PubsubMessage;
};

const messagesReducer = (
  state: MessagesState,
  action: MessagesAction,
): MessagesState => {
  switch (action.type) {
    case "add": {
      return [...state, action.message].sort(
        (a, b) => a.timestamp - b.timestamp,
      );
    }
    default:
      return state;
  }
};

function App() {
  const [messages, messagesDispatch] = useReducer(messagesReducer, []);
  const [client, setClient] = useState<EphemeriPubsubClient | null>(null);
  useEffect(() => {
    (async () => {
      const apiKey = prompt("Enter API key") || "";
      const client = new EphemeriPubsubClient(apiKey);
      client.onMessage((e: PubsubMessage) => {
        if (e.type === "message") {
          messagesDispatch({ type: "add", message: e });
        }
      });
      client.subscribeToChannels(["channel1a"]);
      setClient(client);
      await sleep(1000);
      client.publish(
        "channel1a",
        "Hello channel1a from client1 --- " + Math.random(),
      );
    })();
  }, []);
  return (
    <div>
      <h1>Hpubsub test</h1>
      <div>
        <h3>Send message</h3>
        <input type="text" placeholder="Message" id="message" name="message" />
        <button
          onClick={() => {
            if (client) {
              const message = (
                document.getElementById("message") as HTMLInputElement
              ).value;
              client.publish("channel1a", message);
            }
          }}
        >
          Send message
        </button>
      </div>
      <div>
        <h3>Messages</h3>
        {messages.map((m, i) => {
          const msg = JSON.parse(m.messageJson);
          return (
            <div key={i}>
              <hr />
              <p>Message: {msg}</p>
              <hr />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export default App;
