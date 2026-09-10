import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import AdminWorkspace from "@/components/AdminWorkspace";

const POLL_INTERVAL_MS = 15000;

export default function AdminLive() {
    const { refresh } = useApp();
    const [version, setVersion] = useState(0);
    const [pendingClaimCount, setPendingClaimCount] = useState(0);
    const [pendingEventCount, setPendingEventCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    const previousClaimCount = useRef(null);
    const previousEventCount = useRef(null);
    const previousMessageCount = useRef(null);
    const initialCheckComplete = useRef(false);
    const polling = useRef(false);

    const checkForChanges = useCallback(async () => {
        if (polling.current) return;
        polling.current = true;

        try {
            const [overview, pendingRequests, allEvents, stats] = await Promise.all([
                api.adminUsersOverview("").catch(() => ({ pending_claims: 0 })),
                api.orgEditRequests("pending").catch(() => []),
                api.events({ include_pending: true }).catch(() => []),
                api.stats().catch(() => ({ messages_unread: 0 })),
            ]);

            const pendingClaims = (Array.isArray(pendingRequests) ? pendingRequests : [])
                .filter((request) => request?.request_type === "claim");
            const pendingEvents = (Array.isArray(allEvents) ? allEvents : [])
                .filter((event) => event?.status === "pending" && !event?.is_recurrence_instance);

            const nextClaims = Math.max(Number(overview?.pending_claims || 0), pendingClaims.length);
            const nextEvents = pendingEvents.length;
            const nextMessages = Number(stats?.messages_unread || 0);

            setPendingClaimCount(nextClaims);
            setPendingEventCount(nextEvents);
            setUnreadMessageCount(nextMessages);

            if (!initialCheckComplete.current) {
                initialCheckComplete.current = true;
                previousClaimCount.current = nextClaims;
                previousEventCount.current = nextEvents;
                previousMessageCount.current = nextMessages;
                return;
            }

            const addedClaims = Math.max(0, nextClaims - Number(previousClaimCount.current || 0));
            const addedEvents = Math.max(0, nextEvents - Number(previousEventCount.current || 0));
            const addedMessages = Math.max(0, nextMessages - Number(previousMessageCount.current || 0));

            if (addedClaims > 0) {
                toast.info(
                    addedClaims === 1 ? "New organisation claim received" : `${addedClaims} new organisation claims received`,
                    { description: "Open the Claims tab to complete the ownership check." }
                );
            }
            if (addedEvents > 0) {
                toast.info(
                    addedEvents === 1 ? "New event awaiting review" : `${addedEvents} new events awaiting review`,
                    { description: "Open Content to review it." }
                );
                try {
                    await refresh();
                } catch {
                    // The next poll will retry.
                }
            }
            if (addedMessages > 0) {
                toast.info(
                    addedMessages === 1 ? "New admin message received" : `${addedMessages} new admin messages received`,
                    { description: "Open Messages to read or reply." }
                );
            }

            if (nextClaims !== previousClaimCount.current || nextEvents !== previousEventCount.current) {
                setVersion((current) => current + 1);
            }

            previousClaimCount.current = nextClaims;
            previousEventCount.current = nextEvents;
            previousMessageCount.current = nextMessages;
        } catch {
            // Admin remains usable if a background poll fails.
        } finally {
            polling.current = false;
        }
    }, [refresh]);

    useEffect(() => {
        checkForChanges();
        const intervalId = window.setInterval(checkForChanges, POLL_INTERVAL_MS);
        const onFocus = () => checkForChanges();
        const onVisibility = () => {
            if (document.visibilityState === "visible") checkForChanges();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [checkForChanges]);

    return (
        <AdminWorkspace
            version={version}
            pendingEventCount={pendingEventCount}
            pendingClaimCount={pendingClaimCount}
            unreadMessageCount={unreadMessageCount}
        />
    );
}
