import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send, Eye, Mail, Loader2, CheckCircle2, Plus, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function InviteOrgs() {
    const [cfg, setCfg] = useState(null);
    const [subject, setSubject] = useState("");
    const [html, setHtml] = useState("");
    const [text, setText] = useState("");
    const [selected, setSelected] = useState(() => new Set());
    const [previewIndex, setPreviewIndex] = useState(0);
    const [preview, setPreview] = useState(null);
    const [testEmail, setTestEmail] = useState("benwordsworth@aol.com");
    const [busy, setBusy] = useState(false);
    const [sendResult, setSendResult] = useState(null);

    useEffect(() => {
        api.orgInvitesConfig()
            .then((d) => {
                setCfg(d);
                setSubject(d.default_subject);
                setHtml(d.default_html);
                setText(d.default_text);
                setSelected(new Set(d.contacts.map((c) => c.index)));
            })
            .catch(() => toast.error("Could not load invite tool"));
    }, []);

    const contacts = cfg?.contacts || [];

    const doPreview = async (index = previewIndex) => {
        try {
            const d = await api.orgInvitesPreview({ subject, html, text, index });
            setPreview(d);
        } catch {
            toast.error("Preview failed");
        }
    };

    useEffect(() => {
        if (cfg) doPreview(previewIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewIndex, cfg]);

    const toggle = (index) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };
    const allSelected = contacts.length > 0 && selected.size === contacts.length;
    const toggleAll = () =>
        setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.index)));

    const sendTest = async () => {
        if (!testEmail.includes("@")) return toast.error("Enter a valid test email");
        setBusy(true);
        try {
            const d = await api.orgInvitesTest({ subject, html, text, to: testEmail });
            if (d.ok) toast.success(`Test sent to ${testEmail} (claim + create examples)`);
            else toast.error("Test send had errors — check results");
            setSendResult({ kind: "test", ...d });
        } catch (e) {
            toast.error("Test send failed");
        } finally {
            setBusy(false);
        }
    };

    const sendBatch = async () => {
        const indexes = Array.from(selected);
        if (indexes.length === 0) return toast.error("Select at least one recipient");
        if (!window.confirm(`Send invitation emails to ${indexes.length} recipient(s) now? This cannot be undone.`)) return;
        setBusy(true);
        try {
            const d = await api.orgInvitesSend({ subject, html, text, indexes, skip_already_sent: true });
            toast.success(`Sent ${d.sent}, skipped ${d.skipped}, failed ${d.failed}`);
            setSendResult({ kind: "batch", ...d });
            const fresh = await api.orgInvitesConfig();
            setCfg(fresh);
        } catch {
            toast.error("Batch send failed");
        } finally {
            setBusy(false);
        }
    };

    const summary = useMemo(() => {
        const claim = contacts.reduce((n, c) => n + c.orgs.filter((o) => o.action === "claim").length, 0);
        const create = contacts.reduce((n, c) => n + c.orgs.filter((o) => o.action === "create").length, 0);
        const sent = contacts.filter((c) => c.sent_at).length;
        return { claim, create, sent };
    }, [contacts]);

    if (!cfg) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invite tool…
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8" data-testid="invite-orgs-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800" data-testid="invite-back-link">
                        <ArrowLeft className="h-4 w-4" /> Back to admin
                    </Link>
                    <h1 className="font-display text-3xl font-bold text-slate-900 mt-2">Invite organisations</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {cfg.total} contacts · {summary.claim} claim links · {summary.create} create links · {summary.sent} already sent
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Editor */}
                <Card className="p-5 space-y-4" data-testid="invite-editor">
                    <div>
                        <Label htmlFor="subj">Subject</Label>
                        <Input id="subj" data-testid="invite-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="text-xs text-slate-500">
                        Variables: <code>{"{{name}}"}</code> <code>{"{{first_name}}"}</code> <code>{"{{orgs}}"}</code>{" "}
                        <code>{"{{org_block}}"}</code> (auto claim/create buttons)
                    </div>
                    <Tabs defaultValue="html">
                        <TabsList>
                            <TabsTrigger value="html" data-testid="tab-html">HTML</TabsTrigger>
                            <TabsTrigger value="text" data-testid="tab-text">Plain text</TabsTrigger>
                        </TabsList>
                        <TabsContent value="html">
                            <Textarea data-testid="invite-html" className="font-mono text-xs min-h-[280px]" value={html} onChange={(e) => setHtml(e.target.value)} />
                        </TabsContent>
                        <TabsContent value="text">
                            <Textarea data-testid="invite-text" className="font-mono text-xs min-h-[280px]" value={text} onChange={(e) => setText(e.target.value)} />
                        </TabsContent>
                    </Tabs>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => doPreview()} data-testid="invite-refresh-preview">
                            <Eye className="h-4 w-4 mr-2" /> Refresh preview
                        </Button>
                        <div className="flex-1" />
                        <Input className="w-56" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} data-testid="invite-test-email" />
                        <Button onClick={sendTest} disabled={busy} data-testid="invite-send-test">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />} Send test
                        </Button>
                    </div>
                </Card>

                {/* Preview */}
                <Card className="p-5" data-testid="invite-preview">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-slate-800">Preview</h2>
                        <select
                            className="text-sm border rounded-md px-2 py-1"
                            value={previewIndex}
                            onChange={(e) => setPreviewIndex(Number(e.target.value))}
                            data-testid="invite-preview-recipient"
                        >
                            {contacts.map((c) => (
                                <option key={c.index} value={c.index}>
                                    {`${c.name} — ${c.email}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    {preview ? (
                        <div>
                            <div className="text-xs text-slate-500 mb-1">To: {preview.to}</div>
                            <div className="text-sm font-semibold text-slate-900 mb-3">{preview.subject}</div>
                            <iframe
                                title="email-preview"
                                className="w-full h-[360px] border rounded-md bg-white"
                                srcDoc={preview.html}
                                data-testid="invite-preview-frame"
                            />
                        </div>
                    ) : (
                        <div className="text-slate-400 text-sm">Select a recipient to preview…</div>
                    )}
                </Card>
            </div>

            {/* Recipients */}
            <Card className="p-5 mt-6" data-testid="invite-recipients">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-800">Recipients ({selected.size}/{contacts.length} selected)</h2>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} data-testid="invite-select-all" /> Select all
                        </label>
                        <Button onClick={sendBatch} disabled={busy} className="bg-blue-700 hover:bg-blue-800" data-testid="invite-send-batch">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Send to {selected.size}
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-400 border-b">
                                <th className="py-2 w-8"></th>
                                <th className="py-2">Name</th>
                                <th className="py-2">Email</th>
                                <th className="py-2">Organisations</th>
                                <th className="py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map((c) => (
                                <tr key={c.index} className="border-b last:border-0" data-testid={`invite-row-${c.index}`}>
                                    <td className="py-2">
                                        <Checkbox checked={selected.has(c.index)} onCheckedChange={() => toggle(c.index)} data-testid={`invite-check-${c.index}`} />
                                    </td>
                                    <td className="py-2 font-medium text-slate-800">{c.name}</td>
                                    <td className="py-2 text-slate-500">{c.email}</td>
                                    <td className="py-2">
                                        <div className="flex flex-wrap gap-1">
                                            {c.orgs.map((o, i) => (
                                                <Badge key={i} variant="outline" className={o.action === "claim" ? "border-green-300 text-green-700" : "border-blue-300 text-blue-700"}>
                                                    {o.action === "claim" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                                    {o.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2">
                                        {c.sent_at ? (
                                            <span className="inline-flex items-center text-green-600 text-xs" data-testid={`invite-sent-${c.index}`}>
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Sent
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">Not sent</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {sendResult && (
                <Card className="p-5 mt-6" data-testid="invite-results">
                    <h2 className="font-semibold text-slate-800 mb-2">
                        {sendResult.kind === "test" ? "Test result" : `Send result — sent ${sendResult.sent}, skipped ${sendResult.skipped}, failed ${sendResult.failed}`}
                    </h2>
                    <pre className="text-xs bg-slate-50 rounded-md p-3 overflow-x-auto max-h-56">{JSON.stringify(sendResult.results, null, 2)}</pre>
                </Card>
            )}
        </div>
    );
}
