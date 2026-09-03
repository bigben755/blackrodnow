import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, X, Loader2 } from "lucide-react";
import { isStandalone, pushSupported, enablePush, getPushSubscription } from "@/lib/push";

const DISMISS_KEY = "bn-notify-banner-dismissed-v1";

// Shown only when the app is installed (standalone) and notifications haven't
// been granted yet — the clear "allow notifications once downloaded" nudge.
export default function PostInstallNotifyBanner() {
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isStandalone() || !pushSupported()) return;
        if (localStorage.getItem(DISMISS_KEY)) return;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") return;
        getPushSubscription()
            .then((sub) => {
                if (!sub) setShow(true);
            })
            .catch(() => setShow(true));
    }, []);

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setShow(false);
    };

    const enable = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await enablePush();
            toast.success("Notifications on — you'll hear about what's on in Blackrod");
            setShow(false);
        } catch (error) {
            const reason = String(error?.message || "");
            if (reason === "denied") toast.error("Notifications are blocked — allow them in your device settings for Blackrod Now");
            else toast.error("Could not turn on notifications — please try again");
        } finally {
            setBusy(false);
        }
    };

    if (!show) return null;

    return (
        <div
            data-testid="post-install-notify-banner"
            className="fixed inset-x-3 bottom-3 z-[70] sm:left-auto sm:right-4 sm:w-[380px] rounded-2xl border border-border bg-background shadow-2xl p-4 animate-in slide-in-from-bottom-4"
        >
            <button
                type="button"
                data-testid="post-install-notify-dismiss"
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute right-2.5 top-2.5 h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-start gap-3 pr-6">
                <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                    <div className="font-display font-bold text-sm">Turn on notifications</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Get alerts about what's new, on and next — and updates from the groups you follow.
                    </p>
                    <button
                        type="button"
                        data-testid="post-install-notify-enable"
                        onClick={enable}
                        disabled={busy}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Allow notifications
                    </button>
                </div>
            </div>
        </div>
    );
}
