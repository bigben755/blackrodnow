import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Smartphone, Share } from "lucide-react";
import { isIos, isStandalone } from "@/lib/push";

const DISMISS_KEY = "bn-install-dismissed-v1";

export default function InstallPrompt() {
    const [deferred, setDeferred] = useState(null);
    const [show, setShow] = useState(false);
    const [ios, setIos] = useState(false);

    useEffect(() => {
        if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return undefined;

        const onPrompt = (event) => {
            event.preventDefault();
            setDeferred(event);
            setShow(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);

        let timer;
        if (isIos()) {
            timer = window.setTimeout(() => {
                setIos(true);
                setShow(true);
            }, 4000);
        }
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            if (timer) window.clearTimeout(timer);
        };
    }, []);

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setShow(false);
    };

    const install = async () => {
        if (!deferred) return;
        deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
        setShow(false);
        setDeferred(null);
    };

    if (!show) return null;

    return (
        <div
            data-testid="install-prompt"
            className="fixed inset-x-3 bottom-3 z-[70] sm:left-auto sm:right-4 sm:w-[380px] rounded-2xl border border-border bg-background shadow-2xl p-4 animate-in slide-in-from-bottom-4"
        >
            <button
                type="button"
                data-testid="install-prompt-dismiss"
                onClick={dismiss}
                aria-label="Dismiss install prompt"
                className="absolute right-2.5 top-2.5 h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
                <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-6">
                <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl border border-border shrink-0" />
                <div className="min-w-0">
                    <div className="font-display font-bold text-sm">Get the Blackrod Now app</div>
                    {ios ? (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Tap <Share className="inline h-3.5 w-3.5 mx-0.5 -mt-0.5" /> <strong>Share</strong>, then{" "}
                            <strong>"Add to Home Screen"</strong> — you'll get one-tap access and can turn on{" "}
                            <Link to="/notifications" onClick={dismiss} className="underline font-semibold">
                                notifications
                            </Link>
                            .
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            One-tap access from your home screen, plus alerts from groups you follow.
                        </p>
                    )}
                    {!ios && (
                        <button
                            type="button"
                            data-testid="install-prompt-install"
                            onClick={install}
                            className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold"
                        >
                            <Smartphone className="h-3.5 w-3.5" /> Install app
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
