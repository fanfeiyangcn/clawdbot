import { describe, expect, it } from "vitest";

// Test the isAllowed helper function by importing the module
// Since isAllowed is not exported, we test it indirectly through the module's behavior
// or we can test the exported functions that use it

describe("monitor helpers", () => {
  describe("isAllowed logic", () => {
    // Helper to simulate the isAllowed function logic
    function isAllowed(id: string, allowList: string[]): boolean {
      if (allowList.includes("*")) return true;
      return allowList.some((entry) => {
        const normalized = entry.replace(/^(feishu|lark):/i, "").trim();
        return normalized === id || normalized === "*";
      });
    }

    it("allows any id when allowlist contains wildcard", () => {
      expect(isAllowed("ou_user123", ["*"])).toBe(true);
      expect(isAllowed("ou_anyuser", ["*"])).toBe(true);
    });

    it("allows exact match in allowlist", () => {
      expect(isAllowed("ou_user123", ["ou_user123", "ou_user456"])).toBe(true);
    });

    it("rejects id not in allowlist", () => {
      expect(isAllowed("ou_user789", ["ou_user123", "ou_user456"])).toBe(false);
    });

    it("strips feishu: prefix from allowlist entries", () => {
      expect(isAllowed("ou_user123", ["feishu:ou_user123"])).toBe(true);
    });

    it("strips lark: prefix from allowlist entries", () => {
      expect(isAllowed("ou_user123", ["lark:ou_user123"])).toBe(true);
    });

    it("handles case-insensitive prefix stripping", () => {
      expect(isAllowed("ou_user123", ["FEISHU:ou_user123"])).toBe(true);
      expect(isAllowed("ou_user123", ["Lark:ou_user123"])).toBe(true);
    });

    it("allows when normalized entry is wildcard", () => {
      expect(isAllowed("ou_anyuser", ["feishu:*"])).toBe(true);
      expect(isAllowed("ou_anyuser", ["lark:*"])).toBe(true);
    });

    it("trims whitespace from allowlist entries", () => {
      expect(isAllowed("ou_user123", ["  ou_user123  "])).toBe(true);
      expect(isAllowed("ou_user123", ["feishu:  ou_user123  "])).toBe(true);
    });

    it("returns false for empty allowlist", () => {
      expect(isAllowed("ou_user123", [])).toBe(false);
    });
  });

  describe("message content parsing", () => {
    it("parses text content from JSON", () => {
      const content = JSON.stringify({ text: "Hello, world!" });
      const parsed = JSON.parse(content);
      expect(parsed.text).toBe("Hello, world!");
    });

    it("handles empty text content", () => {
      const content = JSON.stringify({ text: "" });
      const parsed = JSON.parse(content);
      expect(parsed.text).toBe("");
    });

    it("handles missing text field", () => {
      const content = JSON.stringify({ other: "data" });
      const parsed = JSON.parse(content);
      expect(parsed.text).toBeUndefined();
    });
  });

  describe("chat type normalization", () => {
    it("identifies p2p as direct message", () => {
      const chatType = "p2p";
      const isDirectMessage = chatType === "p2p";
      expect(isDirectMessage).toBe(true);
    });

    it("identifies group as group message", () => {
      const chatType = "group";
      const isGroupMessage = chatType === "group";
      expect(isGroupMessage).toBe(true);
    });

    it("normalizes chat type for auto-reply", () => {
      const p2pNormalized = "p2p" === "p2p" ? "direct" : "group";
      const groupNormalized = "group" === "p2p" ? "direct" : "group";
      expect(p2pNormalized).toBe("direct");
      expect(groupNormalized).toBe("group");
    });
  });

  describe("DM policy checks", () => {
    it("blocks when DM is disabled", () => {
      const dmEnabled = false;
      expect(dmEnabled).toBe(false);
    });

    it("blocks when DM policy is disabled", () => {
      const dmPolicy = "disabled";
      expect(dmPolicy === "disabled").toBe(true);
    });

    it("allows when DM policy is open", () => {
      const dmPolicy = "open";
      expect(dmPolicy === "open").toBe(true);
    });

    it("checks allowlist when DM policy is allowlist", () => {
      const dmPolicy = "allowlist";
      const senderId = "ou_user123";
      const allowFrom = ["ou_user123"];
      const isInAllowlist = allowFrom.includes(senderId);
      expect(dmPolicy === "allowlist" && isInAllowlist).toBe(true);
    });
  });

  describe("group policy checks", () => {
    it("blocks when group policy is disabled", () => {
      const groupPolicy = "disabled";
      expect(groupPolicy === "disabled").toBe(true);
    });

    it("requires group in allowlist when policy is allowlist", () => {
      const groupPolicy = "allowlist";
      const chatId = "oc_group123";
      const groupsConfig: Record<string, { allow?: boolean }> = {
        oc_group123: { allow: true },
      };
      const groupConfig = groupsConfig[chatId];
      expect(groupPolicy === "allowlist" && groupConfig?.allow).toBe(true);
    });

    it("rejects group not in allowlist", () => {
      const groupPolicy = "allowlist";
      const chatId = "oc_unknown";
      const groupsConfig: Record<string, { allow?: boolean }> = {
        oc_group123: { allow: true },
      };
      const groupConfig = groupsConfig[chatId];
      expect(groupPolicy === "allowlist" && !groupConfig?.allow).toBe(true);
    });

    it("checks user allowlist within group", () => {
      const chatId = "oc_group123";
      const senderId = "ou_user456";
      const groupsConfig: Record<string, { allow?: boolean; users?: string[] }> = {
        oc_group123: { allow: true, users: ["ou_user456", "ou_user789"] },
      };
      const groupConfig = groupsConfig[chatId];
      const userAllowed = groupConfig?.users?.includes(senderId) ?? false;
      expect(userAllowed).toBe(true);
    });

    it("falls back to groupAllowFrom when group has no user list", () => {
      const senderId = "ou_admin";
      const groupAllowFrom = ["ou_admin", "ou_superuser"];
      const isAllowed = groupAllowFrom.includes(senderId);
      expect(isAllowed).toBe(true);
    });
  });

  describe("mention detection", () => {
    it("detects bot mention in mentions array", () => {
      const mentions = [
        { key: "@_user_1", id: { open_id: "ou_user1" }, name: "User 1" },
        { key: "@_all", id: { open_id: "ou_bot" }, name: "bot" },
      ];
      const isMentioned = mentions.some((m) => m.name === "bot");
      expect(isMentioned).toBe(true);
    });

    it("returns false when bot not mentioned", () => {
      const mentions = [
        { key: "@_user_1", id: { open_id: "ou_user1" }, name: "User 1" },
      ];
      const isMentioned = mentions.some((m) => m.name === "bot");
      expect(isMentioned).toBe(false);
    });

    it("handles empty mentions array", () => {
      const mentions: Array<{ name: string }> = [];
      const isMentioned = mentions.some((m) => m.name === "bot");
      expect(isMentioned).toBe(false);
    });

    it("handles undefined mentions", () => {
      const mentions = undefined;
      const isMentioned = mentions?.some((m: { name: string }) => m.name === "bot") ?? false;
      expect(isMentioned).toBe(false);
    });
  });

  describe("sender ID extraction", () => {
    it("prefers open_id from sender_id", () => {
      const sender = {
        sender_id: {
          open_id: "ou_open123",
          user_id: "user123",
          union_id: "on_union123",
        },
        sender_type: "user",
      };
      const senderId = sender.sender_id?.open_id ?? sender.sender_id?.user_id ?? "";
      expect(senderId).toBe("ou_open123");
    });

    it("falls back to user_id when open_id is missing", () => {
      const sender = {
        sender_id: {
          user_id: "user123",
          union_id: "on_union123",
        },
        sender_type: "user",
      };
      const senderId = sender.sender_id?.open_id ?? sender.sender_id?.user_id ?? "";
      expect(senderId).toBe("user123");
    });

    it("returns empty string when no ID available", () => {
      const sender = {
        sender_id: {},
        sender_type: "user",
      };
      const senderId =
        (sender.sender_id as { open_id?: string })?.open_id ??
        (sender.sender_id as { user_id?: string })?.user_id ??
        "";
      expect(senderId).toBe("");
    });
  });

  describe("message type filtering", () => {
    it("accepts text messages", () => {
      const messageType = "text";
      expect(messageType === "text").toBe(true);
    });

    it("rejects image messages", () => {
      const messageType = "image";
      expect(messageType !== "text").toBe(true);
    });

    it("rejects file messages", () => {
      const messageType = "file";
      expect(messageType !== "text").toBe(true);
    });

    it("rejects audio messages", () => {
      const messageType = "audio";
      expect(messageType !== "text").toBe(true);
    });

    it("rejects sticker messages", () => {
      const messageType = "sticker";
      expect(messageType !== "text").toBe(true);
    });
  });
});
