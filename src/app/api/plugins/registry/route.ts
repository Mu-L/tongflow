import { NextResponse } from "next/server";
import { loadPluginMetaMap } from "@/lib/plugins/plugin-env-manifests.server";
import { loadPluginsRegistry } from "@/lib/plugins/plugins-registry.server";

export const runtime = "nodejs";

/**
 * GET /api/plugins/registry
 * Returns the scanned plugin registry (no-store), with presentation metadata
 * (name/description/icon) merged in from each installed plugin's
 * `tongflow.plugin.json`. The scanner stays execution-only; cosmetic metadata
 * is attached here for the node plugin picker.
 */
export async function GET() {
    const registry = loadPluginsRegistry();
    const metaMap = loadPluginMetaMap();

    const plugins: typeof registry.plugins = {};
    for (const [id, config] of Object.entries(registry.plugins)) {
        const meta = metaMap[id];
        plugins[id] = meta
            ? {
                  ...config,
                  ...(meta.name ? { name: meta.name } : {}),
                  ...(meta.description
                      ? { description: meta.description }
                      : {}),
                  ...(meta.icon ? { icon: meta.icon } : {}),
              }
            : config;
    }

    return NextResponse.json(
        { ...registry, plugins },
        { headers: { "Cache-Control": "no-store" } },
    );
}
