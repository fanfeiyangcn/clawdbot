import { DEFAULT_ACCOUNT_ID } from "clawdbot/plugin-sdk";
import type { CoreConfig, FeishuDomain, ResolvedFeishuAccount } from "../types.js";

export function listFeishuAccountIds(cfg: CoreConfig): string[] {
  const feishuConfig = cfg.channels?.feishu;
  if (!feishuConfig) return [];

  const ids = new Set<string>();

  // Check if base config has credentials
  if (feishuConfig.appId || feishuConfig.appSecret) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  // Add named accounts
  if (feishuConfig.accounts) {
    for (const accountId of Object.keys(feishuConfig.accounts)) {
      ids.add(accountId);
    }
  }

  // If nothing configured but enabled, add default
  if (ids.size === 0 && feishuConfig.enabled !== false) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  return Array.from(ids);
}

export function resolveDefaultFeishuAccountId(cfg: CoreConfig): string {
  const ids = listFeishuAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export function resolveFeishuAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? resolveDefaultFeishuAccountId(cfg);
  const feishuConfig = cfg.channels?.feishu;

  // Get account-specific config or fall back to base config
  const accountConfig =
    resolvedAccountId !== DEFAULT_ACCOUNT_ID
      ? feishuConfig?.accounts?.[resolvedAccountId]
      : undefined;

  const baseConfig = feishuConfig ?? {};

  // Merge account config with base config (account takes precedence)
  const mergedConfig = accountConfig ? { ...baseConfig, ...accountConfig } : baseConfig;

  const appId =
    mergedConfig.appId ?? process.env.FEISHU_APP_ID ?? process.env.LARK_APP_ID;
  const appSecret =
    mergedConfig.appSecret ?? process.env.FEISHU_APP_SECRET ?? process.env.LARK_APP_SECRET;
  const domain: FeishuDomain = mergedConfig.domain ?? "feishu";
  const encryptKey =
    mergedConfig.encryptKey ?? process.env.FEISHU_ENCRYPT_KEY ?? process.env.LARK_ENCRYPT_KEY;
  const verificationToken =
    mergedConfig.verificationToken ??
    process.env.FEISHU_VERIFICATION_TOKEN ??
    process.env.LARK_VERIFICATION_TOKEN;

  const configured = Boolean(appId && appSecret);
  const enabled = mergedConfig.enabled !== false && configured;

  return {
    accountId: resolvedAccountId,
    name: mergedConfig.name,
    enabled,
    configured,
    appId,
    appSecret,
    domain,
    encryptKey,
    verificationToken,
    config: mergedConfig,
  };
}
