import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import Admin from "@/pages/Admin";

const POLL_INTERVAL_MS = 10000;

export default function AdminLive() {
    const { refresh } = useApp();

    const [version, setVersion] = useState(0);
    const [pendingClaimCount, setPendingClaimCount] = useState(0);
    const [pendingEventCount, setPendingEventCount] = useState(0);

    const previousClaimCount = useRef(null);
    const previousClaimFingerprint = useRef(null);
    const previousEventCount = useRef(null);
    const previousEventFingerprint = useRef(null);
    const initialCheckComplete = useRef(false);
    const polling = useRef(false);

    const openClaimsQueue = useCallback(() => {
        localStorage.setItem("rn-admin-queue-filter", "claims");
        localStorage.setItem("rn-admin-queue-query", "");
        setVersion((current) => current + 1);
    }, []);

    const openEventsQueue = useCallback(async () => {
        localStorage.setItem("rn-admin-queue-filter", "events");
        localStorage.setItem("rn-admin-queue-query", "");

        try {
            await refresh();
        } catch {
            // The remount below will still keep Admin usable if refresh fails.
        }

        setVersion((current) => current + 1);
    }, [refresh]);

    const checkForQueueChanges = useCallback(async () => {
        if (polling.current) return;
        polling.current = true;

        try {
            // Read both the dashboard claim count and the real queue data. Claims are
            // rendered from org-edit requests; pending events live in the events
            // collection and must be surfaced independently of any saved queue filter.
            const [overview, pendingRequests, allEvents] = await Promise.all([
                api.adminUsersOverview("").catch(() => ({ pending_claims: 0 })),
                api.orgEditRequests("pending").catch(() => []),
                api.events({ include_pending: true }).catch(() => []),
            ]);

            const pendingClaims = (Array.isArray(pendingRequests) ? pendingRequests : [])
                .filter((request) => request?.request_type === "claim");

            const pendingEvents = (Array.isArray(allEvents) ? allEvents : [])
                .filter((event) => event?.status === "pending" && !event?.is_recurrence_instance);

            const overviewCount = Number(overview?.pending_claims || 0);
            const actualClaimCount = pendingClaims.length;
            const nextClaimCount = Math.max(overviewCount, actualClaimCount);
            const claimFingerprint = pendingClaims
                .map((request) => `${request.id || ""}:${request.created_at || ""}`)
                .sort()
                .join("|");

            const nextEventCount = pendingEvents.length;
            const eventFingerprint = pendingEvents
                .map((event) => `${event.id || ""}:${event.updated_at || event.created_at || event.start || ""}`)
                .sort()
                .join("|");

            setPendingClaimCount(nextClaimCount);
            setPendingEventCount(nextEventCount);

            if (!initialCheckComplete.current) {
                initialCheckComplete.current = true;
                previousClaimCount.current = nextClaimCount;
                previousClaimFingerprint.current = claimFingerprint;
                previousEventCount.current = nextEventCount;
                previousEventFingerprint.current = eventFingerprint;

                // Existing claims are deliberately opened on first load so they cannot
                // remain hidden behind an old queue filter. Pending events get their own
                // always-visible banner below instead, avoiding an unexpected filter
                // change while an admin is reviewing another queue.
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

            const previousClaimTotal = Number(previousClaimCount.current || 0);
            const claimFingerprintChanged = claimFingerprint !== previousClaimFingerprint.current;
            const claimCountChanged = nextClaimCount !== previousClaimTotal;

            if (claimFingerprintChanged || claimCountChanged) {
                const newClaims = Math.max(0, nextClaimCount - previousClaimTotal);

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

                setVersion((current) => current + 1);
            }

            const previousEventTotal = Number(previousEventCount.current || 0);
            const eventFingerprintChanged = eventFingerprint !== previousEventFingerprint.current;
            const eventCountChanged = nextEventCount !== previousEventTotal;

            if (eventFingerprintChanged || eventCountChanged) {
                const newEvents = Math.max(0, nextEventCount - previousEventTotal);

                if (newEvents > 0) {
                    toast.info(
                        newEvents === 1
                            ? "New event awaiting review"
                            : `${newEvents} new events awaiting review`,
                        {
                            description: "Use the pending-events banner to open the event queue.",
                        }
                    );
                }

                // Admin's event list comes from AppContext, so refresh it when the
                // backend pending-event set changes. This prevents the headline count
                // and the rendered queue from drifting apart.
                try {
                    await refresh();
                } catch {
                    // Non-blocking. The next poll or manual button press will retry.
                }
            }

            previousClaimCount.current = nextClaimCount;
            previousClaimFingerprint.current = claimFingerprint;
            previousEventCount.current = nextEventCount;
            previousEventFingerprint.current = eventFingerprint;
        } catch {
            // Non-blocking: Admin remains usable if a background poll fails and the
            // next interval/focus event will try again.
        } finally {
            polling.current = false;
        }
    }, [refresh]);

    useEffect(() => {
        checkForQueueChanges();

        const intervalId = window.setInterval(checkForQueueChanges, POLL_INTERVAL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkForQueueChanges();
            }
        };

        const onFocus = () => checkForQueueChanges();

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", onFocus);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", onFocus);
        };
    }, [checkForQueueChanges]);

    return (
        <>
            {(pendingEventCount > 0 || pendingClaimCount > 0) && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-3">
                    {pendingEventCount > 0 && (
                        <div className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-blue-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div className="font-bold text-sm">
                                    {pendingEventCount === 1
                                        ? "1 event is awaiting review"
                                        : `${pendingEventCount} events are awaiting review`}
                                </div>
                                <div className="text-xs mt-0.5 opacity-80">
                                    This banner is independent of your saved review-queue filter, so pending events cannot be hidden accidentally.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={openEventsQueue}
                                className="shrink-0 px-4 py-2 rounded-full bg-blue-950 text-blue-50 text-xs font-bold"
                            >
                                Show pending event{pendingEventCount === 1 ? "" : "s"}
                            </button>
                        </div>
                    )}

                    {pendingClaimCount > 0 && (
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
                    )}
                </div>
            )}

            <Admin key={version} />
        </>
    );
}
