import React, { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

const REASONS = [
    { value: "spam", label: "Spam or self-promotion" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "inaccurate", label: "Inaccurate details" },
    { value: "outdated", label: "Outdated or already happened" },
    { value: "duplicate", label: "Duplicate of another listing" },
    { value: "other", label: "Something else" },
];

export function ReportButton({ kind, targetId, className = "" }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("inaccurate");
    const [notes, setNotes] = useState("");
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            await api.submitReport({
                kind,
                target_id: targetId,
                reason,
                notes: notes || null,
                reporter_email: email || null,
                reporter_device: getDeviceId(),
            });
            toast.success("Thanks — the admin team will review this shortly.");
            setNotes("");
            setEmail("");
            setReason("inaccurate");
            setOpen(false);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send the report right now");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                data-testid={`report-btn-${kind}-${targetId}`}
                onClick={() => setOpen(true)}
                className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground ${className}`}
                title="Report a problem with this listing"
            >
                <Flag className="h-3 w-3" /> Report
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md" data-testid="report-dialog">
                    <DialogHeader>
                        <DialogTitle>Report a problem</DialogTitle>
                        <DialogDescription>
                            Tell us what&apos;s wrong with this listing. An admin will take a look — usually within one working day.
                        </DialogDescription>
                    </DialogHeader>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</span>
                        <select
                            data-testid="report-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        >
                            {REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm block mt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional notes (optional)</span>
                        <textarea
                            data-testid="report-notes"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <label className="text-sm block mt-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your email (optional, if you'd like a reply)</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <DialogFooter>
                        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button
                            type="button"
                            data-testid="report-submit"
                            disabled={busy}
                            onClick={submit}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                        >
                            {busy ? "Sending…" : "Send report"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
