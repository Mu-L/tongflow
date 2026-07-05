/**
 * GET /api/uploads/[...path]
 * Serve uploaded files via the storage driver (local disk by default).
 */

import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/lib/file/storage.server";

const MIME_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".json": "application/json",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
};

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    try {
        const { path: pathSegments } = await params;
        const fileKey = pathSegments.join("/");
        const driver = getStorage();

        // Remote drivers can hand out a directly-fetchable URL (e.g. a
        // presigned object-storage URL) so media bytes bypass the app.
        const directUrl = await driver.publicUrl?.(fileKey);
        if (directUrl) {
            return NextResponse.redirect(directUrl, {
                status: 302,
                // Shorter than the signed URL's TTL so cached redirects
                // never point at an expired signature.
                headers: { "Cache-Control": "private, max-age=3300" },
            });
        }

        const buffer = await driver.readFile(fileKey);
        const ext = path.extname(fileKey).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (_error) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
}
