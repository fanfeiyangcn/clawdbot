import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginRuntime } from "clawdbot/plugin-sdk";
import { setFeishuRuntime } from "../runtime.js";

// Mock the Lark SDK
vi.mock("@larksuiteoapi/node-sdk", () => ({
  Client: vi.fn().mockImplementation(() => ({
    im: {
      message: {
        create: vi.fn(),
        reply: vi.fn(),
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
  im: {
    message: {
      create: vi.fn(),
      reply: vi.fn(),
    },
  },
};

vi.mock("./client.js", () => ({
  getFeishuClient: vi.fn(() => mockClient),
}));

// Mock the accounts module
vi.mock("./accounts.js", () => ({
  resolveFeishuAccount: vi.fn(() => ({
    accountId: "default",
    enabled: true,
    configured: true,
    appId: "cli_test",
    appSecret: "secret",
    domain: "feishu",
    config: {},
  })),
}));

const runtimeStub = {
  config: {
    loadConfig: () => ({
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
        },
      },
    }),
  },
} as unknown as PluginRuntime;

let sendMessageFeishu: typeof import("./send.js").sendMessageFeishu;
let sendMediaFeishu: typeof import("./send.js").sendMediaFeishu;

describe("sendMessageFeishu", () => {
  beforeAll(async () => {
    setFeishuRuntime(runtimeStub);
    ({ sendMessageFeishu, sendMediaFeishu } = await import("./send.js"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setFeishuRuntime(runtimeStub);
  });

  it("sends a text message to a chat_id", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_msg123",
        chat_id: "oc_chat123",
      },
    });

    const result = await sendMessageFeishu("oc_chat123", "Hello, Feishu!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: "oc_chat123",
        content: JSON.stringify({ text: "Hello, Feishu!" }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_msg123");
    expect(result.chatId).toBe("oc_chat123");
  });

  it("sends a text message to an open_id", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_msg456",
        chat_id: "oc_dm123",
      },
    });

    const result = await sendMessageFeishu("ou_user123", "Hello, user!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "open_id" },
      data: {
        receive_id: "ou_user123",
        content: JSON.stringify({ text: "Hello, user!" }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_msg456");
  });

  it("sends a text message to a union_id", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_msg789",
      },
    });

    const result = await sendMessageFeishu("on_union123", "Hello!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "union_id" },
      data: {
        receive_id: "on_union123",
        content: JSON.stringify({ text: "Hello!" }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_msg789");
  });

  it("handles prefixed targets (chat:)", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { message_id: "om_msg" },
    });

    await sendMessageFeishu("chat:oc_chat123", "Hello!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: "oc_chat123",
        content: JSON.stringify({ text: "Hello!" }),
        msg_type: "text",
      },
    });
  });

  it("handles prefixed targets (open:)", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { message_id: "om_msg" },
    });

    await sendMessageFeishu("open:ou_user123", "Hello!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "open_id" },
      data: {
        receive_id: "ou_user123",
        content: JSON.stringify({ text: "Hello!" }),
        msg_type: "text",
      },
    });
  });

  it("handles prefixed targets (union:)", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { message_id: "om_msg" },
    });

    await sendMessageFeishu("union:on_union123", "Hello!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "union_id" },
      data: {
        receive_id: "on_union123",
        content: JSON.stringify({ text: "Hello!" }),
        msg_type: "text",
      },
    });
  });

  it("handles prefixed targets (user:)", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: { message_id: "om_msg" },
    });

    await sendMessageFeishu("user:user123", "Hello!");

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "user_id" },
      data: {
        receive_id: "user123",
        content: JSON.stringify({ text: "Hello!" }),
        msg_type: "text",
      },
    });
  });

  it("replies to a message when replyToId is provided", async () => {
    mockClient.im.message.reply.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_reply123",
        chat_id: "oc_chat123",
      },
    });

    const result = await sendMessageFeishu("oc_chat123", "Reply text", {
      replyToId: "om_original123",
    });

    expect(mockClient.im.message.reply).toHaveBeenCalledWith({
      path: { message_id: "om_original123" },
      data: {
        content: JSON.stringify({ text: "Reply text" }),
        msg_type: "text",
      },
    });
    expect(mockClient.im.message.create).not.toHaveBeenCalled();
    expect(result.messageId).toBe("om_reply123");
  });

  it("throws an error when API returns non-zero code", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 99991400,
      msg: "Invalid parameter",
      data: null,
    });

    await expect(sendMessageFeishu("oc_chat123", "Hello!")).rejects.toThrow(
      "Feishu API error: Invalid parameter (code: 99991400)",
    );
  });

  it("throws an error when reply API returns non-zero code", async () => {
    mockClient.im.message.reply.mockResolvedValue({
      code: 99991401,
      msg: "Message not found",
      data: null,
    });

    await expect(
      sendMessageFeishu("oc_chat123", "Reply", { replyToId: "om_invalid" }),
    ).rejects.toThrow("Feishu API error: Message not found (code: 99991401)");
  });

  it("returns empty messageId when not provided in response", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {},
    });

    const result = await sendMessageFeishu("oc_chat123", "Hello!");

    expect(result.messageId).toBe("");
    expect(result.chatId).toBeUndefined();
  });
});

describe("sendMediaFeishu", () => {
  beforeAll(async () => {
    setFeishuRuntime(runtimeStub);
    ({ sendMessageFeishu, sendMediaFeishu } = await import("./send.js"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setFeishuRuntime(runtimeStub);
  });

  it("sends media URL with caption as text message", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_media123",
      },
    });

    const result = await sendMediaFeishu(
      "oc_chat123",
      "Check this out",
      "https://example.com/image.png",
    );

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: "oc_chat123",
        content: JSON.stringify({
          text: "Check this out\nhttps://example.com/image.png",
        }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_media123");
  });

  it("sends media URL without caption", async () => {
    mockClient.im.message.create.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_media456",
      },
    });

    const result = await sendMediaFeishu(
      "oc_chat123",
      "",
      "https://example.com/file.pdf",
    );

    expect(mockClient.im.message.create).toHaveBeenCalledWith({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: "oc_chat123",
        content: JSON.stringify({ text: "https://example.com/file.pdf" }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_media456");
  });

  it("supports replyToId option", async () => {
    mockClient.im.message.reply.mockResolvedValue({
      code: 0,
      msg: "success",
      data: {
        message_id: "om_mediareply",
      },
    });

    const result = await sendMediaFeishu(
      "oc_chat123",
      "Here's the file",
      "https://example.com/doc.pdf",
      { replyToId: "om_original" },
    );

    expect(mockClient.im.message.reply).toHaveBeenCalledWith({
      path: { message_id: "om_original" },
      data: {
        content: JSON.stringify({
          text: "Here's the file\nhttps://example.com/doc.pdf",
        }),
        msg_type: "text",
      },
    });
    expect(result.messageId).toBe("om_mediareply");
  });
});
