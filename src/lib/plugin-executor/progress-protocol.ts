/**
 * Backend-neutral plugin progress protocol.
 *
 * A plugin subprocess streams progress by writing sentinel-framed lines to
 * **stderr** (stdout is reserved for the single ABI-JSON result). Each progress
 * line looks like:
 *
 *   @@TF_PROGRESS@@{"message":"Generating frames","percent":42}
 *
 * The generic runner parses these and forwards them to `notifyTask(RUNNING, …)`.
 * Any stderr line that is not a progress line is ordinary log output and is
 * forwarded to the server terminal unchanged.
 *
 * The Python SDK emits these via `tongflow.progress(...)`; the sentinel must
 * stay byte-for-byte identical on both sides.
 */

export const PROGRESS_SENTINEL = "@@TF_PROGRESS@@";

export type PluginProgress = {
    message: string;
    /** Optional 0–100 completion hint. */
    percent?: number;
    /**
     * When true, this message is streamed reasoning ("thinking") destined for
     * the node's live thinking bubble, not the central status label.
     */
    thinking?: boolean;
};

/**
 * Parse a single stderr line. Returns the progress payload if the line is a
 * well-formed progress line, or `null` for ordinary log output.
 */
export function parseProgressLine(line: string): PluginProgress | null {
    const idx = line.indexOf(PROGRESS_SENTINEL);
    if (idx === -1) return null;

    const json = line.slice(idx + PROGRESS_SENTINEL.length).trim();
    if (!json) return null;

    try {
        const parsed = JSON.parse(json) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        const rec = parsed as Record<string, unknown>;
        const message =
            typeof rec.message === "string" ? rec.message : undefined;
        if (!message) return null;
        const out: PluginProgress = { message };
        if (typeof rec.percent === "number" && Number.isFinite(rec.percent)) {
            out.percent = rec.percent;
        }
        if (rec.thinking === true) {
            out.thinking = true;
        }
        return out;
    } catch {
        return null;
    }
}
