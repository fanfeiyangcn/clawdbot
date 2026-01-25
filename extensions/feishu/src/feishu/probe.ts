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

    // Use bot info endpoint to verify credentials
    // This is the correct way to verify bot app credentials
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
    });

    try {
      // Get bot info using the correct endpoint
      const res = await Promise.race([
        client.bot.v3.botInfo.get(),
        timeoutPromise,
      ]);

      const elapsedMs = Date.now() - startMs;

      if (res.code === 0) {
        return {
          ok: true,
          elapsedMs,
          botInfo: {
            appName: res.data?.bot?.app_name,
            openId: res.data?.bot?.open_id,
          },
        };
      }

      return {
        ok: false,
        error: `API error: ${res.msg} (code: ${res.code})`,
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
