import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSourceErrorsTopic,
  buildSourceModelPacketsTopic,
  buildSourcePacketEnvelope,
  buildSourcePacketsTopic,
  buildSourceStatusTopic,
  buildSourceTopicRoot,
  decodeMqttJsonPayload,
  MqttJsonClient,
  MqttJsonSession,
} from "../dist/runtime/mqtt.js";

class FakeMqttClient {
  listeners = new Map();
  published = [];
  subscriptions = [];
  ended = false;
  on(event, listener) { const values = this.listeners.get(event) ?? []; values.push(listener); this.listeners.set(event, values); return this; }
  off(event, listener) { this.listeners.set(event, (this.listeners.get(event) ?? []).filter((value) => value !== listener)); return this; }
  emit(event, ...args) { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
  async publishAsync(topic, payload, options) { this.published.push({ topic, payload, options }); }
  async subscribeAsync(topic, options) { this.subscriptions.push({ topic, options }); }
  async endAsync() { this.ended = true; }
}

test("MQTT topic helpers sanitize source and model segments", () => {
  assert.equal(buildSourceTopicRoot(" rtl 433 "), "piphi/sources/rtl_433");
  assert.equal(buildSourcePacketsTopic("rtl/433"), "piphi/sources/rtl_433/packets");
  assert.equal(buildSourceModelPacketsTopic("rtl", "weather station"), "piphi/sources/rtl/models/weather_station/packets");
  assert.equal(buildSourceStatusTopic("rtl"), "piphi/sources/rtl/status");
  assert.equal(buildSourceErrorsTopic("rtl"), "piphi/sources/rtl/errors");
  assert.equal(buildSourceTopicRoot("rtl", "custom/root/"), "custom/root/rtl");
});

test("buildSourcePacketEnvelope creates stable identity hints", () => {
  assert.deepEqual(buildSourcePacketEnvelope({
    source: "rtl433",
    receivedAt: "2026-08-20T00:00:00.000Z",
    packet: { model: "Acurite", device_id: 42, subtype: "outdoor", temperature: 20 },
    metadata: { receiver: "usb-1" },
  }), {
    source: "rtl433",
    received_at: "2026-08-20T00:00:00.000Z",
    model: "Acurite",
    device_hint: { model: "Acurite", id: "42", channel: "outdoor" },
    packet: { model: "Acurite", device_id: 42, subtype: "outdoor", temperature: 20 },
    metadata: { receiver: "usb-1" },
  });
});

test("buildSourcePacketEnvelope handles missing hints and supplies a timestamp", () => {
  const envelope = buildSourcePacketEnvelope({ source: "source", packet: {} });
  assert.equal(envelope.model, null);
  assert.deepEqual(envelope.device_hint, { model: null, id: null, channel: null });
  assert.deepEqual(envelope.metadata, {});
  assert.equal(Number.isNaN(Date.parse(envelope.received_at)), false);
});

test("decodeMqttJsonPayload accepts objects and skips malformed or non-object JSON", () => {
  assert.deepEqual(decodeMqttJsonPayload(new TextEncoder().encode('{"ok":true}')), { ok: true });
  assert.equal(decodeMqttJsonPayload("not-json"), null);
  assert.equal(decodeMqttJsonPayload("[1,2]"), null);
});

test("MqttJsonSession publishes, subscribes, skips malformed messages, and aborts cleanly", async () => {
  const client = new FakeMqttClient();
  const session = new MqttJsonSession(client, 1);
  await session.publishJson("topic/out", { value: 4 }, { retain: true });
  assert.deepEqual(client.published, [{ topic: "topic/out", payload: '{"value":4}', options: { retain: true, qos: 1 } }]);

  const received = [];
  const controller = new AbortController();
  const consuming = session.consumeJson({
    topics: ["topic/in"],
    handler: async (topic, payload) => { received.push({ topic, payload }); },
    signal: controller.signal,
  });
  await Promise.resolve();
  client.emit("message", "topic/in", "bad-json");
  client.emit("message", "topic/in", '{"temperature":21}');
  await Promise.resolve();
  controller.abort();
  await consuming;
  assert.deepEqual(client.subscriptions, [{ topic: "topic/in", options: { qos: 1 } }]);
  assert.deepEqual(received, [{ topic: "topic/in", payload: { temperature: 21 } }]);
  assert.equal((client.listeners.get("message") ?? []).length, 0);
});

test("MqttJsonSession supports qos overrides and resolves when the client closes", async () => {
  const client = new FakeMqttClient();
  const session = new MqttJsonSession(client, 0);
  await session.publishJson("topic", { ok: true }, { qos: 2 });
  assert.deepEqual(client.published[0].options, { retain: false, qos: 2 });
  const consuming = session.consumeJson({ topics: [], handler: async () => {} });
  client.emit("close");
  await consuming;
});

test("MqttJsonSession reports transport and handler failures", async () => {
  const transportClient = new FakeMqttClient();
  const transport = new MqttJsonSession(transportClient, 0).consumeJson({ topics: [], handler: async () => {} });
  transportClient.emit("error", new Error("broker failed"));
  await assert.rejects(transport, /broker failed/);

  const handlerClient = new FakeMqttClient();
  const handling = new MqttJsonSession(handlerClient, 0).consumeJson({
    topics: [],
    handler: async () => { throw "handler failed"; },
  });
  handlerClient.emit("message", "topic", "{}");
  await assert.rejects(handling, /handler failed/);
});

test("MqttJsonSession handles a signal that is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const client = new FakeMqttClient();
  await new MqttJsonSession(client, 0).consumeJson({
    topics: [], handler: async () => {}, signal: controller.signal,
  });
  assert.equal((client.listeners.get("message") ?? []).length, 0);
});

test("MqttJsonClient builds connection options and closes the session", async () => {
  const client = new FakeMqttClient();
  const calls = [];
  const mqtt = new MqttJsonClient({
    hostname: "broker.local", protocol: "mqtts", username: "user", password: "pass", clientId: "runtime", qos: 2,
  }, async (url, options) => { calls.push({ url, options }); return client; });
  const result = await mqtt.withSession(async (session) => {
    await session.publishJson("status", { online: true });
    return "done";
  });
  assert.equal(result, "done");
  assert.equal(calls[0].url, "mqtts://broker.local:8883");
  assert.equal(calls[0].options.clientId, "runtime");
  assert.equal(client.published[0].options.qos, 2);
  assert.equal(client.ended, true);
});

test("MqttJsonClient uses MQTT defaults and closes after callback failure", async () => {
  const client = new FakeMqttClient();
  const calls = [];
  const mqtt = new MqttJsonClient({ hostname: "broker.local" }, async (url, options) => {
    calls.push({ url, options });
    return client;
  });
  await assert.rejects(mqtt.withSession(async () => { throw new Error("callback failed"); }), /callback failed/);
  assert.equal(calls[0].url, "mqtt://broker.local:1883");
  assert.equal(calls[0].options.keepalive, 60);
  assert.equal(client.ended, true);
});

test("MqttJsonClient explains how to install the optional peer", async () => {
  const mqtt = new MqttJsonClient({ hostname: "broker.local" });
  await assert.rejects(mqtt.withSession(async () => undefined), /npm install mqtt/);
});

test("runSubscriptionForever retries connection failures until aborted", async () => {
  const controller = new AbortController();
  let calls = 0;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values);
  try {
    const mqtt = new MqttJsonClient({ hostname: "broker.local" }, async () => {
      calls += 1;
      if (calls === 2) controller.abort();
      throw new Error("offline");
    });
    await mqtt.runSubscriptionForever({
      topics: ["topic"], handler: async () => {}, retryDelayMs: 1, signal: controller.signal,
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls, 2);
  assert.equal(warnings.length, 1);
});
