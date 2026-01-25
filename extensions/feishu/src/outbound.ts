import type { ChannelOutboundAdapter } from "clawdbot/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { sendMessageFeishu, sendMediaFeishu } from "./feishu/send.js";

export const feishuOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getFeishuRuntime().channel.text.chunkMarkdownText(text, limit),
  textChunkLimit: 4000,

  sendText: async ({ to, text, accountId, replyToId }) => {
    const result = await sendMessageFeishu(to, text, {
      replyToId: replyToId ?? undefined,
      accountId: accountId ?? undefined,
    });
    return {
      channel: "feishu",
      messageId: result.messageId,
      chatId: result.chatId,
    };
  },

  sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
    const result = await sendMediaFeishu(to, text ?? "", mediaUrl ?? "", {
      replyToId: replyToId ?? undefined,
      accountId: accountId ?? undefined,
    });
    return {
      channel: "feishu",
      messageId: result.messageId,
      chatId: result.chatId,
    };
  },
};
