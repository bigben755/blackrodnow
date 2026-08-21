import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
    UploadCloud, FileText, CheckCircle2, Trash2, ShieldCheck, Loader2, ArrowRight, AlertTriangle,
} from "lucide-react";
import { api, API } from "@/lib/api";

const inp = "w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm";

export default function SubmitEventsList() {
    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);
    const [items, setItems] = useState([]);
    const [parseInfo, setParseInfo] = useState(null);
    const [contact, setContact] = useState({ name: "", email: "", org: "", notes: "" });
    const [confirmed, setConfirmed] = useState(false);
    const [result, setResult] = useState(null);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        setBusy(true);
        try {
            const res = await api.publicParseEventList(file);
            setItems(res.items.map((it, i) => ({ ...it, _key: `${i}-${it.title}` })));
            setParseInfo({ format: res.format, count: res.count, filename: file.name });
            setStep(2);
            toast.success(`Found ${res.count} event${res.count !== 1 ? "s" : ""} in your file`);
        } catch (err) {
            toast.error(err?.response?.data?.detail || "We couldn't read that file — please use one of the templates");
        } finally {
            setBusy(false);
        }
    };

    const removeItem = (key) => setItems((cur) => cur.filter((it) => it._key !== key));

    const submit = async () => {
        if (!contact.name.trim() || !contact.email.includes("@")) return toast.error("Add your name and a valid email first");
        if (!confirmed) return toast.error("Please confirm the details are accurate");
        if (!items.length) return toast.error("No events left to submit");
        setBusy(true);
        try {
            const res = await api.publicSubmitEventList({
                submitter_name: contact.name,
                submitter_email: contact.email,
                org_name: contact.org,
                notes: contact.notes,
                items: items.map(({ _key, ...it }) => it),
            });
            setResult(res);
            setStep(3);
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Submission failed — please try again");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12" data-testid="submit-events-list-page">
            <span className="text-xs font-black uppercase tracking-wider text-primary">For organisations</span>
            <h1 className="text-4xl sm:text-5xl font-black mt-2">Submit your events list</h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
                Fill in one of our templates, upload it, check every detail, and send it in.
                Nothing is published automatically — the Blackrod Now team reviews and approves
                each event before it appears on the site.
            </p>

            {step === 1 && (
                <div className="mt-8 space-y-6">
                    <div className="rounded-2xl border border-border bg-surface p-5">
                        <div className="text-sm font-black">1 · Download a template</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Use the exact labels/columns — your file is read word-for-word, with no AI guesswork.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <a href={`${API}/admin/documents/template.docx`} download data-testid="list-word-template"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted">
                                <FileText className="h-3.5 w-3.5" /> Word template
                            </a>
                            <a href={`${API}/admin/documents/template.xlsx`} download data-testid="list-xlsx-template"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted">
                                <FileText className="h-3.5 w-3.5" /> Spreadsheet template
                            </a>
                        </div>
                    </div>
                    <div
                        onClick={() => !busy && fileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
                        data-testid="list-upload-dropzone"
                        className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/50"}`}
                    >
                        {busy ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Reading your file…
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <UploadCloud className="h-7 w-7 text-muted-foreground" />
                                <span className="text-sm font-black">2 · Drop your filled-in template here, or click to browse</span>
                                <span className="text-xs text-muted-foreground">.docx, .xlsx or .csv — max 10 MB</span>
                            </div>
                        )}
                        <input ref={fileRef} type="file" accept=".docx,.xlsx,.csv" className="hidden" data-testid="list-file-input"
                            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="mt-8 space-y-5">
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex gap-3" data-testid="list-accuracy-banner">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-900">
                            <strong>Check every detail below.</strong> These are exactly the words from your file —
                            dates, times, venues and costs will be reviewed by our team, but you are responsible
                            for their accuracy. Remove anything that isn't right and re-upload a corrected file.
                        </p>
                    </div>
                    <div className="text-sm font-black">{items.length} event{items.length !== 1 ? "s" : ""} from {parseInfo?.filename}</div>
                    <div className="space-y-3">
                        {items.map((it) => (
                            <div key={it._key} className="rounded-2xl border border-border bg-surface p-4" data-testid="list-review-item">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-black">{it.title}</div>
                                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                                            <span>📅 {it.date || "no date"}{it.start_time ? ` · ${it.start_time}${it.end_time ? `–${it.end_time}` : ""}` : ""}</span>
                                            {it.location && <span>📍 {it.location}</span>}
                                            <span>🏷 {it.category}</span>
                                            {it.cost && <span>💷 {it.cost}</span>}
                                            {it.recurrence_freq && it.recurrence_freq !== "none" && <span>🔁 repeats {it.recurrence_freq}</span>}
                                        </div>
                                        {it.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{it.description}</p>}
                                    </div>
                                    <button onClick={() => removeItem(it._key)} data-testid="list-remove-item"
                                        className="p-2 rounded-full hover:bg-muted text-muted-foreground" title="Remove this event">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                        <div className="text-sm font-black">3 · Your details</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} className={inp} placeholder="Your name *" data-testid="list-contact-name" />
                            <input value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className={inp} placeholder="Your email *" type="email" data-testid="list-contact-email" />
                            <input value={contact.org} onChange={(e) => setContact((c) => ({ ...c, org: e.target.value }))} className={inp} placeholder="Organisation (optional)" data-testid="list-contact-org" />
                            <input value={contact.notes} onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))} className={inp} placeholder="Notes for the team (optional)" data-testid="list-contact-notes" />
                        </div>
                        <label className="flex items-start gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" data-testid="list-confirm-checkbox" />
                            <span>I've checked every event above and confirm the details are accurate. I understand they'll only appear on Blackrod Now after review and approval.</span>
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => { setStep(1); setItems([]); }} className="px-4 py-2 rounded-full bg-muted text-xs font-semibold" data-testid="list-back-btn">
                                Start again
                            </button>
                            <button onClick={submit} disabled={busy} data-testid="list-submit-btn"
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60">
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                Send {items.length} event{items.length !== 1 ? "s" : ""} for review
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && result && (
                <div className="mt-10 rounded-2xl border border-border bg-surface p-8 text-center" data-testid="list-success-panel">
                    <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
                    <h2 className="text-lg font-black mt-3">Sent for review — thank you!</h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                        {result.created} event{result.created !== 1 ? "s are" : " is"} now with the Blackrod Now team.
                        Nothing goes live until each one has been checked and approved.
                    </p>
                    {result.skipped?.length > 0 && (
                        <p className="mt-2 text-xs text-amber-700">Skipped (missing title/date): {result.skipped.join(", ")}</p>
                    )}
                    <Link to="/" className="mt-5 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        Back to Blackrod Now <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            )}
        </div>
    );
}
