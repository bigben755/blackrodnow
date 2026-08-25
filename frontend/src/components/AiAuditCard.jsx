import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, ExternalLink, Check, X, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

const FIELD_LABELS = {
    title: "Title",
    start: "Start",
    end: "End",
    venue: "Venue",
    address: "Address",
    cost: "Cost",
    booking: "Booking",
    description: "Description",
};

const VERDICT_STYLE = {
    looks_accurate: "bg-emerald-100 text-emerald-900",
    needs_attention: "bg-amber-100 text-amber-900",
    likely_outdated: "bg-red-100 text-red-900",
    could_not_verify: "bg-muted text-muted-foreground",
};

const fmtValue = (field, value) => {
    if (!value) return "—";
    if (field === "start" || field === "end") {
        return String(value).slice(0, 16).replace("T", " · ");
    }
    return String(value);
};

export default function AiAuditCard({ onApplied }) {
    const [status, setStatus] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [ticks, setTicks] = useState({});
    const [busy, setBusy] = useState("");
    const pollRef = useRef(null);
    const prevRunning = useRef(false);

    const load = useCallback(async () => {
        try {
            const [s, list] = await Promise.all([
                api.eventAuditStatus(),
                api.eventEditProposals("pending"),
            ]);
            setStatus(s);
            setProposals(list || []);
            setTicks((current) => {
                const next = { ...current };
                (list || []).forEach((p) => {
                    if (!next[p.id]) {
                        next[p.id] = (p.changes || []).map((c) => c.field);
                    }
                });
                return next;
            });
            return s;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const running = ["queued", "running"].includes(status?.job?.status);

    useEffect(() => {
        if (!running) {
            if (prevRunning.current) {
                prevRunning.current = false;
                if (status?.job?.status === "done") {
                    toast.success(
                        `Audit finished — ${status.job.done} checked, ${status.job.proposals} suggested edit${status.job.proposals === 1 ? "" : "s"}`
                    );
                }
                if (onApplied) onApplied();
            }
            return undefined;
        }
        prevRunning.current = true;
        pollRef.current = window.setInterval(load, 4000);
        return () => window.clearInterval(pollRef.current);
    }, [running, load, status?.job?.status, status?.job?.done, status?.job?.proposals, onApplied]);

    const startAudit = async (mode) => {
        if (
            mode === "all" &&
            !window.confirm(
                "Re-check ALL upcoming events? Each event is one AI web-search check, so this uses more of your AI budget than checking new events only."
            )
        ) {
            return;
        }
        setBusy("start");
        try {
            await api.startEventAudit(mode);
            toast.success(mode === "all" ? "Re-checking all upcoming events…" : "Checking events not audited before…");
            await load();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not start the audit");
        } finally {
            setBusy("");
        }
    };

    const toggleField = (pid, field) => {
        setTicks((current) => {
            const set = new Set(current[pid] || []);
            if (set.has(field)) set.delete(field);
            else set.add(field);
            return { ...current, [pid]: Array.from(set) };
        });
    };

    const decide = async (proposal, approve) => {
        const fields = ticks[proposal.id] || [];
        if (approve && !fields.length) {
            toast.error("Tick at least one change to approve");
            return;
        }
        setBusy(proposal.id);
        try {
            if (approve) {
                await api.approveEventEditProposal(proposal.id, fields);
                toast.success(`Applied ${fields.length} change${fields.length === 1 ? "" : "s"} to "${proposal.event_title}"`);
                if (onApplied) onApplied();
            } else {
                await api.rejectEventEditProposal(proposal.id);
                toast.success("Suggestion dismissed");
            }
            setProposals((current) => current.filter((p) => p.id !== proposal.id));
            api.eventAuditStatus().then(setStatus).catch(() => {});
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Something went wrong");
        } finally {
            setBusy("");
        }
    };

    const job = status?.job;
    const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0;

    return (
        <div className="rounded-3xl border border-border bg-surface p-5" data-testid="ai-audit-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-display font-bold text-lg inline-flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" /> AI accuracy audit
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Checks upcoming events against the live web (organisers' sites, Facebook, Bolton Council). Suggested
                        corrections appear below with sources — nothing changes until you approve it.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        data-testid="ai-audit-run-new"
                        disabled={running || busy === "start"}
                        onClick={() => startAudit("new")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                    >
                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Check new events
                    </button>
                    <button
                        type="button"
                        data-testid="ai-audit-run-all"
                        disabled={running || busy === "start"}
                        onClick={() => startAudit("all")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Re-check all upcoming
                    </button>
                </div>
            </div>

            {running && (
                <div className="mt-4 rounded-2xl border border-border bg-background p-4" data-testid="ai-audit-progress">
                    <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            Checking {job.done}/{job.total || "…"} events
                        </span>
                        <span>{job.proposals} suggestion{job.proposals === 1 ? "" : "s"} so far</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    {job.current_title ? (
                        <div className="mt-2 text-[11px] text-muted-foreground truncate">Now checking: {job.current_title}</div>
                    ) : null}
                </div>
            )}

            {!running && job && job.status === "done" && (
                <div className="mt-3 text-xs text-muted-foreground" data-testid="ai-audit-last-run">
                    Last run: {job.done} event{job.done === 1 ? "" : "s"} checked · {job.proposals} suggested edit
                    {job.proposals === 1 ? "" : "s"}
                    {job.errors ? ` · ${job.errors} couldn't be checked` : ""}
                </div>
            )}
            {!running && job && job.status === "failed" && (
                <div className="mt-3 text-xs text-red-600" data-testid="ai-audit-failed">
                    Last run failed{job.error ? ` — ${job.error}` : ""}. You can start it again.
                </div>
            )}

            <div className="mt-4 space-y-3" data-testid="ai-audit-proposals">
                {proposals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No suggested edits waiting for review{running ? " yet — they'll appear here as the audit finds them." : "."}
                    </p>
                ) : (
                    proposals.map((p) => (
                        <div key={p.id} className="rounded-2xl border border-border bg-background p-4" data-testid={`proposal-card-${p.id}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <Link to={`/events/${p.event_id}`} className="font-semibold text-sm hover:underline">
                                        {p.event_title}
                                    </Link>
                                    <span
                                        className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${VERDICT_STYLE[p.verdict] || VERDICT_STYLE.could_not_verify}`}
                                    >
                                        {(p.verdict || "").replaceAll("_", " ")}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        data-testid={`proposal-approve-${p.id}`}
                                        disabled={busy === p.id}
                                        onClick={() => decide(p, true)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-semibold disabled:opacity-50"
                                    >
                                        <Check className="h-3 w-3" /> Approve ticked
                                    </button>
                                    <button
                                        type="button"
                                        data-testid={`proposal-reject-${p.id}`}
                                        disabled={busy === p.id}
                                        onClick={() => decide(p, false)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-semibold disabled:opacity-50"
                                    >
                                        <X className="h-3 w-3" /> Dismiss
                                    </button>
                                </div>
                            </div>

                            {p.summary ? <p className="mt-2 text-xs text-muted-foreground">{p.summary}</p> : null}

                            <div className="mt-3 space-y-2">
                                {(p.changes || []).map((c) => (
                                    <label
                                        key={c.field}
                                        className="flex items-start gap-2.5 rounded-xl border border-border p-2.5 cursor-pointer"
                                        data-testid={`proposal-field-${p.id}-${c.field}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 accent-[var(--primary,#0052FF)]"
                                            checked={(ticks[p.id] || []).includes(c.field)}
                                            onChange={() => toggleField(p.id, c.field)}
                                            data-testid={`proposal-tick-${p.id}-${c.field}`}
                                        />
                                        <div className="min-w-0 text-xs">
                                            <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                                                {FIELD_LABELS[c.field] || c.field}
                                            </div>
                                            <div className="mt-0.5">
                                                <span className="line-through text-muted-foreground break-words">{fmtValue(c.field, c.old)}</span>
                                                <span className="mx-1.5">→</span>
                                                <span className="font-semibold break-words">{fmtValue(c.field, c.new)}</span>
                                            </div>
                                            {c.evidence ? <div className="mt-1 text-muted-foreground">{c.evidence}</div> : null}
                                            {c.source_url ? (
                                                <a
                                                    href={c.source_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                                                    data-testid={`proposal-source-${p.id}-${c.field}`}
                                                >
                                                    <ExternalLink className="h-3 w-3" /> View source
                                                </a>
                                            ) : null}
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {(p.sources || []).length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {p.sources.map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1 rounded-full bg-muted text-[10px] font-semibold inline-flex items-center gap-1 max-w-[260px] truncate"
                                        >
                                            <ExternalLink className="h-3 w-3 shrink-0" /> {s.title || s.url}
                                        </a>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
