---
summary: "Feishu/Lark channel plugin for enterprise messaging in China and internationally"
read_when:
  - Setting up Feishu or Lark integration
  - Working on Feishu channel features
---
# Feishu / Lark

Status: production-ready for DMs and group chats via the official Lark SDK. Uses WebSocket long connection for real-time events.

## Quick setup (beginner)
1) Create a Feishu or Lark app in the developer console.
2) Enable the Bot capability and get your App ID + App Secret.
3) Set credentials for Clawdbot:
   - Env: `FEISHU_APP_ID=...` and `FEISHU_APP_SECRET=...`
   - Or config: `channels.feishu.appId` and `channels.feishu.appSecret`
4) Subscribe to the `im.message.receive_v1` event and enable Long Connection mode.
5) Start the gateway.
6) DM access is pairing by default; approve the pairing code on first contact.

Minimal config:
```json5
{
  channels: {
    feishu: {
      enabled: true,
      domain: "feishu",  // or "lark" for international
      appId: "cli_xxx",
      appSecret: "xxx"
    }
  }
}
```

## Feishu vs Lark

Feishu and Lark are the same product with different regional deployments:

| Aspect | Feishu (飞书) | Lark |
| --- | --- | --- |
| Region | China | International |
| Domain | `open.feishu.cn` | `open.larksuite.com` |
| API endpoint | `https://open.feishu.cn` | `https://open.larksuite.com` |
| Config value | `domain: "feishu"` | `domain: "lark"` |

Set `channels.feishu.domain` to match your app's region. The default is `"feishu"`.

## What it is
- A Feishu/Lark Bot API channel owned by the Gateway.
- Deterministic routing: replies go back to Feishu; the model never chooses channels.
- DMs share the agent's main session; group chats stay isolated.
- Uses the official `@larksuiteoapi/node-sdk` for API calls and WebSocket events.

## Prerequisites

### 1) Create a Feishu/Lark app
1. Go to the developer console:
   - Feishu (China): https://open.feishu.cn/app
   - Lark (International): https://open.larksuite.com/app
2. Click **Create App** (or use an existing app).
3. Note your **App ID** and **App Secret** from **Credentials & Basic Info**.

### 2) Enable Bot capability
1. In your app settings, go to **Add Features** > **Bot**.
2. Enable the Bot capability.
3. Configure the bot name and avatar as desired.

### 3) Configure event subscriptions
1. Go to **Event Subscriptions** in your app settings.
2. Add the `im.message.receive_v1` event (required for receiving messages).
3. Enable **Long Connection** mode (WebSocket) instead of HTTP callback.
   - This allows Clawdbot to receive events without exposing a public webhook URL.

### 4) Request permissions
Your app needs these permissions (scopes):
- `im:message` — Send and receive messages
- `im:message:send_as_bot` — Send messages as the bot
- `im:chat:readonly` — Read chat information (for group chats)
- `contact:user.base:readonly` — Read basic user info (optional, for user lookups)

Request permissions in **Permissions & Scopes** and wait for admin approval if required.

### 5) Publish the app
- For internal use: Publish to your organization.
- For external use: Submit for Feishu/Lark marketplace review.

## Configuration

### Environment variables
```bash
# Required
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx

# Optional (for event verification)
FEISHU_ENCRYPT_KEY=xxx
FEISHU_VERIFICATION_TOKEN=xxx

# Lark variants (used as fallback)
LARK_APP_ID=cli_xxx
LARK_APP_SECRET=xxx
LARK_ENCRYPT_KEY=xxx
LARK_VERIFICATION_TOKEN=xxx
```

### Config file
```json5
{
  channels: {
    feishu: {
      enabled: true,
      domain: "feishu",  // "feishu" or "lark"
      appId: "cli_xxx",
      appSecret: "xxx",
      encryptKey: "xxx",           // optional, for event verification
      verificationToken: "xxx",    // optional, for event verification
      dm: {
        enabled: true,
        policy: "pairing",         // pairing | allowlist | open | disabled
        allowFrom: ["ou_xxx"]      // open_id or user_id entries
      },
      groupPolicy: "allowlist",    // open | allowlist | disabled
      groups: {
        "oc_xxx": { allow: true, users: ["ou_xxx"] }
      },
      groupAllowFrom: ["ou_xxx"]   // global group sender allowlist
    }
  }
}
```

### Multi-account support
Use `channels.feishu.accounts` for multiple Feishu/Lark apps:

```json5
{
  channels: {
    feishu: {
      accounts: {
        "china-app": {
          domain: "feishu",
          appId: "cli_china_xxx",
          appSecret: "xxx"
        },
        "global-app": {
          domain: "lark",
          appId: "cli_global_xxx",
          appSecret: "xxx"
        }
      }
    }
  }
}
```

See [gateway/configuration](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) for the shared multi-account pattern.

## Access control

### DM access
- Default: `channels.feishu.dm.policy = "pairing"`. Unknown senders receive a pairing code; messages are ignored until approved (codes expire after 1 hour).
- Approve via:
  - `clawdbot pairing list feishu`
  - `clawdbot pairing approve feishu <CODE>`
- `channels.feishu.dm.allowFrom` accepts `open_id` (e.g., `ou_xxx`) or `user_id` entries.

DM policy options:
- `pairing` (default): Require pairing code approval for new senders.
- `allowlist`: Only allow senders listed in `dm.allowFrom`.
- `open`: Allow all senders (requires `dm.allowFrom: ["*"]`).
- `disabled`: Ignore all DMs.

### Group access
Two independent controls:

**1. Which groups are allowed** (`channels.feishu.groups`):
- No `groups` config = behavior depends on `groupPolicy`
- With `groups` config = only listed groups are allowed when `groupPolicy="allowlist"`

**2. Which senders are allowed** (`channels.feishu.groupPolicy`):
- `"open"` = all senders in allowed groups can message (mention-gated)
- `"allowlist"` = only senders in `groupAllowFrom` or per-group `users` can message
- `"disabled"` = no group messages accepted

Group config example:
```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groups: {
        "oc_xxx": {
          allow: true,
          users: ["ou_user1", "ou_user2"]  // per-group allowlist
        }
      },
      groupAllowFrom: ["ou_admin"]  // global group sender allowlist
    }
  }
}
```

## Supported features

| Feature | Status |
| --- | --- |
| Text messages | Supported |
| DMs (p2p) | Supported |
| Group chats | Supported |
| Reactions | Supported |
| Threads | Supported |
| Media (images, files) | Partial (sent as links) |
| Mentions | Supported |
| Pairing | Supported |

### Message types
Currently, only text messages are fully processed. Other message types (images, files, etc.) are logged but not handled.

### Media handling
Outbound media is currently sent as URL links rather than native Feishu attachments. Full media upload support may be added in a future release.

## ID formats

Feishu uses several ID types:

| ID Type | Prefix | Example | Usage |
| --- | --- | --- | --- |
| Chat ID | `oc_` | `oc_xxx` | Group chat identifier |
| Open ID | `ou_` | `ou_xxx` | User identifier (app-scoped) |
| Union ID | `on_` | `on_xxx` | User identifier (cross-app) |
| User ID | (none) | `xxx` | Legacy user identifier |

When specifying targets in config or CLI:
- Use `oc_xxx` for group chats
- Use `ou_xxx` for users (recommended)
- Prefixes like `feishu:`, `lark:`, `chat:`, `open:`, `user:`, `union:` are stripped automatically

## Delivery targets (CLI/cron)
Use chat or user IDs as the target:
- `clawdbot message send --channel feishu --target oc_xxx --message "hello"` (group)
- `clawdbot message send --channel feishu --target ou_xxx --message "hello"` (user)

## Sessions and routing
- DMs share the `main` session (like WhatsApp/Telegram).
- Group chats map to isolated sessions: `agent:<agentId>:feishu:group:<chatId>`.
- Replies always route back to the same Feishu chat.

## Limits
- Outbound text is chunked to 4000 characters by default.
- Feishu API rate limits apply (see Feishu documentation for current limits).

## Setup wizard

Run the interactive setup:
```bash
clawdbot configure --channel feishu
```

The wizard will:
1. Prompt for Feishu or Lark domain selection
2. Accept App ID and App Secret (or use env vars if detected)
3. Optionally configure Encrypt Key for event verification
4. Configure DM and group access policies

## Troubleshooting

### Bot not receiving messages
1. Verify the app is published and approved in your organization.
2. Check that `im.message.receive_v1` event is subscribed.
3. Ensure **Long Connection** mode is enabled (not HTTP callback).
4. Verify App ID and App Secret are correct.
5. Check gateway logs: `clawdbot logs --follow`

### Authentication errors
- `Feishu API error: ... (code: 99991663)` — Permission denied. Request the required scopes in your app settings.
- `Feishu API error: ... (code: 99991664)` — Similar permission issue.
- Verify your App Secret hasn't been rotated.

### Bot not responding in groups
1. Check `groupPolicy` setting (default is `allowlist`).
2. Verify the group chat ID is in `channels.feishu.groups`.
3. For `groupPolicy: "open"`, the bot must be @mentioned.
4. Check if the sender is in `groupAllowFrom` or per-group `users` list.

### DMs not working
1. Check `dm.enabled` is not `false`.
2. Check `dm.policy` setting.
3. For `pairing` policy, approve the sender via `clawdbot pairing approve feishu <code>`.
4. For `allowlist` policy, add the sender's `open_id` to `dm.allowFrom`.

### Finding user and chat IDs
- **User Open ID**: Check the sender info in gateway logs when a message arrives.
- **Chat ID**: Check the chat info in gateway logs, or use Feishu's API explorer.
- Run `clawdbot channels status --probe` to verify connectivity.

### WebSocket connection issues
- Ensure your network allows outbound WebSocket connections to Feishu/Lark servers.
- Check for proxy or firewall restrictions.
- The SDK handles reconnection automatically; check logs for connection status.

## Configuration reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Enable/disable the channel |
| `domain` | `"feishu"` \| `"lark"` | `"feishu"` | API domain (China vs International) |
| `appId` | string | — | App ID from developer console |
| `appSecret` | string | — | App Secret from developer console |
| `encryptKey` | string | — | Encrypt Key for event verification |
| `verificationToken` | string | — | Verification Token for events |
| `dm.enabled` | boolean | `true` | Enable DM handling |
| `dm.policy` | string | `"pairing"` | DM access policy |
| `dm.allowFrom` | string[] | `[]` | DM sender allowlist |
| `groupPolicy` | string | `"allowlist"` | Group access policy |
| `groups` | object | `{}` | Per-group configuration |
| `groupAllowFrom` | string[] | `[]` | Global group sender allowlist |
| `accounts` | object | — | Multi-account configuration |

## Security notes
- Treat App Secret like a password; prefer environment variables on production hosts.
- Use `encryptKey` and `verificationToken` for additional event verification security.
- The `pairing` DM policy is recommended to prevent unauthorized access.
- Review group policies carefully; `groupPolicy: "open"` allows any group member to trigger the bot (mention-gated).
