// Global capture of the Android/Chrome install prompt so any component can
// offer "install" on demand (the event fires once, early, before React mounts).
let deferredPrompt = null;
const listeners = new Set();

function notify() {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* noop */
        }
    });
}

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        notify();
    });
}

export const canInstall = () => deferredPrompt !== null;

export async function promptInstall() {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") deferredPrompt = null;
    notify();
    return outcome;
}

// Subscribe to install-availability changes. Returns an unsubscribe fn.
export function onInstallAvailabilityChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Open the shared "Get the app" dialog from anywhere.
export const openAppDialog = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bn:open-get-app"));
};
