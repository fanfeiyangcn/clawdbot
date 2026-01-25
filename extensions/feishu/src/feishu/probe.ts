import type { ResolvedFeishuAccount } from "../types.js";
import { getFeishuClient } from "./client.js";

export interface FeishuProbeResult {
  ok: boolean;
  error?: string;
  elapsedMs: number;
  botInfo?: {
    appName?: string;
    openId?: string;
  };
}

export async function probeFeishu(params: {
  account: ResolvedFeishuAccount;
  timeoutMs?: number;
}): Promise<FeishuProbeResult> {
  const { account, timeoutMs = 10000 } = params;
  const startMs = Date.now();

  if (!account.configured) {
    return {
      ok: false,
      error: "Not configured - missing appId or appSecret",
      elapsedMs: Date.now() - startMs,
    };
  }

  try {
    const client = getFeishuClient(account);

    // Verify credentials by getting tenant access token
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
    });

    try {
      // Get tenant access token to verify credentials
      const token = await Promise.race([
        client.tokenManager.getTenantAccessToken(),
        timeoutPromise,
      ]);

      const elapsedMs = Date.now() - startMs;

      if (token) {
        return {
          ok: true,
          elapsedMs,
          botInfo: {
            appName: account.appId,
          },
        };
      }

      return {
        ok: false,
        error: "Failed to obtain access token",
        elapsedMs,
      };
    } catch (err) {
      throw err;
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - startMs,
    };
  }
}
