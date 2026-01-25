import { describe, expect, it, vi } from "vitest";

import type { ClawdbotPluginApi, PluginRuntime } from "clawdbot/plugin-sdk";
import plugin from "./index.js";

// Mock the runtime module
vi.mock("./src/runtime.js", () => ({
  setFeishuRuntime: vi.fn(),
}));

// Mock the channel module
vi.mock("./src/channel.js", () => ({
  feishuPlugin: {
    id: "feishu",
    meta: { id: "feishu", label: "Feishu" },
  },
}));

import { setFeishuRuntime } from "./src/runtime.js";
import { feishuPlugin } from "./src/channel.js";

describe("feishu plugin", () => {
  describe("plugin metadata", () => {
    it("has correct id", () => {
      expect(plugin.id).toBe("feishu");
    });

    it("has correct name", () => {
      expect(plugin.name).toBe("Feishu");
    });

    it("has correct description", () => {
      expect(plugin.description).toBe("Feishu/Lark channel plugin");
    });

    it("has a config schema", () => {
      expect(plugin.configSchema).toBeDefined();
    });
  });

  describe("register", () => {
    it("sets the runtime", () => {
      const mockRuntime = {
        config: { loadConfig: vi.fn() },
      } as unknown as PluginRuntime;

      const mockApi = {
        runtime: mockRuntime,
        registerChannel: vi.fn(),
      } as unknown as ClawdbotPluginApi;

      plugin.register(mockApi);

      expect(setFeishuRuntime).toHaveBeenCalledWith(mockRuntime);
    });

    it("registers the channel plugin", () => {
      const mockRuntime = {} as PluginRuntime;
      const mockRegisterChannel = vi.fn();

      const mockApi = {
        runtime: mockRuntime,
        registerChannel: mockRegisterChannel,
      } as unknown as ClawdbotPluginApi;

      plugin.register(mockApi);

      expect(mockRegisterChannel).toHaveBeenCalledWith({ plugin: feishuPlugin });
    });
  });
});
