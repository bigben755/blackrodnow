// Anonymous device identity for follows/personalisation (no accounts needed).
const KEY = "bn-device-id";

export function getDeviceId() {
    if (typeof window === "undefined") return "server";
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = (crypto?.randomUUID?.() || `d-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(KEY, id);
    }
    return id;
}
