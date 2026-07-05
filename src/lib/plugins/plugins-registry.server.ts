import "server-only";

/**
 * Plugin registry seam: the default backend (src/ext-default/
 * plugin-registry.ts) scans the local plugins dir with a dev watcher; a
 * cloud shell substitutes e.g. a build-time baked manifest via
 * src/ext/plugin-registry.ts.
 */
export {
    getNodePluginIds,
    getPluginConfig,
    invalidatePluginsRegistry,
    loadPluginsRegistry,
} from "@ext/plugin-registry";
