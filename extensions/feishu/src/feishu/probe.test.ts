import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedFeishuAccount } from "../types.js";

// Mock the Lark SDK
vi.mock("@larksuiteoapi/node-sdk", () => ({
  Client: vi.fn().mockImplementation(() => ({
    bot: {
      v3: {
        botInfo: {
          get: vi.fn(),
        },
      },
    },
  })),
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
}));

// Mock the client module
const mockClient = {
  bot: {
    v3: {
      botInfo: {
        get: vi.fn(),
      },
    },
  },
};

vi.mock("./client.js", () => ({
  getFeishuClient: vi.fn(() => mockClient),
}));

import { probeFeishu, type FeishuProbeResult } from "./probe.js";

describe("probeFeishu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when account is not configured", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: false,
      configured: false,
      domain: "feishu",
      config: {},
    };

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Not configured - missing appId or appSecret");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns success when API call succeeds with user info", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        bot: {
          app_name: "Test Bot",
          open_id: "ou_bot123",
        },
      },
    });

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.botInfo).toEqual({
      appName: "Test Bot",
      openId: "ou_bot123",
    });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error for other API error codes", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 99991400,
      msg: "Invalid app credentials",
      data: null,
    });

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("API error: Invalid app credentials (code: 99991400)");
  });

  it("returns error when API call throws an exception", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockRejectedValue(new Error("Network error"));

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("returns error when API call throws a non-Error", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockRejectedValue("String error");

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("String error");
  });

  it("calls bot info API", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { bot: {} },
    });

    await probeFeishu({ account });

    expect(mockClient.bot.v3.botInfo.get).toHaveBeenCalled();
  });

  it("handles missing bot data in successful response", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {},
    });

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(true);
    expect(result.botInfo).toEqual({
      appName: undefined,
      openId: undefined,
    });
  });

  it("respects custom timeout parameter", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "test",
      enabled: true,
      configured: true,
      appId: "cli_test",
      appSecret: "secret",
      domain: "feishu",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { bot: {} },
    });

    // Just verify it doesn't throw with custom timeout
    const result = await probeFeishu({ account, timeoutMs: 5000 });

    expect(result.ok).toBe(true);
  });

  it("works with Lark domain account", async () => {
    const account: ResolvedFeishuAccount = {
      accountId: "lark-test",
      enabled: true,
      configured: true,
      appId: "cli_lark",
      appSecret: "lark_secret",
      domain: "lark",
      config: {},
    };

    mockClient.bot.v3.botInfo.get.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        bot: {
          app_name: "Lark Bot",
          open_id: "ou_larkbot",
        },
      },
    });

    const result = await probeFeishu({ account });

    expect(result.ok).toBe(true);
    expect(result.botInfo?.appName).toBe("Lark Bot");
  });
});
