import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedFeishuAccount } from "../types.js";

// Mock the Lark SDK with proper class constructors
const mockLarkModule = vi.hoisted(() => {
  const ClientMock = vi.fn();
  const EventDispatcherMock = vi.fn();
  const WSClientMock = vi.fn();

  return {
    Client: ClientMock,
    EventDispatcher: EventDispatcherMock,
    WSClient: WSClientMock,
    Domain: {
      Feishu: "https://open.feishu.cn",
      Lark: "https://open.larksuite.com",
    },
    LoggerLevel: {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    },
  };
});

vi.mock("@larksuiteoapi/node-sdk", () => mockLarkModule);

import * as lark from "@larksuiteoapi/node-sdk";
import {
  getFeishuClient,
  clearFeishuClient,
  createEventDispatcher,
  createWSClient,
} from "./client.js";

describe("getFeishuClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the client cache by clearing all accounts
    clearFeishuClient("test-account");
    clearFeishuClient("default");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a client with Feishu domain by default", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test-account",
      enabled: true,
      configured: true,
      appId: "cli_test123",
      appSecret: "secret123",
      domain: "feishu",
      config: {},
    };

    const client = getFeishuClient(account);

    expect(lark.Client).toHaveBeenCalledWith({
      appId: "cli_test123",
      appSecret: "secret123",
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.warn,
    });
    expect(client).toBeDefined();
  });

  it("creates a client with Lark domain when specified", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "lark-account",
      enabled: true,
      configured: true,
      appId: "cli_lark123",
      appSecret: "larksecret",
      domain: "lark",
      config: {},
    };

    const client = getFeishuClient(account);

    expect(lark.Client).toHaveBeenCalledWith({
      appId: "cli_lark123",
      appSecret: "larksecret",
      domain: lark.Domain.Lark,
      loggerLevel: lark.LoggerLevel.warn,
    });
    expect(client).toBeDefined();
  });

  it("throws an error when appId is missing", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test-account",
      enabled: true,
      configured: false,
      appSecret: "secret123",
      domain: "feishu",
      config: {},
    };

    expect(() => getFeishuClient(account)).toThrow(
      "Feishu appId and appSecret are required",
    );
  });

  it("throws an error when appSecret is missing", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test-account",
      enabled: true,
      configured: false,
      appId: "cli_test123",
      domain: "feishu",
      config: {},
    };

    expect(() => getFeishuClient(account)).toThrow(
      "Feishu appId and appSecret are required",
    );
  });

  it("caches clients by accountId and appId", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "cached-account",
      enabled: true,
      configured: true,
      appId: "cli_cached",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    const client1 = getFeishuClient(account);
    const client2 = getFeishuClient(account);

    expect(client1).toBe(client2);
    // Client constructor should only be called once
    expect(lark.Client).toHaveBeenCalledTimes(1);
  });

  it("creates separate clients for different accounts", () => {
    const account1: ResolvedFeishuAccount = {
      accountId: "account-1",
      enabled: true,
      configured: true,
      appId: "cli_app1",
      appSecret: "secret1",
      domain: "feishu",
      config: {},
    };

    const account2: ResolvedFeishuAccount = {
      accountId: "account-2",
      enabled: true,
      configured: true,
      appId: "cli_app2",
      appSecret: "secret2",
      domain: "lark",
      config: {},
    };

    const client1 = getFeishuClient(account1);
    const client2 = getFeishuClient(account2);

    expect(client1).not.toBe(client2);
    expect(lark.Client).toHaveBeenCalledTimes(2);
  });
});

describe("clearFeishuClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes cached client for the specified accountId", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "clear-test",
      enabled: true,
      configured: true,
      appId: "cli_clear",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    // Create and cache a client
    getFeishuClient(account);
    expect(lark.Client).toHaveBeenCalledTimes(1);

    // Clear the cache
    clearFeishuClient("clear-test");

    // Getting the client again should create a new one
    getFeishuClient(account);
    expect(lark.Client).toHaveBeenCalledTimes(2);
  });
});

describe("createEventDispatcher", () => {
  it("creates an event dispatcher with encryptKey and verificationToken", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test-account",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      encryptKey: "encrypt123",
      verificationToken: "verify456",
      config: {},
    };

    const dispatcher = createEventDispatcher(account);

    expect(lark.EventDispatcher).toHaveBeenCalledWith({
      encryptKey: "encrypt123",
      verificationToken: "verify456",
    });
    expect(dispatcher).toBeDefined();
  });

  it("creates an event dispatcher without optional keys", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test-account",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    const dispatcher = createEventDispatcher(account);

    expect(lark.EventDispatcher).toHaveBeenCalledWith({
      encryptKey: undefined,
      verificationToken: undefined,
    });
    expect(dispatcher).toBeDefined();
  });
});

describe("createWSClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a WebSocket client with Feishu domain", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "ws-test",
      enabled: true,
      configured: true,
      appId: "cli_ws",
      appSecret: "wssecret",
      domain: "feishu",
      config: {},
    };

    const wsClient = createWSClient(account);

    expect(lark.WSClient).toHaveBeenCalledWith({
      appId: "cli_ws",
      appSecret: "wssecret",
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.warn,
    });
    expect(wsClient).toBeDefined();
  });

  it("creates a WebSocket client with Lark domain", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "ws-lark",
      enabled: true,
      configured: true,
      appId: "cli_wslark",
      appSecret: "larksecret",
      domain: "lark",
      config: {},
    };

    const wsClient = createWSClient(account);

    expect(lark.WSClient).toHaveBeenCalledWith({
      appId: "cli_wslark",
      appSecret: "larksecret",
      domain: lark.Domain.Lark,
      loggerLevel: lark.LoggerLevel.warn,
    });
    expect(wsClient).toBeDefined();
  });

  it("throws an error when credentials are missing", () => {
    const account: ResolvedFeishuAccount = {
      accountId: "ws-invalid",
      enabled: true,
      configured: false,
      domain: "feishu",
      config: {},
    };

    expect(() => createWSClient(account)).toThrow(
      "Feishu appId and appSecret are required",
    );
  });
});
