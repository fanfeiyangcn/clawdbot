import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  normalizeAccountId,
  PAIRING_APPROVED_MESSAGE,
  setAccountEnabledInConfigSection,
  type ChannelPlugin,
} from "clawdbot/plugin-sdk";

import { FeishuConfigSchema } from "./config-schema.js";
import type { CoreConfig, ResolvedFeishuAccount } from "./types.js";
import {
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount,
} from "./feishu/accounts.js";
import { probeFeishu } from "./feishu/probe.js";
import { sendMessageFeishu } from "./feishu/send.js";
import { feishuOnboardingAdapter } from "./onboarding.js";
import { feishuOutbound } from "./outbound.js";

const meta = {
  id: "feishu",
  label: "Feishu",
  selectionLabel: "Feishu/Lark (plugin)",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "飞书/Lark messaging; configure app credentials.",
  order: 75,
  quickstartAllowFrom: true,
};

function normalizeFeishuMessagingTarget(raw: string): string | undefined {
  let normalized = raw.trim();
  if (!normalized) return undefined;
  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("feishu:") || lowered.startsWith("lark:")) {
    normalized = normalized.slice(normalized.indexOf(":") + 1).trim();
  }
  const stripped = normalized.replace(/^(chat|user|open|union):/i, "").trim();
  return stripped || undefined;
}

function buildFeishuConfigUpdate(
  cfg: CoreConfig,
  input: {
    appId?: string;
    appSecret?: string;
    domain?: "feishu" | "lark";
    encryptKey?: string;
  },
): CoreConfig {
  const existing = cfg.channels?.feishu ?? {};
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      feishu: {
        ...existing,
        enabled: true,
        ...(input.appId ? { appId: input.appId } : {}),
        ...(input.appSecret ? { appSecret: input.appSecret } : {}),
        ...(input.domain ? { domain: input.domain } : {}),
        ...(input.encryptKey ? { encryptKey: input.encryptKey } : {}),
      },
    },
  };
}

export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: "feishu",
  meta,
  onboarding: feishuOnboardingAdapter,
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) =>
      entry.replace(/^(feishu|lark):/i, "").trim(),
    notifyApproval: async ({ id }) => {
      await sendMessageFeishu(id, PAIRING_APPROVED_MESSAGE);
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    polls: false,
    reactions: true,
    threads: true,
    media: false, // Media is sent as URL links, not uploaded directly
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),
  config: {
    listAccountIds: (cfg) => listFeishuAccountIds(cfg as CoreConfig),
    resolveAccount: (cfg, accountId) =>
      resolveFeishuAccount({ cfg: cfg as CoreConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultFeishuAccountId(cfg as CoreConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as CoreConfig,
        sectionKey: "feishu",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as CoreConfig,
        sectionKey: "feishu",
        accountId,
        clearBaseFields: ["name", "appId", "appSecret", "domain", "encryptKey"],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.domain === "lark" ? "lark" : "feishu",
    }),
    resolveAllowFrom: ({ cfg }) =>
      ((cfg as CoreConfig).channels?.feishu?.dm?.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((entry) =>
        entry
          .replace(/^(feishu|lark):/i, "")
          .trim()
          .toLowerCase(),
      ),
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: account.config.dm?.policy ?? "pairing",
      allowFrom: account.config.dm?.allowFrom ?? [],
      policyPath: "channels.feishu.dm.policy",
      allowFromPath: "channels.feishu.dm.allowFrom",
      approveHint: formatPairingApproveHint("feishu"),
      normalizeEntry: (raw) =>
        raw
          .replace(/^(feishu|lark):/i, "")
          .trim()
          .toLowerCase(),
    }),
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = (cfg as CoreConfig).channels?.defaults?.groupPolicy;
      const groupPolicy =
        account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        '- Feishu groups: groupPolicy="open" allows any group to trigger (mention-gated). Set channels.feishu.groupPolicy="allowlist" + channels.feishu.groups to restrict.',
      ];
    },
  },
  groups: {
    resolveRequireMention: ({ cfg, chatId }) => {
      const feishuConfig = (cfg as CoreConfig).channels?.feishu;
      const groupConfig = feishuConfig?.groups?.[chatId];
      // Default to requiring mention in groups
      return groupConfig?.allow ? "optional" : "required";
    },
    resolveToolPolicy: () => "default",
  },
  threading: {
    resolveReplyToMode: () => "off",
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || undefined,
      currentThreadTs: context.MessageThreadId
        ? String(context.MessageThreadId)
        : context.ReplyToId,
      hasRepliedRef,
    }),
  },
  messaging: {
    normalizeTarget: normalizeFeishuMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim().toLowerCase();
        if (!trimmed) return false;
        // Feishu IDs start with oc_ (chat), ou_ (open_id), on_ (union_id)
        if (/^(oc_|ou_|on_)/.test(trimmed)) return true;
        if (/^(feishu|lark|chat|user|open|union):/i.test(raw)) return true;
        return false;
      },
      hint: "<chat_id|open_id|user_id>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId }) => {
      const account = resolveFeishuAccount({ cfg: cfg as CoreConfig, accountId });
      const ids = new Set<string>();

      for (const entry of account.config.dm?.allowFrom ?? []) {
        const raw = String(entry).trim();
        if (!raw || raw === "*") continue;
        ids.add(raw.replace(/^(feishu|lark):/i, ""));
      }

      for (const entry of account.config.groupAllowFrom ?? []) {
        const raw = String(entry).trim();
        if (!raw || raw === "*") continue;
        ids.add(raw.replace(/^(feishu|lark):/i, ""));
      }

      return Array.from(ids)
        .filter(Boolean)
        .map((id) => ({ kind: "user" as const, id }));
    },
    listGroups: async ({ cfg, accountId }) => {
      const account = resolveFeishuAccount({ cfg: cfg as CoreConfig, accountId });
      const groups = account.config.groups ?? {};
      return Object.keys(groups)
        .filter((key) => key && key !== "*")
        .map((id) => ({ kind: "group" as const, id }));
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg: cfg as CoreConfig,
        channelKey: "feishu",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      if (input.useEnv) return null;
      if (!input.appId?.trim()) return "Feishu requires --app-id";
      if (!input.appSecret?.trim()) return "Feishu requires --app-secret";
      return null;
    },
    applyAccountConfig: ({ cfg, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg: cfg as CoreConfig,
        channelKey: "feishu",
        accountId: DEFAULT_ACCOUNT_ID,
        name: input.name,
      });
      if (input.useEnv) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            feishu: {
              ...namedConfig.channels?.feishu,
              enabled: true,
            },
          },
        } as CoreConfig;
      }
      return buildFeishuConfigUpdate(namedConfig as CoreConfig, {
        appId: input.appId?.trim(),
        appSecret: input.appSecret?.trim(),
        domain: input.domain as "feishu" | "lark" | undefined,
        encryptKey: input.encryptKey?.trim(),
      });
    },
  },
  outbound: feishuOutbound,
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((account) => {
        const lastError =
          typeof account.lastError === "string" ? account.lastError.trim() : "";
        if (!lastError) return [];
        return [
          {
            channel: "feishu",
            accountId: account.accountId,
            kind: "runtime",
            message: `Channel error: ${lastError}`,
          },
        ];
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      baseUrl: snapshot.baseUrl ?? null,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      try {
        return await probeFeishu({ account, timeoutMs });
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: 0,
        };
      }
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.domain,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
      lastProbeAt: runtime?.lastProbeAt ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        baseUrl: account.domain,
      });
      ctx.log?.info(
        `[${account.accountId}] starting Feishu provider (${account.domain})`,
      );
      const { monitorFeishuProvider } = await import("./feishu/monitor.js");
      return monitorFeishuProvider({
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: account.accountId,
      });
    },
    stopAccount: async (ctx) => {
      // Clear cached client when account is stopped/reloaded
      const { clearFeishuClient } = await import("./feishu/client.js");
      clearFeishuClient(ctx.account.accountId);
      ctx.log?.info(`[${ctx.account.accountId}] cleared Feishu client cache`);
    },
  },
};
