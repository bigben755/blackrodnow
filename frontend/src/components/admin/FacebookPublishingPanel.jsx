import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { Facebook, RefreshCw, Send, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";

const authHeaders = (json = false) => {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (typeof window === "undefined") return headers;

    const jwt = localStorage.getItem("rn-admin-jwt") || "";
    const adminCode = localStorage.getItem("rn-admin-code") || "";
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    if (adminCode) headers["X-Admin-Code"] = adminCode;
    return headers;
};

const readJson = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...authHeaders(Boolean(options.body)),
            ...(options.headers || {}),
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || `Request failed (${response.status})`);
    }
    return payload;
};

const shortDate = (value) => {
    if (!value) return "Date not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

export default function FacebookPublishingPanel() {
    const [status, setStatus] = useState(null);
    const [data, setData] = useState({ eligible: [], posted: [] });
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [nextStatus, nextData] = await Promise.all([
                readJson("/admin/facebook/status"),
                readJson("/admin/facebook/events"),
            ]);
            setStatus(nextStatus);
            setData(nextData || { eligible: [], posted: [] });
            setSelected((current) => {
                const valid = new Set((nextData?.eligible || []).map((event) => event.id));
                return new Set([...current].filter((id) => valid.has(id)));
            });
        } catch (error) {
            toast.error(error.message || "Could not load Facebook publishing status");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const eligibleIds = useMemo(() => (data.eligible || []).map((event) => event.id), [data.eligible]);
    const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(eligibleIds));
    };

    const toggleOne = (id) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const publishSelected = async () => {
        const eventIds = [...selected];
        if (!eventIds.length) {
            toast.error("Select at least one event first");
            return;
        }
        setPublishing(true);
        try {
            const result = await readJson("/admin/facebook/publish-current", {
                method: "POST",
                body: JSON.stringify({ event_ids: eventIds }),
            });
            const published = Number(result?.published || 0);
            const failed = (result?.results || []).filter((item) => !item.ok).length;
            if (published) toast.success(`${published} event${published === 1 ? "" : "s"} published to Facebook`);
            if (failed) toast.error(`${failed} event${failed === 1 ? "" : "s"} could not be published`);
            setSelected(new Set());
            await refresh();
        } catch (error) {
            toast.error(error.message || "Facebook publishing failed");
        } finally {
            setPublishing(false);
        }
    };

    const publishOne = async (eventId) => {
        setPublishing(true);
        try {
            const result = await readJson(`/admin/facebook/events/${eventId}/publish`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            if (result?.ok) toast.success("Event published to Facebook");
            else toast.error(result?.error || "Facebook publishing failed");
            await refresh();
        } catch (error) {
            toast.error(error.message || "Facebook publishing failed");
        } finally {
            setPublishing(false);
        }
    };

    return (
        <section className="rounded-3xl border border-border bg-surface p-5 mb-6" data-testid="facebook-publishing-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="font-display font-bold text-xl inline-flex items-center gap-2">
                        <Facebook className="h-5 w-5 text-primary" /> Facebook publishing
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Publish current events to the Blackrod Now Facebook Page. Newly approved events are posted automatically.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading || publishing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
            </div>

            {status && (
                <div className={`rounded-2xl border p-3 mb-4 text-sm ${status.configured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                    <div className="flex items-center gap-2 font-semibold">
                        {status.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        {status.configured ? "Blackrod Now Facebook connection ready" : "Facebook token not configured on the backend"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        Auto-publish: {status.auto_publish_enabled ? "On" : "Off"} · Ready to publish: {status.eligible_count || 0} · Already posted: {status.posted_count || 0}
                        {status.error_count ? ` · Errors: ${status.error_count}` : ""}
                    </div>
                    {!status.configured && (
                        <div className="text-xs mt-2">
                            Add <code>FACEBOOK_PAGE_ACCESS_TOKEN</code> to the backend secrets/environment. The token is never shown in this admin page.
                        </div>
                    )}
                </div>
            )}

            {(data.eligible || []).length > 0 ? (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                            Select all current events ({data.eligible.length})
                        </label>
                        <button
                            type="button"
                            disabled={!status?.configured || publishing || selected.size === 0}
                            onClick={publishSelected}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                        >
                            <Send className="h-3.5 w-3.5" />
                            {publishing ? "Publishing…" : `Publish selected (${selected.size})`}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
                        {data.eligible.map((event) => (
                            <div key={event.id} className="p-3 flex items-center gap-3 bg-background">
                                <input
                                    type="checkbox"
                                    checked={selected.has(event.id)}
                                    onChange={() => toggleOne(event.id)}
                                    aria-label={`Select ${event.title}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm truncate">{event.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {shortDate(event.start)}{event.venue ? ` · ${event.venue}` : ""}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={!status?.configured || publishing}
                                    onClick={() => publishOne(event.id)}
                                    className="shrink-0 px-3 py-1.5 rounded-full border border-border text-xs font-semibold disabled:opacity-50"
                                >
                                    Post now
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground text-center">
                    {loading ? "Loading Facebook publishing queue…" : "No current approved events are waiting to be posted to Facebook."}
                </div>
            )}

            {(data.posted || []).length > 0 && (
                <details className="mt-4">
                    <summary className="text-xs font-semibold cursor-pointer">Recently published to Facebook ({data.posted.length})</summary>
                    <div className="mt-2 space-y-2">
                        {data.posted.slice(0, 10).map((event) => (
                            <div key={event.id} className="flex items-center justify-between gap-3 text-xs rounded-xl bg-muted px-3 py-2">
                                <span className="truncate">{event.title || event.id}</span>
                                {event.facebook_post_url ? (
                                    <a href={event.facebook_post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">
                                        View post <ExternalLink className="h-3 w-3" />
                                    </a>
                                ) : (
                                    <span className="text-muted-foreground">Posted</span>
                                )}
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}
