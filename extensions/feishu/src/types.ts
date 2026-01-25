export type FeishuDmPolicy = "pairing" | "allowlist" | "open" | "disabled";

export type FeishuDomain = "feishu" | "lark";

export interface FeishuGroupConfig {
  allow?: boolean;
  users?: string[];
}

export interface FeishuDmConfig {
  enabled?: boolean;
  policy?: FeishuDmPolicy;
  allowFrom?: string[];
}

export interface FeishuChannelConfig {
  enabled?: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  domain?: FeishuDomain;
  encryptKey?: string;
  verificationToken?: string;
  dm?: FeishuDmConfig;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groups?: Record<string, FeishuGroupConfig>;
  groupAllowFrom?: string[];
  accounts?: Record<string, FeishuAccountConfig>;
}

export interface FeishuAccountConfig {
  enabled?: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  domain?: FeishuDomain;
  encryptKey?: string;
  verificationToken?: string;
  dm?: FeishuDmConfig;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groups?: Record<string, FeishuGroupConfig>;
  groupAllowFrom?: string[];
}

export interface CoreConfig {
  channels?: {
    feishu?: FeishuChannelConfig;
    defaults?: {
      groupPolicy?: string;
    };
  };
}

export interface ResolvedFeishuAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  appId?: string;
  appSecret?: string;
  domain: FeishuDomain;
  encryptKey?: string;
  verificationToken?: string;
  config: FeishuChannelConfig | FeishuAccountConfig;
}
