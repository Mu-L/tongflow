import { NextResponse } from "next/server";
import {
    listInstalledCommunityPlugins,
    listOfficialPlugins,
} from "@/lib/plugins/official-plugins.server";

export const runtime = "nodejs";

/**
 * GET /api/plugins/official
 * Lists official plugins from config/official-plugins.json with installed
 * state, plus installed community plugins (custom git clones) so the plugin
 * manager can offer uninstall for both.
 */
export async function GET() {
    return NextResponse.json(
        {
            ...listOfficialPlugins(),
            community: listInstalledCommunityPlugins(),
        },
        {
            headers: { "Cache-Control": "no-store" },
        },
    );
}
