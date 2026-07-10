/**
 * Desktop-shell support: open a URL in the user's default browser instead of
 * navigating the app WebView.
 *
 * The desktop app is a Pake (Tauri) shell that exposes `window.__TAURI__`
 * (withGlobalTauri) with the `shell:allow-open` permission. Pake's own click
 * interception keeps any URL matching OAuth-ish patterns (/login, /signin,
 * /auth/, ...) inside the WebView — right for sign-in flows, wrong for
 * "get your API key" console links, which often carry such paths. Callers
 * that must always leave the app invoke the shell explicitly instead of
 * relying on anchor interception.
 */

interface TauriGlobal {
    core?: {
        invoke?: (
            cmd: string,
            args?: Record<string, unknown>,
        ) => Promise<unknown>;
    };
}

function tauriInvoke() {
    if (typeof window === "undefined") return undefined;
    return (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__?.core
        ?.invoke;
}

/**
 * Open the URL in the system browser (desktop shell) or a new tab (plain
 * browser).
 */
export function openExternalUrl(url: string): void {
    const invoke = tauriInvoke();
    if (invoke) {
        void invoke("plugin:shell|open", { path: url }).catch(() => {
            // Pake also routes window.open of external URLs to the system
            // browser, so this fallback stays out of the WebView too.
            window.open(url, "_blank", "noopener,noreferrer");
        });
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
}
