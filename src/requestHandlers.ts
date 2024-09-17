import crypto from "crypto";
import { SubscriptionManager } from "./SubscriptionManager";
import {
  isPublishTokenObject,
  isSubscribeTokenObject,
  PublishRequest,
  PublishResponse,
  PubsubMessage,
  SubscribeRequest,
  SubscribeResponse,
} from "./types";

let API_KEY = process.env.API_KEY;

export const publishHandler = async (
  request: PublishRequest,
  subscriptionManager: SubscriptionManager
): Promise<PublishResponse> => {
  const { publishToken, tokenSignature, messageJson } = request;
  const tokenSignatureToVerify = sha1(publishToken + API_KEY);
  if (tokenSignature !== tokenSignatureToVerify) {
    throw new Error("Invalid token signature");
  }
  const publishTokenObject = JSON.parse(publishToken);
  if (!isPublishTokenObject(publishTokenObject)) {
    throw new Error("Invalid publish token");
  }
  const { timestamp, channel, messageSize, messageSha1 } = publishTokenObject;
  const timestampDifference = Math.abs(Date.now() - timestamp);
  if (timestampDifference > 60 * 1000) {
    throw new Error("Invalid timestamp for publish token");
  }
  if (messageSize !== messageJson.length) {
    throw new Error("Invalid message size");
  }
  const messageSha1ToVerify = sha1(messageJson);
  if (messageSha1 !== messageSha1ToVerify) {
    throw new Error("Invalid message SHA-1");
  }
  const timestamp0 = Date.now();
  const m: PubsubMessage = {
    type: "message",
    channel,
    timestamp: timestamp0,
    messageJson,
  };
  subscriptionManager.publishMessage(channel, m);
  const resp: PublishResponse = { type: "publishResponse" };
  return resp;
};

export const subscribeHandler = async (
  request: SubscribeRequest
): Promise<SubscribeResponse> => {
  const { subscribeToken, tokenSignature, channels } = request;
  const tokenSignatureToVerify = sha1(subscribeToken + API_KEY);
  if (tokenSignature !== tokenSignatureToVerify) {
    throw new Error("Invalid token signature");
  }
  const subscribeTokenObject = JSON.parse(subscribeToken);
  if (!isSubscribeTokenObject(subscribeTokenObject)) {
    throw new Error("Invalid subscribe token");
  }
  const { timestamp, channels: channelsInToken } = subscribeTokenObject;
  if (!stringArraysMatch(channels, channelsInToken)) {
    throw new Error("Channels do not match subscribe token");
  }
  const timestampDifference = Math.abs(Date.now() - timestamp);
  if (timestampDifference > 60 * 1000) {
    throw new Error("Invalid timestamp for subscribe token");
  }
  const resp: SubscribeResponse = { type: "subscribeResponse" };
  return resp;
};

const sha1 = (input: string) => {
  const sha1 = crypto.createHash("sha1");
  sha1.update(input);
  return sha1.digest("hex");
};

const stringArraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
