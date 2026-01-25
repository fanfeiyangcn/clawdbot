import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginRuntime } from "clawdbot/plugin-sdk";
import { setFeishuRuntime } from "./runtime.js";
import { feishuOutbound } from "./outbound.js";

// Mock the runtime
const mockChunkMarkdownText = vi.fn((text: string) => (text ? [text] : []));

const runtimeStub = {
  config: { loadConfig: () => ({}) },
  channel: {
    text: {
      chunkMarkdownText: mockChunkMarkdownText,
    },
  },
} as unknown as PluginRuntime;

// Mock the send module
const mockSendMessageFeishu = vi.fn();
const mockSendMediaFeishu = vi.fn();

vi.mock("./feishu/send.js", () => ({
  sendMessageFeishu: (...args: unknown[]) => mockSendMessageFeishu(...args),
  sendMediaFeishu: (...args: unknown[]) => mockSendMediaFeishu(...args),
}));

describe("feishuOutbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFeishuRuntime(runtimeStub);
  });

  describe("properties", () => {
    it("has direct delivery mode", () => {
      expect(feishuOutbound.deliveryMode).toBe("direct");
    });

    it("has text chunk limit of 4000", () => {
      expect(feishuOutbound.textChunkLimit).toBe(4000);
    });
  });

  describe("chunker", () => {
    it("delegates to runtime chunkMarkdownText", () => {
      const text = "Hello, world!";
      feishuOutbound.chunker(text, 4000);

      expect(mockChunkMarkdownText).toHaveBeenCalledWith(text, 4000);
    });

    it("returns chunked text", () => {
      mockChunkMarkdownText.mockReturnValue(["chunk1", "chunk2"]);

      const result = feishuOutbound.chunker("long text", 100);

      expect(result).toEqual(["chunk1", "chunk2"]);
    });
  });

  describe("sendText", () => {
    it("sends text message with correct parameters", async () => {
      mockSendMessageFeishu.mockResolvedValue({
        messageId: "om_msg123",
        chatId: "oc_chat123",
      });

      const result = await feishuOutbound.sendText({
        to: "oc_chat123",
        text: "Hello!",
        accountId: "default",
        replyToId: null,
      });

      expect(mockSendMessageFeishu).toHaveBeenCalledWith("oc_chat123", "Hello!", {
        replyToId: undefined,
        accountId: "default",
      });
      expect(result).toEqual({
        channel: "feishu",
        messageId: "om_msg123",
        chatId: "oc_chat123",
      });
    });

    it("passes replyToId when provided", async () => {
      mockSendMessageFeishu.mockResolvedValue({
        messageId: "om_reply",
        chatId: "oc_chat",
      });

      await feishuOutbound.sendText({
        to: "oc_chat",
        text: "Reply",
        accountId: "default",
        replyToId: "om_original",
      });

      expect(mockSendMessageFeishu).toHaveBeenCalledWith("oc_chat", "Reply", {
        replyToId: "om_original",
        accountId: "default",
      });
    });

    it("handles null accountId", async () => {
      mockSendMessageFeishu.mockResolvedValue({
        messageId: "om_msg",
      });

      await feishuOutbound.sendText({
        to: "oc_chat",
        text: "Hello",
        accountId: null,
        replyToId: null,
      });

      expect(mockSendMessageFeishu).toHaveBeenCalledWith("oc_chat", "Hello", {
        replyToId: undefined,
        accountId: undefined,
      });
    });
  });

  describe("sendMedia", () => {
    it("sends media message with correct parameters", async () => {
      mockSendMediaFeishu.mockResolvedValue({
        messageId: "om_media123",
        chatId: "oc_chat123",
      });

      const result = await feishuOutbound.sendMedia({
        to: "oc_chat123",
        text: "Check this out",
        mediaUrl: "https://example.com/image.png",
        accountId: "default",
        replyToId: null,
      });

      expect(mockSendMediaFeishu).toHaveBeenCalledWith(
        "oc_chat123",
        "Check this out",
        "https://example.com/image.png",
        {
          replyToId: undefined,
          accountId: "default",
        },
      );
      expect(result).toEqual({
        channel: "feishu",
        messageId: "om_media123",
        chatId: "oc_chat123",
      });
    });

    it("handles null text and mediaUrl", async () => {
      mockSendMediaFeishu.mockResolvedValue({
        messageId: "om_media",
      });

      await feishuOutbound.sendMedia({
        to: "oc_chat",
        text: null,
        mediaUrl: null,
        accountId: "default",
        replyToId: null,
      });

      expect(mockSendMediaFeishu).toHaveBeenCalledWith("oc_chat", "", "", {
        replyToId: undefined,
        accountId: "default",
      });
    });

    it("passes replyToId when provided", async () => {
      mockSendMediaFeishu.mockResolvedValue({
        messageId: "om_mediareply",
      });

      await feishuOutbound.sendMedia({
        to: "oc_chat",
        text: "Caption",
        mediaUrl: "https://example.com/file.pdf",
        accountId: "default",
        replyToId: "om_original",
      });

      expect(mockSendMediaFeishu).toHaveBeenCalledWith(
        "oc_chat",
        "Caption",
        "https://example.com/file.pdf",
        {
          replyToId: "om_original",
          accountId: "default",
        },
      );
    });

    it("handles undefined text", async () => {
      mockSendMediaFeishu.mockResolvedValue({
        messageId: "om_media",
      });

      await feishuOutbound.sendMedia({
        to: "oc_chat",
        text: undefined,
        mediaUrl: "https://example.com/image.png",
        accountId: null,
        replyToId: null,
      });

      expect(mockSendMediaFeishu).toHaveBeenCalledWith(
        "oc_chat",
        "",
        "https://example.com/image.png",
        {
          replyToId: undefined,
          accountId: undefined,
        },
      );
    });
  });
});
