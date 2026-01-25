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

    // Use a simple API call to verify credentials
    // Get bot info to verify the app is working
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Try to get the bot's own info
      const res = await client.contact.user.get({
        path: { user_id: "me" },
        params: { user_id_type: "open_id" },
      });

      clearTimeout(timeout);

      // Even if we can't get user info, if we got a response the auth is working
      const elapsedMs = Date.now() - startMs;

      if (res.code === 0) {
        return {
          ok: true,
          elapsedMs,
          botInfo: {
            appName: res.data?.user?.name,
            openId: res.data?.user?.open_id,
          },
        };
      }

      // Some error codes are expected (e.g., no permission to get user info)
      // but the auth still worked
      if (res.code === 99991663 || res.code === 99991664) {
        // Permission denied - but auth worked
        return {
          ok: true,
          elapsedMs,
        };
      }

      return {
        ok: false,
        error: `API error: ${res.msg} (code: ${res.code})`,
        elapsedMs,
      };
    } catch (err) {
      clearTimeout(timeout);
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
