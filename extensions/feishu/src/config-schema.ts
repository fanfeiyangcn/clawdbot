import { z } from "zod";

const FeishuDmConfigSchema = z.object({
  enabled: z.boolean().optional(),
  policy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(z.string()).optional(),
});

const FeishuGroupConfigSchema = z.object({
  allow: z.boolean().optional(),
  users: z.array(z.string()).optional(),
});

const FeishuAccountConfigSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  domain: z.enum(["feishu", "lark"]).optional(),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  dm: FeishuDmConfigSchema.optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  groups: z.record(z.string(), FeishuGroupConfigSchema).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
});

export const FeishuConfigSchema = FeishuAccountConfigSchema.extend({
  accounts: z.record(z.string(), FeishuAccountConfigSchema).optional(),
});

export type FeishuConfigSchemaType = z.infer<typeof FeishuConfigSchema>;
