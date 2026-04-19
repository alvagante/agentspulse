import type { ToolId } from "../types.js";
import type { ToolPlugin } from "./plugin-interface.js";

/**
 * Manages plugin lifecycle: registration, autodiscovery, and lookup.
 */
export class PluginRegistry {
  private plugins: Map<ToolId, ToolPlugin> = new Map();

  /** Register a plugin manually */
  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Autodiscover plugins by checking config dirs and PATH commands.
   * Accepts an array of candidate plugin instances to probe.
   * For each candidate, calls detect() — if detected, registers it.
   */
  async autodiscover(candidates: ToolPlugin[]): Promise<void> {
    for (const plugin of candidates) {
      try {
        const result = await plugin.detect();
        if (result.detected) {
          this.register(plugin);
        }
      } catch {
        // Detection failed — skip this plugin silently
      }
    }
  }

  /** Get all registered (detected) plugins */
  getPlugins(): ToolPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Get a specific plugin by tool ID */
  getPlugin(id: ToolId): ToolPlugin | undefined {
    return this.plugins.get(id);
  }

  /** Get count of detected tools */
  getDetectedCount(): number {
    return this.plugins.size;
  }
}
