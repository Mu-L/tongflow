import "server-only";

/**
 * Plugin-env seam: the default backend (src/ext-default/plugin-env.ts)
 * reads `tongflow.plugin.json` from every installed plugin; a cloud shell
 * substitutes a build-time baked declaration list via
 * src/ext/plugin-env.ts.
 */
import { loadPluginEnvDecls } from "@ext/plugin-env";
import type { PluginMeta } from "@/lib/plugins/plugin-env-manifest-schema";

export { loadPluginEnvDecls, PLUGIN_ENV_MANIFEST_FILE } from "@ext/plugin-env";

/**
 * Plugin-level presentation metadata (name/description/icon) keyed by plugin id,
 * for every installed plugin that declares a `plugin` block in its manifest.
 * Shared by the plugins-registry and official-plugins API routes.
 */
export function loadPluginMetaMap(): Record<string, PluginMeta> {
    const map: Record<string, PluginMeta> = {};
    for (const decl of loadPluginEnvDecls()) {
        if (decl.meta) map[decl.pluginId] = decl.meta;
    }
    return map;
}
