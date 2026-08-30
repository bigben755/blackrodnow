import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import Admin from "@/pages/Admin";

const POLL_INTERVAL_MS = 10000;

export default function AdminLive() {
    const [version, setVersion] = useState(0);
    const [pendingClaimCount, setPendingClaimCount] = useState(0);
    const previousClaimCount = useRef(null);
    const previousClaimFingerprint = useRef(null);
    const initialCheckComplete = useRef(false);
    const polling = useRef(false);

    const openClaimsQueue = useCallback(() => {
        localStorage.setItem("rn-admin-queue-filter", "claims");
        localStorage.setItem("rn-admin-queue-query", "");
        setVersion((current) => current + 1);
    }, []);

    const checkForClaimChanges = useCallback(async () => {
        if (polling.current) return;
        polling.current = true;

        try {
            // Read both the dashboard count and the actual pending request list.
            // The request list is the source Admin.jsx renders, while the count gives
            // us an independent signal if something has drifted.
            const [overview, pendingRequests] = await Promise.all([
                api.adminUsersOverview("").catch(() => ({ pending_claims: 0 })),
                api.orgEditRequests("pending").catch(() => []),
            ]);

            const pendingClaims = (Array.isArray(pendingRequests) ? pendingRequests : [])
                .filter((request) => request?.request_type === "claim");

            const overviewCount = Number(overview?.pending_claims || 0);
            const actualCount = pendingClaims.length;
            const nextClaimCount = Math.max(overviewCount, actualCount);
            const fingerprint = pendingClaims
                .map((request) => `${request.id || ""}:${request.created_at || ""}`)
                .sort()
                .join("|");

            setPendingClaimCount(nextClaimCount);

            // Existing pending claims must be surfaced on the very first load. The
            // previous implementation only reacted when the count changed after Admin
            // was already open, which meant an older claim could remain hidden forever
            // behind a saved queue filter or saved search term.
            if (!initialCheckComplete.current) {
                initialCheckComplete.current = true;
                previousClaimCount.current = nextClaimCount;
                previousClaimFingerprint.current = fingerprint;

                if (nextClaimCount > 0) {
                    localStorage.setItem("rn-admin-queue-filter", "claims");
                    localStorage.setItem("rn-admin-queue-query", "");
                    setVersion((current) => current + 1);

                    toast.info(
                        nextClaimCount === 1
                            ? "1 organisation claim is waiting for review"
                            : `${nextClaimCount} organisation claims are waiting for review`,
                        {
                            description: "The review queue has been opened on claim requests.",
                        }
                    );
                }
                return;
            }

            const previousCount = Number(previousClaimCount.current || 0);
            const fingerprintChanged = fingerprint !== previousClaimFingerprint.current;
            const countChanged = nextClaimCount !== previousCount;

            if (fingerprintChanged || countChanged) {
                const newClaims = Math.max(0, nextClaimCount - previousCount);

                if (newClaims > 0) {
                    localStorage.setItem("rn-admin-queue-filter", "claims");
                    localStorage.setItem("rn-admin-queue-query", "");

                    toast.info(
                        newClaims === 1
                            ? "New organisation claim received"
                            : `${newClaims} new organisation claims received`,
                        {
                            description: "The review queue has been refreshed and opened on claim requests.",
                        }
                    );
                }

                // Admin.jsx still loads claim/edit requests on mount, so remount after
                // the pending request set changes to ensure the rendered queue is fresh.
                setVersion((current) => current + 1);
            }

            previousClaimCount.current = nextClaimCount;
            previousClaimFingerprint.current = fingerprint;
        } catch {
            // Non-blocking: Admin remains usable if a background poll fails and the
            // next interval/focus event will try again.
        } finally {
            polling.current = false;
        }
    }, []);

    useEffect(() => {
        checkForClaimChanges();

        const intervalId = window.setInterval(checkForClaimChanges, POLL_INTERVAL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkForClaimChanges();
            }
        };

        const onFocus = () => checkForClaimChanges();

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", onFocus);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", onFocus);
        };
    }, [checkForClaimChanges]);

    return (
        <>
            {pendingClaimCount > 0 && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="font-bold text-sm">
                                {pendingClaimCount === 1
                                    ? "1 organisation claim is awaiting review"
                                    : `${pendingClaimCount} organisation claims are awaiting review`}
                            </div>
                            <div className="text-xs mt-0.5 opacity-80">
                                Verified profile claims need an admin decision before organisation access is granted.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openClaimsQueue}
                            className="shrink-0 px-4 py-2 rounded-full bg-amber-950 text-amber-50 text-xs font-bold"
                        >
                            Show claim{pendingClaimCount === 1 ? "" : "s"}
                        </button>
                    </div>
                </div>
            )}

            <Admin key={version} />
        </>
    );
}
