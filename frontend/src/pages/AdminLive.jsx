import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import Admin from "@/pages/Admin";

const POLL_INTERVAL_MS = 10000;

export default function AdminLive() {
    const [version, setVersion] = useState(0);
    const previousClaimCount = useRef(null);
    const polling = useRef(false);

    const checkForClaimChanges = useCallback(async () => {
        if (polling.current) return;
        polling.current = true;

        try {
            const overview = await api.adminUsersOverview("");
            const nextClaimCount = Number(overview?.pending_claims || 0);
            const previous = previousClaimCount.current;

            if (previous !== null && nextClaimCount !== previous) {
                const newClaims = Math.max(0, nextClaimCount - previous);

                if (newClaims > 0) {
                    // A new verified organisation claim should never be hidden by a
                    // previously-saved queue filter/search. Put the admin straight on
                    // the claims queue before remounting Admin so its existing fetch
                    // picks up the new pending request immediately.
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

                // Admin.jsx currently loads org edit/claim requests on mount. A
                // controlled remount is therefore enough to refresh that queue without
                // periodically resetting the rest of the dashboard while an admin is
                // working.
                setVersion((current) => current + 1);
            }

            previousClaimCount.current = nextClaimCount;
        } catch {
            // This is deliberately non-blocking. Admin.jsx continues to work normally
            // if a background poll fails and the next poll will try again.
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

    return <Admin key={version} />;
}
