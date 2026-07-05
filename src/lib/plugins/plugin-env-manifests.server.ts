import "server-only";

/**
 * Plugin-env seam: the default backend (src/ext-default/plugin-env.ts)
 * reads `tongflow.plugin.json` from every installed plugin; a cloud shell
 * substitutes a build-time baked declaration list via
 * src/ext/plugin-env.ts.
 */
export { loadPluginEnvDecls, PLUGIN_ENV_MANIFEST_FILE } from "@ext/plugin-env";
