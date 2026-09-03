import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Smartphone, Share, Bell, BellOff, CheckCircle2, Plus, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { isIos, isStandalone, pushSupported, enablePush, disablePush, getPushSubscription } from "@/lib/push";
import { canInstall, promptInstall, onInstallAvailabilityChange } from "@/lib/pwa";

// Plain trigger button — the dialog itself is rendered once at the Layout root
// (see GetAppDialog) so it is never nested inside the mobile menu overlay.
export default function GetAppButton({ variant = "desktop", onClick }) {
    const standalone = isStandalone();
    const triggerClass =
        variant === "mobile"
            ? "flex w-full items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-foreground/80 hover:bg-muted"
            : "hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition";
    return (
        <button type="button" data-testid={`get-app-trigger-${variant}`} className={triggerClass} onClick={onClick}>
            <Download className="h-4 w-4" />
            {standalone ? "Notifications" : "Get the app"}
        </button>
    );
}

export function GetAppDialog() {
    const [open, setOpen] = useState(false);
    const [installable, setInstallable] = useState(canInstall());
    const [pushOn, setPushOn] = useState(false);
    const [busy, setBusy] = useState(false);

    const standalone = isStandalone();
    const ios = isIos();
    const supportsPush = pushSupported();

    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener("bn:open-get-app", handler);
        return () => window.removeEventListener("bn:open-get-app", handler);
    }, []);

    useEffect(() => onInstallAvailabilityChange(() => setInstallable(canInstall())), []);

    useEffect(() => {
        if (!open) return;
        getPushSubscription().then((s) => setPushOn(!!s)).catch(() => {});
    }, [open]);

    const onOpenChange = setOpen;

    const doInstall = async () => {
        const outcome = await promptInstall();
        if (outcome === "accepted") {
            toast.success("Installing Blackrod Now — check your home screen");
            setOpen(false);
        }
    };

    const toggleNotifications = async () => {
        if (busy) return;
        setBusy(true);
        try {
            if (pushOn) {
                await disablePush();
                setPushOn(false);
                toast.success("Notifications turned off");
            } else {
                await enablePush();
                setPushOn(true);
                toast.success("Notifications on — you'll hear about what's on in Blackrod");
            }
        } catch (error) {
            const reason = String(error?.message || "");
            if (reason === "denied") toast.error("Notifications are blocked — allow them for this site in your browser settings");
            else if (reason === "unsupported" && ios && !standalone) toast.error('Install the app first: tap Share → "Add to Home Screen", then turn on notifications');
            else if (reason === "unsupported") toast.error("This browser doesn't support notifications");
            else toast.error("Could not change notifications — please try again");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" data-testid="get-app-dialog">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-2xl border border-border" />
                        <div>
                            <DialogTitle className="font-display">
                                {standalone ? "You've got the app 🎉" : "Get the Blackrod Now app"}
                            </DialogTitle>
                            <DialogDescription>
                                {standalone
                                    ? "Turn on notifications to hear what's new, on and next."
                                    : "One-tap access from your home screen, plus alerts from the groups you follow."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {!standalone && (
                    <div className="rounded-2xl border border-border p-4">
                        <div className="text-sm font-bold mb-2 inline-flex items-center gap-1.5">
                            <Smartphone className="h-4 w-4 text-primary" /> Install
                        </div>
                        {installable ? (
                            <button
                                type="button"
                                data-testid="get-app-install"
                                onClick={doInstall}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                            >
                                <Download className="h-4 w-4" /> Install app
                            </button>
                        ) : ios ? (
                            <ol className="text-sm text-muted-foreground space-y-1.5 list-none">
                                <li className="flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-muted grid place-items-center text-xs font-bold">1</span>
                                    Tap <Share className="inline h-4 w-4 mx-0.5" /> <strong>Share</strong> in Safari's toolbar
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-muted grid place-items-center text-xs font-bold">2</span>
                                    Choose <Plus className="inline h-4 w-4 mx-0.5" /> <strong>Add to Home Screen</strong>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-muted grid place-items-center text-xs font-bold">3</span>
                                    Open Blackrod Now from your home screen
                                </li>
                            </ol>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Open your browser menu and choose <strong>Install</strong> or <strong>Add to Home Screen</strong>. Look for the
                                install icon in the address bar.
                            </p>
                        )}
                    </div>
                )}

                <div className="rounded-2xl border border-border p-4 mt-1">
                    <div className="text-sm font-bold mb-2 inline-flex items-center gap-1.5">
                        <Bell className="h-4 w-4 text-primary" /> Notifications
                    </div>
                    {ios && !standalone ? (
                        <p className="text-sm text-muted-foreground">
                            On iPhone/iPad, install the app first (above) — then reopen this to turn on notifications.
                        </p>
                    ) : !supportsPush ? (
                        <p className="text-sm text-muted-foreground">This browser doesn't support notifications.</p>
                    ) : pushOn ? (
                        <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
                                <CheckCircle2 className="h-4 w-4" /> Notifications are on
                            </span>
                            <button
                                type="button"
                                data-testid="get-app-notify-off"
                                onClick={toggleNotifications}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border text-sm font-semibold disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Turn off
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            data-testid="get-app-notify-on"
                            onClick={toggleNotifications}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Turn on notifications
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
