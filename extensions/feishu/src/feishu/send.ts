import type { CoreConfig } from "../types.js";
import { getFeishuClient } from "./client.js";
import { resolveFeishuAccount } from "./accounts.js";
import { getFeishuRuntime } from "../runtime.js";

export interface FeishuSendOptions {
  replyToId?: string;
  accountId?: string;
}

export interface FeishuSendResult {
  messageId: string;
  chatId?: string;
}

/**
 * Send a text message to a Feishu chat or user.
 * @param to - The receive_id (chat_id, open_id, or user_id)
 * @param text - The message text
 * @param options - Additional options
 */
export async function sendMessageFeishu(
  to: string,
  text: string,
  options: FeishuSendOptions = {},
): Promise<FeishuSendResult> {
  const core = getFeishuRuntime();
  const cfg = core.config.loadConfig() as CoreConfig;
  const account = resolveFeishuAccount({ cfg, accountId: options.accountId });
  const client = getFeishuClient(account);

  // Determine receive_id_type based on the format of 'to'
  const receiveIdType = resolveReceiveIdType(to);
  const receiveId = normalizeReceiveId(to);

  // Build message content
  const content = JSON.stringify({ text });

  // If replying to a message, use reply API
  if (options.replyToId) {
    const res = await client.im.message.reply({
      path: { message_id: options.replyToId },
      data: {
        content,
        msg_type: "text",
      },
    });

    if (res.code !== 0) {
      throw new Error(`Feishu API error: ${res.msg} (code: ${res.code})`);
    }

    return {
      messageId: res.data?.message_id ?? "",
      chatId: res.data?.chat_id,
    };
  }

  // Send new message
  const res = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content,
      msg_type: "text",
    },
  });

  if (res.code !== 0) {
    throw new Error(`Feishu API error: ${res.msg} (code: ${res.code})`);
  }

  return {
    messageId: res.data?.message_id ?? "",
    chatId: res.data?.chat_id,
  };
}

/**
 * Send a media message (image, file, etc.) to Feishu.
 */
export async function sendMediaFeishu(
  to: string,
  text: string,
  mediaUrl: string,
  options: FeishuSendOptions = {},
): Promise<FeishuSendResult> {
  // For now, send text with media URL as a link
  // Full media upload support can be added later
  const messageText = text ? `${text}\n${mediaUrl}` : mediaUrl;
  return sendMessageFeishu(to, messageText, options);
}

function resolveReceiveIdType(to: string): "chat_id" | "open_id" | "user_id" | "union_id" {
  const normalized = to.toLowerCase();

  if (normalized.startsWith("oc_") || normalized.startsWith("chat:")) {
    return "chat_id";
  }
  if (normalized.startsWith("ou_") || normalized.startsWith("open:")) {
    return "open_id";
  }
  if (normalized.startsWith("on_") || normalized.startsWith("union:")) {
    return "union_id";
  }
  if (normalized.startsWith("user:")) {
    return "user_id";
  }

  // Default to chat_id for group chats, open_id for users
  if (normalized.startsWith("oc_")) {
    return "chat_id";
  }

  return "open_id";
}

function normalizeReceiveId(to: string): string {
  // Strip prefixes like "chat:", "open:", "user:", "union:"
  return to
    .replace(/^(chat|open|user|union):/i, "")
    .trim();
}
