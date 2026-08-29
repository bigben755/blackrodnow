// Web push helpers (anonymous, keyed to the device id used for follows).
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

const b64ToUint8 = (base64) => {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const isIos = () =>
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isStandalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

export const pushSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

export async function getPushSubscription() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

export async function enablePush() {
    if (!pushSupported()) throw new Error("unsupported");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("denied");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        const { key } = await api.pushPublicKey();
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: b64ToUint8(key),
        });
    }
    await api.pushSubscribe(getDeviceId(), sub.toJSON());
    return true;
}

export async function disablePush() {
    const sub = await getPushSubscription();
    if (sub) {
        await api.pushUnsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
    }
}
