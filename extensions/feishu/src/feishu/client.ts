import * as lark from "@larksuiteoapi/node-sdk";
import type { ResolvedFeishuAccount } from "../types.js";

const clientCache = new Map<string, lark.Client>();

/**
 * Generate a short hash of the secret for cache key invalidation.
 * Uses first 8 chars of base64 encoding.
 */
function hashSecret(secret: string): string {
  return Buffer.from(secret).toString("base64").slice(0, 8);
}

export function getFeishuClient(account: ResolvedFeishuAccount): lark.Client {
  // Include secret hash in cache key to invalidate when credentials change
  const secretHash = account.appSecret ? hashSecret(account.appSecret) : "";
  const cacheKey = `${account.accountId}:${account.appId}:${secretHash}`;

  let client = clientCache.get(cacheKey);
  if (client) return client;

  if (!account.appId || !account.appSecret) {
    throw new Error("Feishu appId and appSecret are required");
  }

  const domain = account.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu;

  client = new lark.Client({
    appId: account.appId,
    appSecret: account.appSecret,
    domain,
    loggerLevel: lark.LoggerLevel.warn,
  });

  clientCache.set(cacheKey, client);
  return client;
}

export function clearFeishuClient(accountId: string): void {
  for (const key of clientCache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      clientCache.delete(key);
    }
  }
}

export function createEventDispatcher(account: ResolvedFeishuAccount): lark.EventDispatcher {
  return new lark.EventDispatcher({
    encryptKey: account.encryptKey,
    verificationToken: account.verificationToken,
  });
}

export function createWSClient(
  account: ResolvedFeishuAccount,
): lark.WSClient {
  if (!account.appId || !account.appSecret) {
    throw new Error("Feishu appId and appSecret are required");
  }

  const domain = account.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu;

  return new lark.WSClient({
    appId: account.appId,
    appSecret: account.appSecret,
    domain,
    loggerLevel: lark.LoggerLevel.warn,
  });
}
