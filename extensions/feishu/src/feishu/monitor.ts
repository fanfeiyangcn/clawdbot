import type { RuntimeEnv } from "clawdbot/plugin-sdk";
import type { CoreConfig } from "../types.js";
import { createEventDispatcher, createWSClient } from "./client.js";
import { resolveFeishuAccount } from "./accounts.js";
import { getFeishuRuntime } from "../runtime.js";

export interface MonitorFeishuOpts {
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string | null;
}

interface FeishuMessageEvent {
  event_id?: string;
  token?: string;
  create_time?: string;
  event_type?: string;
  tenant_key?: string;
  app_id?: string;
  sender: {
    sender_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key?: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    thread_id?: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: { union_id?: string; user_id?: string; open_id?: string };
      name: string;
    }>;
  };
}

export async function monitorFeishuProvider(opts: MonitorFeishuOpts = {}): Promise<void> {
  const core = getFeishuRuntime();
  const cfg = core.config.loadConfig() as CoreConfig;

  if (cfg.channels?.feishu?.enabled === false) return;

  const logger = core.logging.getChildLogger({ module: "feishu-auto-reply" });
  const account = resolveFeishuAccount({ cfg, accountId: opts.accountId });

  if (!account.configured) {
    logger.warn("Feishu not configured - missing appId or appSecret");
    return;
  }

  const runtime: RuntimeEnv = opts.runtime ?? {
    log: (...args) => logger.info(args.join(" ")),
    error: (...args) => logger.error(args.join(" ")),
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };

  // Get config values
  const dmConfig = account.config.dm;
  const dmEnabled = dmConfig?.enabled ?? true;
  const dmPolicy = dmConfig?.policy ?? "pairing";
  const allowFrom = dmConfig?.allowFrom ?? [];
  const groupPolicy = account.config.groupPolicy ?? "allowlist";
  const groupsConfig = account.config.groups ?? {};
  const groupAllowFrom = account.config.groupAllowFrom ?? [];

  // Build mention regexes for group filtering
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(cfg);

  // Create event dispatcher
  const eventDispatcher = createEventDispatcher(account);

  // Register message handler
  eventDispatcher.register({
    "im.message.receive_v1": async (data: FeishuMessageEvent) => {
      try {
        await handleIncomingMessage({
          data,
          account,
          cfg,
          runtime,
          logger,
          dmEnabled,
          dmPolicy,
          allowFrom,
          groupPolicy,
          groupsConfig,
          groupAllowFrom,
          mentionRegexes,
        });
      } catch (err) {
        logger.error({ error: String(err) }, "Error handling Feishu message");
      }
    },
  });

  // Create WebSocket client and start
  const wsClient = createWSClient(account);

  logger.info(`Feishu: starting WebSocket client for ${account.domain}`);

  // Start the WebSocket client
  await wsClient.start({ eventDispatcher });

  logger.info(`Feishu: logged in as app ${account.appId}`);

  // Wait for abort signal
  await new Promise<void>((resolve) => {
    const onAbort = () => {
      logger.info("Feishu: stopping WebSocket client");
      resolve();
    };

    if (opts.abortSignal?.aborted) {
      onAbort();
      return;
    }

    opts.abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

interface HandleMessageParams {
  data: FeishuMessageEvent;
  account: ReturnType<typeof resolveFeishuAccount>;
  logger: ReturnType<typeof getFeishuRuntime>["logging"]["getChildLogger"];
  dmEnabled: boolean;
  dmPolicy: string;
  allowFrom: string[];
  groupPolicy: string;
  groupsConfig: Record<string, { allow?: boolean; users?: string[] }>;
  groupAllowFrom: string[];
  mentionRegexes: RegExp[];
}

async function handleIncomingMessage(params: HandleMessageParams): Promise<void> {
  const {
    data,
    account,
    logger,
    dmEnabled,
    dmPolicy,
    allowFrom,
    groupPolicy,
    groupsConfig,
    groupAllowFrom,
    mentionRegexes,
  } = params;

  const { sender, message } = data;
  const senderId = sender.sender_id?.open_id ?? sender.sender_id?.user_id ?? "";
  const chatId = message.chat_id;
  const messageId = message.message_id;
  const chatType = message.chat_type; // "p2p" for DM, "group" for group chat
  const messageType = message.message_type;

  // Only handle text messages for now
  if (messageType !== "text") {
    logger.debug(`Ignoring non-text message type: ${messageType}`);
    return;
  }

  // Parse message content
  let text = "";
  try {
    const content = JSON.parse(message.content);
    text = content.text ?? "";
  } catch {
    logger.warn("Failed to parse message content");
    return;
  }

  if (!text.trim()) return;

  const isDirectMessage = chatType === "p2p";
  const isGroupMessage = chatType === "group";

  // Check DM policy
  if (isDirectMessage) {
    if (!dmEnabled) {
      logger.debug("DM disabled, ignoring message");
      return;
    }

    if (dmPolicy === "disabled") {
      logger.debug("DM policy is disabled, ignoring message");
      return;
    }

    if (dmPolicy === "allowlist" && !isAllowed(senderId, allowFrom)) {
      logger.debug(`Sender ${senderId} not in allowlist`);
      return;
    }

    // For pairing policy, we'd need to check pairing status
    // For now, treat pairing like allowlist
    if (dmPolicy === "pairing" && !isAllowed(senderId, allowFrom)) {
      logger.debug(`Sender ${senderId} not paired`);
      return;
    }
  }

  // Check group policy
  if (isGroupMessage) {
    if (groupPolicy === "disabled") {
      logger.debug("Group policy is disabled, ignoring message");
      return;
    }

    const groupConfig = groupsConfig[chatId];

    if (groupPolicy === "allowlist") {
      if (!groupConfig?.allow) {
        logger.debug(`Group ${chatId} not in allowlist`);
        return;
      }

      // Check if sender is allowed in this group
      if (groupConfig.users && groupConfig.users.length > 0) {
        if (!isAllowed(senderId, groupConfig.users)) {
          logger.debug(`Sender ${senderId} not allowed in group ${chatId}`);
          return;
        }
      } else if (groupAllowFrom.length > 0 && !isAllowed(senderId, groupAllowFrom)) {
        logger.debug(`Sender ${senderId} not in groupAllowFrom`);
        return;
      }
    }

    // For open policy, check if bot is mentioned (unless mentions are disabled)
    if (groupPolicy === "open") {
      const isMentioned = message.mentions?.some((m) => m.name === "bot") ?? false;
      const textMentioned = mentionRegexes.some((re) => re.test(text));

      if (!isMentioned && !textMentioned) {
        logger.debug("Bot not mentioned in group message, ignoring");
        return;
      }
    }
  }

  // Build context for auto-reply pipeline
  const normalizedChatType = isDirectMessage ? "direct" : "group";

  logger.info(`Feishu message from ${senderId} in ${chatId}: ${text.slice(0, 50)}...`);

  // Call the auto-reply pipeline
  const core = getFeishuRuntime();
  const autoReply = core.channel.autoReply;

  await autoReply.handleIncomingMessage({
    channel: "feishu",
    accountId: account.accountId,
    from: senderId,
    to: chatId,
    body: text,
    chatType: normalizedChatType,
    messageId,
    replyToId: message.parent_id,
    threadId: message.thread_id,
    mentionedJids: message.mentions?.map((m) => m.id.open_id ?? m.id.user_id ?? "") ?? [],
  });
}

function isAllowed(id: string, allowList: string[]): boolean {
  if (allowList.includes("*")) return true;
  return allowList.some((entry) => {
    const normalized = entry.replace(/^(feishu|lark):/i, "").trim();
    return normalized === id || normalized === "*";
  });
}
