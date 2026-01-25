import { describe, expect, it, vi } from "vitest";

// Must use vi.hoisted for mocks that are used in vi.mock factories
const mockBuildChannelConfigSchema = vi.hoisted(() => vi.fn(() => ({ schema: {} })));

vi.mock("clawdbot/plugin-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("clawdbot/plugin-sdk")>();
  return {
    ...actual,
    buildChannelConfigSchema: mockBuildChannelConfigSchema,
  };
});

import { DEFAULT_ACCOUNT_ID } from "clawdbot/plugin-sdk";
import type { CoreConfig } from "./types.js";

// Mock the runtime
vi.mock("./runtime.js", () => ({
  getFeishuRuntime: vi.fn(() => ({
    config: { loadConfig: () => ({}) },
    channel: {
      text: { chunkMarkdownText: (text: string) => [text] },
    },
  })),
}));

// Mock the send module
vi.mock("./feishu/send.js", () => ({
  sendMessageFeishu: vi.fn().mockResolvedValue({ messageId: "om_test" }),
  sendMediaFeishu: vi.fn().mockResolvedValue({ messageId: "om_media" }),
}));

// Mock the probe module
vi.mock("./feishu/probe.js", () => ({
  probeFeishu: vi.fn().mockResolvedValue({ ok: true, elapsedMs: 100 }),
}));

// Mock the accounts module
vi.mock("./feishu/accounts.js", () => ({
  listFeishuAccountIds: vi.fn(() => [DEFAULT_ACCOUNT_ID]),
  resolveDefaultFeishuAccountId: vi.fn(() => DEFAULT_ACCOUNT_ID),
  resolveFeishuAccount: vi.fn(({ cfg, accountId }: { cfg?: CoreConfig; accountId?: string }) => ({
    accountId: accountId ?? DEFAULT_ACCOUNT_ID,
    enabled: true,
    configured: true,
    appId: "cli_test",
    appSecret: "secret",
    domain: "feishu",
    config: cfg?.channels?.feishu ?? {},
  })),
}));

// Mock the onboarding module
vi.mock("./onboarding.js", () => ({
  feishuOnboardingAdapter: {},
}));

// Mock the outbound module
vi.mock("./outbound.js", () => ({
  feishuOutbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
  },
}));

// Import after mocks are set up
import { feishuPlugin } from "./channel.js";

describe("feishuPlugin", () => {
  describe("meta", () => {
    it("has correct id", () => {
      expect(feishuPlugin.id).toBe("feishu");
    });

    it("has correct meta properties", () => {
      expect(feishuPlugin.meta.id).toBe("feishu");
      expect(feishuPlugin.meta.label).toBe("Feishu");
      expect(feishuPlugin.meta.selectionLabel).toBe("Feishu/Lark (plugin)");
      expect(feishuPlugin.meta.docsPath).toBe("/channels/feishu");
      expect(feishuPlugin.meta.order).toBe(75);
      expect(feishuPlugin.meta.quickstartAllowFrom).toBe(true);
    });
  });

  describe("capabilities", () => {
    it("supports direct and group chat types", () => {
      expect(feishuPlugin.capabilities.chatTypes).toContain("direct");
      expect(feishuPlugin.capabilities.chatTypes).toContain("group");
    });

    it("does not support polls", () => {
      expect(feishuPlugin.capabilities.polls).toBe(false);
    });

    it("supports reactions", () => {
      expect(feishuPlugin.capabilities.reactions).toBe(true);
    });

    it("supports threads", () => {
      expect(feishuPlugin.capabilities.threads).toBe(true);
    });

    it("does not support media upload", () => {
      expect(feishuPlugin.capabilities.media).toBe(false);
    });
  });

  describe("pairing", () => {
    it("has correct idLabel", () => {
      expect(feishuPlugin.pairing?.idLabel).toBe("feishuUserId");
    });

    it("normalizes allow entries by stripping prefixes", () => {
      const normalize = feishuPlugin.pairing?.normalizeAllowEntry;
      expect(normalize?.("feishu:ou_user123")).toBe("ou_user123");
      expect(normalize?.("lark:ou_user456")).toBe("ou_user456");
      expect(normalize?.("FEISHU:ou_user789")).toBe("ou_user789");
      expect(normalize?.("ou_user000")).toBe("ou_user000");
    });
  });

  describe("config", () => {
    it("lists account IDs", () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            appId: "cli_test",
            appSecret: "secret",
          },
        },
      };
      const ids = feishuPlugin.config.listAccountIds(cfg);
      expect(ids).toContain(DEFAULT_ACCOUNT_ID);
    });

    it("resolves account", () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            appId: "cli_test",
            appSecret: "secret",
          },
        },
      };
      const account = feishuPlugin.config.resolveAccount(cfg, DEFAULT_ACCOUNT_ID);
      expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
      expect(account.configured).toBe(true);
    });

    it("gets default account ID", () => {
      const cfg: CoreConfig = {};
      const defaultId = feishuPlugin.config.defaultAccountId(cfg);
      expect(defaultId).toBe(DEFAULT_ACCOUNT_ID);
    });

    it("checks if account is configured", () => {
      const configuredAccount = {
        accountId: DEFAULT_ACCOUNT_ID,
        configured: true,
        enabled: true,
        domain: "feishu" as const,
        config: {},
      };
      const unconfiguredAccount = {
        accountId: DEFAULT_ACCOUNT_ID,
        configured: false,
        enabled: false,
        domain: "feishu" as const,
        config: {},
      };
      expect(feishuPlugin.config.isConfigured(configuredAccount)).toBe(true);
      expect(feishuPlugin.config.isConfigured(unconfiguredAccount)).toBe(false);
    });

    it("describes account correctly", () => {
      const account = {
        accountId: "test-account",
        name: "Test Account",
        enabled: true,
        configured: true,
        domain: "lark" as const,
        config: {},
      };
      const description = feishuPlugin.config.describeAccount(account);
      expect(description.accountId).toBe("test-account");
      expect(description.name).toBe("Test Account");
      expect(description.enabled).toBe(true);
      expect(description.configured).toBe(true);
      expect(description.baseUrl).toBe("lark");
    });

    it("describes feishu domain account", () => {
      const account = {
        accountId: "feishu-account",
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {},
      };
      const description = feishuPlugin.config.describeAccount(account);
      expect(description.baseUrl).toBe("feishu");
    });

    it("resolves allowFrom from config", () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            dm: {
              allowFrom: ["ou_user1", "ou_user2"],
            },
          },
        },
      };
      const allowFrom = feishuPlugin.config.resolveAllowFrom?.({ cfg });
      expect(allowFrom).toEqual(["ou_user1", "ou_user2"]);
    });

    it("returns empty array when no allowFrom configured", () => {
      const cfg: CoreConfig = {};
      const allowFrom = feishuPlugin.config.resolveAllowFrom?.({ cfg });
      expect(allowFrom).toEqual([]);
    });

    it("formats allowFrom entries", () => {
      const allowFrom = ["feishu:OU_User1", "lark:ou_user2", "ou_user3"];
      const formatted = feishuPlugin.config.formatAllowFrom?.({ allowFrom });
      expect(formatted).toEqual(["ou_user1", "ou_user2", "ou_user3"]);
    });
  });

  describe("security", () => {
    it("resolves DM policy from account config", () => {
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {
          dm: {
            policy: "allowlist" as const,
            allowFrom: ["ou_user1"],
          },
        },
      };
      const dmPolicy = feishuPlugin.security?.resolveDmPolicy?.({ account });
      expect(dmPolicy?.policy).toBe("allowlist");
      expect(dmPolicy?.allowFrom).toEqual(["ou_user1"]);
      expect(dmPolicy?.policyPath).toBe("channels.feishu.dm.policy");
      expect(dmPolicy?.allowFromPath).toBe("channels.feishu.dm.allowFrom");
    });

    it("defaults DM policy to pairing", () => {
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {},
      };
      const dmPolicy = feishuPlugin.security?.resolveDmPolicy?.({ account });
      expect(dmPolicy?.policy).toBe("pairing");
    });

    it("normalizes entries in DM policy", () => {
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {},
      };
      const dmPolicy = feishuPlugin.security?.resolveDmPolicy?.({ account });
      const normalized = dmPolicy?.normalizeEntry?.("feishu:OU_User123");
      expect(normalized).toBe("ou_user123");
    });

    it("collects warnings for open group policy", () => {
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {
          groupPolicy: "open" as const,
        },
      };
      const cfg: CoreConfig = {};
      const warnings = feishuPlugin.security?.collectWarnings?.({ account, cfg });
      expect(warnings?.length).toBeGreaterThan(0);
      expect(warnings?.[0]).toContain("groupPolicy");
    });

    it("returns no warnings for allowlist group policy", () => {
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        configured: true,
        domain: "feishu" as const,
        config: {
          groupPolicy: "allowlist" as const,
        },
      };
      const cfg: CoreConfig = {};
      const warnings = feishuPlugin.security?.collectWarnings?.({ account, cfg });
      expect(warnings).toEqual([]);
    });
  });

  describe("messaging", () => {
    it("normalizes feishu: prefixed targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("feishu:oc_chat123")).toBe("oc_chat123");
      expect(normalize?.("lark:ou_user123")).toBe("ou_user123");
    });

    it("normalizes chat: prefixed targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("chat:oc_chat123")).toBe("oc_chat123");
    });

    it("normalizes user: prefixed targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("user:user123")).toBe("user123");
    });

    it("normalizes open: prefixed targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("open:ou_user123")).toBe("ou_user123");
    });

    it("normalizes union: prefixed targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("union:on_union123")).toBe("on_union123");
    });

    it("returns undefined for empty target", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("")).toBeUndefined();
      expect(normalize?.("   ")).toBeUndefined();
    });

    it("trims whitespace from targets", () => {
      const normalize = feishuPlugin.messaging?.normalizeTarget;
      expect(normalize?.("  oc_chat123  ")).toBe("oc_chat123");
    });

    describe("targetResolver", () => {
      it("recognizes chat IDs (oc_ prefix)", () => {
        const looksLikeId = feishuPlugin.messaging?.targetResolver?.looksLikeId;
        expect(looksLikeId?.("oc_chat123")).toBe(true);
        expect(looksLikeId?.("OC_CHAT123")).toBe(true);
      });

      it("recognizes open IDs (ou_ prefix)", () => {
        const looksLikeId = feishuPlugin.messaging?.targetResolver?.looksLikeId;
        expect(looksLikeId?.("ou_user123")).toBe(true);
        expect(looksLikeId?.("OU_USER123")).toBe(true);
      });

      it("recognizes union IDs (on_ prefix)", () => {
        const looksLikeId = feishuPlugin.messaging?.targetResolver?.looksLikeId;
        expect(looksLikeId?.("on_union123")).toBe(true);
        expect(looksLikeId?.("ON_UNION123")).toBe(true);
      });

      it("recognizes prefixed targets", () => {
        const looksLikeId = feishuPlugin.messaging?.targetResolver?.looksLikeId;
        expect(looksLikeId?.("feishu:oc_chat")).toBe(true);
        expect(looksLikeId?.("lark:ou_user")).toBe(true);
        expect(looksLikeId?.("chat:oc_chat")).toBe(true);
        expect(looksLikeId?.("user:user123")).toBe(true);
        expect(looksLikeId?.("open:ou_user")).toBe(true);
        expect(looksLikeId?.("union:on_union")).toBe(true);
      });

      it("rejects non-ID strings", () => {
        const looksLikeId = feishuPlugin.messaging?.targetResolver?.looksLikeId;
        expect(looksLikeId?.("hello")).toBe(false);
        expect(looksLikeId?.("user@example.com")).toBe(false);
        expect(looksLikeId?.("")).toBe(false);
      });

      it("has correct hint", () => {
        expect(feishuPlugin.messaging?.targetResolver?.hint).toBe(
          "<chat_id|open_id|user_id>",
        );
      });
    });
  });

  describe("groups", () => {
    it("resolves require mention based on group config", () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            groups: {
              oc_group123: { allow: true },
            },
          },
        },
      };
      const result = feishuPlugin.groups?.resolveRequireMention?.({
        cfg,
        chatId: "oc_group123",
      });
      expect(result).toBe("optional");
    });

    it("requires mention when group not in allowlist", () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            groups: {},
          },
        },
      };
      const result = feishuPlugin.groups?.resolveRequireMention?.({
        cfg,
        chatId: "oc_unknown",
      });
      expect(result).toBe("required");
    });

    it("returns default tool policy", () => {
      const result = feishuPlugin.groups?.resolveToolPolicy?.({} as never);
      expect(result).toBe("default");
    });
  });

  describe("threading", () => {
    it("resolves reply-to mode as off", () => {
      const result = feishuPlugin.threading?.resolveReplyToMode?.({} as never);
      expect(result).toBe("off");
    });

    it("builds tool context with channel and thread info", () => {
      const context = {
        To: "oc_chat123",
        MessageThreadId: "thread123",
        ReplyToId: "om_reply",
      };
      const result = feishuPlugin.threading?.buildToolContext?.({
        context,
        hasRepliedRef: true,
      });
      expect(result?.currentChannelId).toBe("oc_chat123");
      expect(result?.currentThreadTs).toBe("thread123");
      expect(result?.hasRepliedRef).toBe(true);
    });

    it("uses ReplyToId when MessageThreadId is missing", () => {
      const context = {
        To: "oc_chat123",
        ReplyToId: "om_reply",
      };
      const result = feishuPlugin.threading?.buildToolContext?.({
        context,
        hasRepliedRef: false,
      });
      expect(result?.currentThreadTs).toBe("om_reply");
    });
  });

  describe("directory", () => {
    it("returns null for self", async () => {
      const result = await feishuPlugin.directory?.self?.({} as never);
      expect(result).toBeNull();
    });

    it("lists peers from allowFrom config", async () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            dm: {
              allowFrom: ["feishu:ou_user1", "ou_user2", "*"],
            },
            groupAllowFrom: ["lark:ou_admin"],
          },
        },
      };
      const peers = await feishuPlugin.directory?.listPeers?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
      });
      expect(peers).toContainEqual({ kind: "user", id: "ou_user1" });
      expect(peers).toContainEqual({ kind: "user", id: "ou_user2" });
      expect(peers).toContainEqual({ kind: "user", id: "ou_admin" });
      // Should not include wildcard
      expect(peers?.find((p) => p.id === "*")).toBeUndefined();
    });

    it("lists groups from config", async () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            groups: {
              oc_group1: { allow: true },
              oc_group2: { allow: true },
            },
          },
        },
      };
      const groups = await feishuPlugin.directory?.listGroups?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
      });
      expect(groups).toContainEqual({ kind: "group", id: "oc_group1" });
      expect(groups).toContainEqual({ kind: "group", id: "oc_group2" });
    });

    it("excludes wildcard from groups", async () => {
      const cfg: CoreConfig = {
        channels: {
          feishu: {
            groups: {
              "*": { allow: true },
              oc_group1: { allow: true },
            },
          },
        },
      };
      const groups = await feishuPlugin.directory?.listGroups?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
      });
      expect(groups?.find((g) => g.id === "*")).toBeUndefined();
      expect(groups).toContainEqual({ kind: "group", id: "oc_group1" });
    });
  });

  describe("setup", () => {
    it("resolves account ID", () => {
      const result = feishuPlugin.setup?.resolveAccountId?.({
        accountId: "  my-account  ",
      });
      expect(result).toBeDefined();
    });

    it("validates input requires appId", () => {
      const error = feishuPlugin.setup?.validateInput?.({
        input: { appSecret: "secret" },
      });
      expect(error).toBe("Feishu requires --app-id");
    });

    it("validates input requires appSecret", () => {
      const error = feishuPlugin.setup?.validateInput?.({
        input: { appId: "cli_test" },
      });
      expect(error).toBe("Feishu requires --app-secret");
    });

    it("validates input passes with both credentials", () => {
      const error = feishuPlugin.setup?.validateInput?.({
        input: { appId: "cli_test", appSecret: "secret" },
      });
      expect(error).toBeNull();
    });

    it("validates input passes with useEnv", () => {
      const error = feishuPlugin.setup?.validateInput?.({
        input: { useEnv: true },
      });
      expect(error).toBeNull();
    });
  });

  describe("status", () => {
    it("has correct default runtime", () => {
      expect(feishuPlugin.status?.defaultRuntime).toEqual({
        accountId: DEFAULT_ACCOUNT_ID,
        running: false,
        lastStartAt: null,
        lastStopAt: null,
        lastError: null,
      });
    });

    it("collects status issues from accounts with errors", () => {
      const accounts = [
        { accountId: "acc1", lastError: "Connection failed" },
        { accountId: "acc2", lastError: null },
        { accountId: "acc3", lastError: "Auth error" },
      ];
      const issues = feishuPlugin.status?.collectStatusIssues?.(accounts);
      expect(issues?.length).toBe(2);
      expect(issues?.[0]).toMatchObject({
        channel: "feishu",
        accountId: "acc1",
        kind: "runtime",
      });
    });

    it("ignores empty error strings", () => {
      const accounts = [{ accountId: "acc1", lastError: "   " }];
      const issues = feishuPlugin.status?.collectStatusIssues?.(accounts);
      expect(issues?.length).toBe(0);
    });

    it("builds channel summary from snapshot", () => {
      const snapshot = {
        configured: true,
        baseUrl: "feishu",
        running: true,
        lastStartAt: "2024-01-01T00:00:00Z",
        lastStopAt: null,
        lastError: null,
        probe: { ok: true, elapsedMs: 50 },
        lastProbeAt: "2024-01-01T00:01:00Z",
      };
      const summary = feishuPlugin.status?.buildChannelSummary?.({ snapshot });
      expect(summary?.configured).toBe(true);
      expect(summary?.running).toBe(true);
      expect(summary?.probe).toEqual({ ok: true, elapsedMs: 50 });
    });

    it("builds account snapshot", () => {
      const account = {
        accountId: "test",
        name: "Test",
        enabled: true,
        configured: true,
        domain: "lark" as const,
        config: {},
      };
      const runtime = {
        running: true,
        lastStartAt: "2024-01-01",
        lastStopAt: null,
        lastError: null,
        lastProbeAt: "2024-01-01",
        lastInboundAt: "2024-01-01",
        lastOutboundAt: "2024-01-01",
      };
      const probe = { ok: true, elapsedMs: 100 };
      const snapshot = feishuPlugin.status?.buildAccountSnapshot?.({
        account,
        runtime,
        probe,
      });
      expect(snapshot?.accountId).toBe("test");
      expect(snapshot?.baseUrl).toBe("lark");
      expect(snapshot?.running).toBe(true);
      expect(snapshot?.probe).toEqual(probe);
    });
  });

  describe("reload", () => {
    it("watches feishu config prefix", () => {
      expect(feishuPlugin.reload?.configPrefixes).toContain("channels.feishu");
    });
  });
});
