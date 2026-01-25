import {
  addWildcardAllowFrom,
  formatDocsLink,
  promptChannelAccessConfig,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type WizardPrompter,
} from "clawdbot/plugin-sdk";
import { resolveFeishuAccount } from "./feishu/accounts.js";
import type { CoreConfig, FeishuDmPolicy } from "./types.js";

const channel = "feishu" as const;

function setFeishuDmPolicy(cfg: CoreConfig, policy: FeishuDmPolicy): CoreConfig {
  const allowFrom =
    policy === "open" ? addWildcardAllowFrom(cfg.channels?.feishu?.dm?.allowFrom) : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      feishu: {
        ...cfg.channels?.feishu,
        dm: {
          ...cfg.channels?.feishu?.dm,
          policy,
          ...(allowFrom ? { allowFrom } : {}),
        },
      },
    },
  };
}

async function noteFeishuAuthHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "Feishu/Lark requires an App ID and App Secret from the developer console.",
      "",
      "1. Go to https://open.feishu.cn (Feishu) or https://open.larksuite.com (Lark)",
      "2. Create an app or use an existing one",
      "3. Enable 'Bot' capability in the app",
      "4. Get App ID and App Secret from 'Credentials & Basic Info'",
      "5. Subscribe to 'im.message.receive_v1' event",
      "6. Enable 'Long Connection' mode in Events settings",
      "",
      "Env vars supported: FEISHU_APP_ID, FEISHU_APP_SECRET",
      `Docs: ${formatDocsLink("/channels/feishu", "channels/feishu")}`,
    ].join("\n"),
    "Feishu setup",
  );
}

async function promptFeishuAllowFrom(params: {
  cfg: CoreConfig;
  prompter: WizardPrompter;
}): Promise<CoreConfig> {
  const { cfg, prompter } = params;
  const existingAllowFrom = cfg.channels?.feishu?.dm?.allowFrom ?? [];

  const parseInput = (raw: string) =>
    raw
      .split(/[\n,;]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

  while (true) {
    const entry = await prompter.text({
      message: "Feishu allowFrom (open_id or user_id)",
      placeholder: "ou_xxx or user_id",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
    });

    const parts = parseInput(String(entry));
    if (parts.length === 0) continue;

    const unique = [
      ...new Set([
        ...existingAllowFrom.map((item) => String(item).trim()).filter(Boolean),
        ...parts,
      ]),
    ];

    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: {
          ...cfg.channels?.feishu,
          enabled: true,
          dm: {
            ...cfg.channels?.feishu?.dm,
            policy: "allowlist",
            allowFrom: unique,
          },
        },
      },
    };
  }
}

function setFeishuGroupPolicy(
  cfg: CoreConfig,
  groupPolicy: "open" | "allowlist" | "disabled",
): CoreConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      feishu: {
        ...cfg.channels?.feishu,
        enabled: true,
        groupPolicy,
      },
    },
  };
}

function setFeishuGroupChats(cfg: CoreConfig, chatIds: string[]): CoreConfig {
  const groups = Object.fromEntries(chatIds.map((id) => [id, { allow: true }]));
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      feishu: {
        ...cfg.channels?.feishu,
        enabled: true,
        groups,
      },
    },
  };
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Feishu",
  channel,
  policyKey: "channels.feishu.dm.policy",
  allowFromKey: "channels.feishu.dm.allowFrom",
  getCurrent: (cfg) => (cfg as CoreConfig).channels?.feishu?.dm?.policy ?? "pairing",
  setPolicy: (cfg, policy) => setFeishuDmPolicy(cfg as CoreConfig, policy as FeishuDmPolicy),
  promptAllowFrom: promptFeishuAllowFrom,
};

export const feishuOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const account = resolveFeishuAccount({ cfg: cfg as CoreConfig });
    const configured = account.configured;
    return {
      channel,
      configured,
      statusLines: [
        `Feishu: ${configured ? "configured" : "needs App ID + App Secret"}`,
      ],
      selectionHint: configured ? "configured" : "needs credentials",
    };
  },
  configure: async ({ cfg, prompter, forceAllowFrom }) => {
    let next = cfg as CoreConfig;
    const existing = next.channels?.feishu ?? {};
    const account = resolveFeishuAccount({ cfg: next });

    if (!account.configured) {
      await noteFeishuAuthHelp(prompter);
    }

    const envAppId = process.env.FEISHU_APP_ID ?? process.env.LARK_APP_ID;
    const envAppSecret = process.env.FEISHU_APP_SECRET ?? process.env.LARK_APP_SECRET;
    const envReady = Boolean(envAppId && envAppSecret);

    if (envReady && !existing.appId && !existing.appSecret) {
      const useEnv = await prompter.confirm({
        message: "Feishu env vars detected. Use env values?",
        initialValue: true,
      });
      if (useEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            feishu: {
              ...next.channels?.feishu,
              enabled: true,
            },
          },
        };
        if (forceAllowFrom) {
          next = await promptFeishuAllowFrom({ cfg: next, prompter });
        }
        return { cfg: next };
      }
    }

    // Prompt for domain
    const domain = (await prompter.select({
      message: "Feishu or Lark?",
      options: [
        { value: "feishu", label: "Feishu (飞书 - China)" },
        { value: "lark", label: "Lark (International)" },
      ],
      initialValue: existing.domain ?? "feishu",
    })) as "feishu" | "lark";

    // Prompt for App ID
    const appId = String(
      await prompter.text({
        message: "App ID",
        initialValue: existing.appId ?? envAppId,
        validate: (value) => (value?.trim() ? undefined : "Required"),
      }),
    ).trim();

    // Prompt for App Secret
    const appSecret = String(
      await prompter.text({
        message: "App Secret",
        initialValue: existing.appSecret ?? envAppSecret,
        validate: (value) => (value?.trim() ? undefined : "Required"),
      }),
    ).trim();

    // Optional: Encrypt Key for event verification
    const encryptKey = String(
      await prompter.text({
        message: "Encrypt Key (optional, for event verification)",
        initialValue: existing.encryptKey ?? "",
      }),
    ).trim();

    next = {
      ...next,
      channels: {
        ...next.channels,
        feishu: {
          ...next.channels?.feishu,
          enabled: true,
          domain,
          appId,
          appSecret,
          ...(encryptKey ? { encryptKey } : {}),
        },
      },
    };

    if (forceAllowFrom) {
      next = await promptFeishuAllowFrom({ cfg: next, prompter });
    }

    // Prompt for group access config
    const existingGroups = next.channels?.feishu?.groups;
    const accessConfig = await promptChannelAccessConfig({
      prompter,
      label: "Feishu group chats",
      currentPolicy: next.channels?.feishu?.groupPolicy ?? "allowlist",
      currentEntries: Object.keys(existingGroups ?? {}),
      placeholder: "oc_xxx (chat IDs)",
      updatePrompt: Boolean(existingGroups),
    });

    if (accessConfig) {
      if (accessConfig.policy !== "allowlist") {
        next = setFeishuGroupPolicy(next, accessConfig.policy);
      } else {
        next = setFeishuGroupPolicy(next, "allowlist");
        next = setFeishuGroupChats(next, accessConfig.entries);
      }
    }

    return { cfg: next };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...(cfg as CoreConfig),
    channels: {
      ...(cfg as CoreConfig).channels,
      feishu: { ...(cfg as CoreConfig).channels?.feishu, enabled: false },
    },
  }),
};
