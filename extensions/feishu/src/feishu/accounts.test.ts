import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ACCOUNT_ID } from "clawdbot/plugin-sdk";
import type { CoreConfig } from "../types.js";
import {
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  resolveFeishuAccount,
} from "./accounts.js";

const envKeys = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "LARK_APP_ID",
  "LARK_APP_SECRET",
  "FEISHU_ENCRYPT_KEY",
  "LARK_ENCRYPT_KEY",
  "FEISHU_VERIFICATION_TOKEN",
  "LARK_VERIFICATION_TOKEN",
];

describe("listFeishuAccountIds", () => {
  it("returns empty array when feishu config is missing", () => {
    const cfg: CoreConfig = {};
    expect(listFeishuAccountIds(cfg)).toEqual([]);
  });

  it("returns empty array when channels is missing", () => {
    const cfg: CoreConfig = { channels: {} };
    expect(listFeishuAccountIds(cfg)).toEqual([]);
  });

  it("returns default account when base config has appId", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
        },
      },
    };
    expect(listFeishuAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns default account when base config has only appSecret", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appSecret: "secret",
        },
      },
    };
    expect(listFeishuAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns named accounts from accounts section", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          accounts: {
            work: { appId: "cli_work", appSecret: "work_secret" },
            personal: { appId: "cli_personal", appSecret: "personal_secret" },
          },
        },
      },
    };
    const ids = listFeishuAccountIds(cfg);
    expect(ids).toContain("work");
    expect(ids).toContain("personal");
  });

  it("returns both default and named accounts when both exist", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_default",
          appSecret: "default_secret",
          accounts: {
            secondary: { appId: "cli_secondary", appSecret: "secondary_secret" },
          },
        },
      },
    };
    const ids = listFeishuAccountIds(cfg);
    expect(ids).toContain(DEFAULT_ACCOUNT_ID);
    expect(ids).toContain("secondary");
  });

  it("returns default account when enabled but no credentials", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: true,
        },
      },
    };
    expect(listFeishuAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
  });

  it("returns empty when explicitly disabled with no credentials", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: false,
        },
      },
    };
    expect(listFeishuAccountIds(cfg)).toEqual([]);
  });
});

describe("resolveDefaultFeishuAccountId", () => {
  it("returns default account ID when no accounts configured", () => {
    const cfg: CoreConfig = {};
    expect(resolveDefaultFeishuAccountId(cfg)).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("returns first account ID when accounts exist", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
        },
      },
    };
    expect(resolveDefaultFeishuAccountId(cfg)).toBe(DEFAULT_ACCOUNT_ID);
  });
});

describe("resolveFeishuAccount", () => {
  let prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    prevEnv = {};
    for (const key of envKeys) {
      prevEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = prevEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("resolves account from config", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_config",
          appSecret: "config_secret",
          domain: "feishu",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.appId).toBe("cli_config");
    expect(account.appSecret).toBe("config_secret");
    expect(account.domain).toBe("feishu");
    expect(account.configured).toBe(true);
    expect(account.enabled).toBe(true);
  });

  it("resolves account from environment variables (FEISHU_*)", () => {
    process.env.FEISHU_APP_ID = "cli_env";
    process.env.FEISHU_APP_SECRET = "env_secret";
    process.env.FEISHU_ENCRYPT_KEY = "env_encrypt";
    process.env.FEISHU_VERIFICATION_TOKEN = "env_verify";

    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: true,
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.appId).toBe("cli_env");
    expect(account.appSecret).toBe("env_secret");
    expect(account.encryptKey).toBe("env_encrypt");
    expect(account.verificationToken).toBe("env_verify");
    expect(account.configured).toBe(true);
  });

  it("resolves account from environment variables (LARK_*)", () => {
    process.env.LARK_APP_ID = "cli_lark_env";
    process.env.LARK_APP_SECRET = "lark_env_secret";
    process.env.LARK_ENCRYPT_KEY = "lark_encrypt";
    process.env.LARK_VERIFICATION_TOKEN = "lark_verify";

    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: true,
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.appId).toBe("cli_lark_env");
    expect(account.appSecret).toBe("lark_env_secret");
    expect(account.encryptKey).toBe("lark_encrypt");
    expect(account.verificationToken).toBe("lark_verify");
    expect(account.configured).toBe(true);
  });

  it("prefers FEISHU_* env vars over LARK_*", () => {
    process.env.FEISHU_APP_ID = "cli_feishu";
    process.env.LARK_APP_ID = "cli_lark";
    process.env.FEISHU_APP_SECRET = "feishu_secret";
    process.env.LARK_APP_SECRET = "lark_secret";

    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: true,
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.appId).toBe("cli_feishu");
    expect(account.appSecret).toBe("feishu_secret");
  });

  it("prefers config over environment variables", () => {
    process.env.FEISHU_APP_ID = "cli_env";
    process.env.FEISHU_APP_SECRET = "env_secret";

    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_config",
          appSecret: "config_secret",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.appId).toBe("cli_config");
    expect(account.appSecret).toBe("config_secret");
  });

  it("resolves named account from accounts section", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_default",
          appSecret: "default_secret",
          accounts: {
            work: {
              appId: "cli_work",
              appSecret: "work_secret",
              domain: "lark",
              name: "Work Account",
            },
          },
        },
      },
    };

    const account = resolveFeishuAccount({ cfg, accountId: "work" });

    expect(account.accountId).toBe("work");
    expect(account.appId).toBe("cli_work");
    expect(account.appSecret).toBe("work_secret");
    expect(account.domain).toBe("lark");
    expect(account.name).toBe("Work Account");
    expect(account.configured).toBe(true);
  });

  it("merges named account config with base config", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          domain: "feishu",
          encryptKey: "base_encrypt",
          accounts: {
            partial: {
              appId: "cli_partial",
              appSecret: "partial_secret",
            },
          },
        },
      },
    };

    const account = resolveFeishuAccount({ cfg, accountId: "partial" });

    expect(account.appId).toBe("cli_partial");
    expect(account.appSecret).toBe("partial_secret");
    // Domain should come from base config since not specified in account
    expect(account.domain).toBe("feishu");
  });

  it("marks account as not configured when appId is missing", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appSecret: "secret_only",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.configured).toBe(false);
    expect(account.enabled).toBe(false);
  });

  it("marks account as not configured when appSecret is missing", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_only",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.configured).toBe(false);
    expect(account.enabled).toBe(false);
  });

  it("respects enabled flag when configured", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          enabled: false,
          appId: "cli_disabled",
          appSecret: "disabled_secret",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.configured).toBe(true);
    expect(account.enabled).toBe(false);
  });

  it("defaults domain to feishu when not specified", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.domain).toBe("feishu");
  });

  it("uses lark domain when specified", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
          domain: "lark",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.domain).toBe("lark");
  });

  it("includes dm config in resolved account", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
          dm: {
            enabled: true,
            policy: "allowlist",
            allowFrom: ["ou_user1", "ou_user2"],
          },
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.config.dm).toEqual({
      enabled: true,
      policy: "allowlist",
      allowFrom: ["ou_user1", "ou_user2"],
    });
  });

  it("includes group config in resolved account", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_test",
          appSecret: "secret",
          groupPolicy: "allowlist",
          groups: {
            oc_group1: { allow: true },
            oc_group2: { allow: true, users: ["ou_user1"] },
          },
          groupAllowFrom: ["ou_admin"],
        },
      },
    };

    const account = resolveFeishuAccount({ cfg });

    expect(account.config.groupPolicy).toBe("allowlist");
    expect(account.config.groups).toEqual({
      oc_group1: { allow: true },
      oc_group2: { allow: true, users: ["ou_user1"] },
    });
    expect(account.config.groupAllowFrom).toEqual(["ou_admin"]);
  });

  it("falls back to default account when accountId is null", () => {
    const cfg: CoreConfig = {
      channels: {
        feishu: {
          appId: "cli_default",
          appSecret: "default_secret",
        },
      },
    };

    const account = resolveFeishuAccount({ cfg, accountId: null });

    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.appId).toBe("cli_default");
  });
});
