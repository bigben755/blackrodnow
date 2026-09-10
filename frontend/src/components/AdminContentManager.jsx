import React from "react";
import { Link } from "react-router-dom";
import {
    Archive,
    Building2,
    CalendarDays,
    CheckCircle2,
    Edit3,
    ExternalLink,
    HandHeart,
    Mail,
    MapPin,
    Search,
    ShieldCheck,
    Trash2,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import {
    archiveEventAdmin,
    deleteOrganisationCascadeAdmin,
    deleteVenueAdmin,
    deleteVolunteerAdmin,
    restoreEventAdmin,
} from "@/lib/communityActions";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const TYPES = [
    { key: "all", label: "All content" },
    { key: "event", label: "Events" },
    { key: "org", label: "Organisations" },
    { key: "venue", label: "Venues" },
    { key: "volunteer", label: "Volunteering" },
];

const META = {
    event: { label: "Event", icon: CalendarDays },
    org: { label: "Organisation", icon: Building2 },
    venue: { label: "Venue", icon: MapPin },
    volunteer: { label: "Volunteer opportunity", icon: HandHeart },
};

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const fmtDate = (value) => {
    if (!value) return "";
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
};

const checkLabel = (row) => {
    const verdict = row.raw?.check_result?.verdict;
    if (verdict === "looks_accurate") return "Checked · accurate";
    if (verdict === "needs_attention") return "Needs attention";
    if (verdict === "likely_outdated") return "Likely outdated";
    if (verdict === "could_not_verify") return "Could not verify";
    return "Not checked";
};

const checkClass = (row) => {
    const verdict = row.raw?.check_result?.verdict;
    if (verdict === "looks_accurate") return "bg-emerald-100 text-emerald-900";
    if (verdict === "needs_attention") return "bg-amber-100 text-amber-900";
    if (verdict === "likely_outdated") return "bg-red-100 text-red-900";
    return "bg-muted text-muted-foreground";
};

export default function AdminContentManager({ onMessageOrg, onCheckEvent, initialStatus = "", onInitialStatusHandled }) {
    const { events, orgs, venues, volunteerOpps, refresh } = useApp();
    const [type, setType] = React.useState("all");
    const [status, setStatus] = React.useState("active");

    React.useEffect(() => {
        if (!initialStatus) return;
        setStatus(initialStatus);
        if (onInitialStatusHandled) onInitialStatusHandled();
    }, [initialStatus, onInitialStatusHandled]);
    const [query, setQuery] = React.useState("");
    const [busyKey, setBusyKey] = React.useState("");
    const [selected, setSelected] = React.useState([]);
    const [editRow, setEditRow] = React.useState(null);
    const [editForm, setEditForm] = React.useState({});
    const [checkResults, setCheckResults] = React.useState({});

    const orgBySlug = React.useMemo(
        () => Object.fromEntries((orgs || []).map((org) => [org.slug, org])),
        [orgs]
    );

    const rows = React.useMemo(() => {
        const now = new Date();
        const eventRows = (events || [])
            .filter((event) => !event.is_recurrence_instance)
            .map((event) => ({
                kind: "event",
                id: event.id,
                title: event.title || event.id,
                orgSlug: event.orgSlug || "",
                status: event.status || "approved",
                active: (event.status || "approved") === "approved",
                upcoming: event.start ? new Date(event.end || event.start) >= now : false,
                detail: [fmtDate(event.start), orgBySlug[event.orgSlug]?.name || event.orgSlug, event.venue]
                    .filter(Boolean)
                    .join(" · "),
                raw: event,
            }));

        const orgRows = (orgs || []).map((org) => ({
            kind: "org",
            id: org.slug,
            title: org.name || org.slug,
            orgSlug: org.slug,
            status: org.status || "approved",
            active: (org.status || "approved") === "approved",
            upcoming: false,
            detail: [org.category, org.email || "No public email"].filter(Boolean).join(" · "),
            raw: org,
        }));

        const venueRows = (venues || []).map((venue) => ({
            kind: "venue",
            id: venue.id,
            title: venue.name || venue.id,
            orgSlug: "",
            status: "published",
            active: true,
            upcoming: false,
            detail: venue.address || "No address recorded",
            raw: venue,
        }));

        const volunteerRows = (volunteerOpps || []).map((opp) => ({
            kind: "volunteer",
            id: opp.id,
            title: opp.title || opp.id,
            orgSlug: opp.orgSlug || "",
            status: "published",
            active: true,
            upcoming: false,
            detail: [orgBySlug[opp.orgSlug]?.name || opp.orgSlug, opp.time, opp.age]
                .filter(Boolean)
                .join(" · "),
            raw: opp,
        }));

        return [...eventRows, ...orgRows, ...venueRows, ...volunteerRows];
    }, [events, orgBySlug, orgs, venues, volunteerOpps]);

    const counts = React.useMemo(() => {
        const out = { all: rows.length, event: 0, org: 0, venue: 0, volunteer: 0 };
        rows.forEach((row) => { out[row.kind] += 1; });
        return out;
    }, [rows]);

    const visibleRows = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rows
            .filter((row) => type === "all" || row.kind === type)
            .filter((row) => {
                if (status === "active" && !row.active) return false;
                if (status === "pending" && row.status !== "pending") return false;
                if (status === "upcoming" && !(row.kind === "event" && row.upcoming && row.status === "approved")) return false;
                if (status === "archived" && row.status !== "archived") return false;
                if (status === "unchecked" && !["event", "org"].includes(row.kind)) return false;
                if (status === "unchecked" && row.raw?.check_result) return false;
                if (!needle) return true;
                return [row.title, row.detail, row.id, row.status]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
            })
            .sort((a, b) => {
                if (a.kind === "event" && b.kind === "event") {
                    return String(a.raw.start || "").localeCompare(String(b.raw.start || ""));
                }
                return a.title.localeCompare(b.title);
            });
    }, [query, rows, status, type]);

    const selectedRows = visibleRows.filter((row) => selected.includes(`${row.kind}:${row.id}`));

    const openEdit = (row) => {
        if (row.kind === "event") return;
        setEditRow(row);
        if (row.kind === "org") {
            setEditForm({
                name: row.raw.name || "",
                category: row.raw.category || "",
                short: row.raw.short || "",
                email: row.raw.email || "",
                phone: row.raw.phone || "",
                website: row.raw.website || "",
                address: row.raw.address || "",
            });
        } else if (row.kind === "venue") {
            setEditForm({
                name: row.raw.name || "",
                address: row.raw.address || "",
                facilities: Array.isArray(row.raw.facilities) ? row.raw.facilities.join(", ") : (row.raw.facilities || ""),
                capacity: row.raw.capacity ?? "",
                accessibility: row.raw.accessibility || "",
                booking: row.raw.booking || "",
                image: row.raw.image || "",
            });
        } else if (row.kind === "volunteer") {
            setEditForm({
                title: row.raw.title || "",
                orgSlug: row.raw.orgSlug || "",
                description: row.raw.description || "",
                time: row.raw.time || "",
                age: row.raw.age || "",
                skills: row.raw.skills || "",
            });
        }
    };

    const saveEdit = async () => {
        if (!editRow) return;
        const key = `${editRow.kind}:${editRow.id}`;
        setBusyKey(key);
        try {
            if (editRow.kind === "org") {
                await api.patchOrg(editRow.id, editForm);
            } else if (editRow.kind === "venue") {
                const venuePatch = {
                    ...editForm,
                    facilities: String(editForm.facilities || "")
                        .split(/[,\n]+/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    capacity: editForm.capacity === "" || editForm.capacity == null
                        ? null
                        : Number(editForm.capacity),
                };
                if (venuePatch.capacity !== null && !Number.isFinite(venuePatch.capacity)) {
                    throw new Error("Capacity must be a number");
                }
                await api.updateVenue(editRow.id, venuePatch);
            } else if (editRow.kind === "volunteer") {
                await api.updateVolunteer(editRow.id, editForm);
            }
            await refresh();
            toast.success(`${META[editRow.kind].label} updated`);
            setEditRow(null);
        } catch (error) {
            toast.error(error?.response?.data?.detail || error?.message || "Could not save changes");
        } finally {
            setBusyKey("");
        }
    };

    const runCheck = async (row) => {
        if (!["event", "org"].includes(row.kind)) return;
        const key = `${row.kind}:${row.id}`;
        setBusyKey(key);
        try {
            const result = await api.adminCheckEntity(row.kind, row.id);
            setCheckResults((current) => ({ ...current, [key]: result }));
            await refresh();
            toast.success(result?.summary || "Accuracy check complete");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Accuracy check failed");
        } finally {
            setBusyKey("");
        }
    };

    const runSelectedChecks = async () => {
        const checkable = selectedRows.filter((row) => ["event", "org"].includes(row.kind));
        if (!checkable.length) {
            toast.info("Select events or organisations to check");
            return;
        }
        if (checkable.length > 20 && !window.confirm(`Run ${checkable.length} live web checks? This may take several minutes.`)) return;
        setBusyKey("bulk-check");
        try {
            let completed = 0;
            for (const row of checkable) {
                try {
                    await api.adminCheckEntity(row.kind, row.id);
                    completed += 1;
                } catch {
                    // Continue through the selection; individual failures remain unchecked.
                }
            }
            await refresh();
            toast.success(`${completed} of ${checkable.length} checks completed`);
        } finally {
            setBusyKey("");
        }
    };

    const remove = async (row) => {
        const wording = row.kind === "org"
            ? `Permanently delete “${row.title}” and its linked events, updates, volunteering listings, dashboard notifications and access records?`
            : `Permanently delete this ${META[row.kind].label.toLowerCase()}: “${row.title}”?`;
        if (!window.confirm(`${wording}\n\nThis cannot be undone.`)) return;

        const key = `${row.kind}:${row.id}`;
        setBusyKey(key);
        try {
            if (row.kind === "org") await deleteOrganisationCascadeAdmin(row.id);
            if (row.kind === "event") await api.deleteEvent(row.id);
            if (row.kind === "venue") await deleteVenueAdmin(row.id);
            if (row.kind === "volunteer") await deleteVolunteerAdmin(row.id);
            await refresh();
            setSelected((current) => current.filter((value) => value !== key));
            toast.success(`${META[row.kind].label} removed`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not remove item");
        } finally {
            setBusyKey("");
        }
    };

    const archiveEvent = async (row) => {
        const key = `event:${row.id}`;
        setBusyKey(key);
        try {
            await archiveEventAdmin(row.id);
            await refresh();
            toast.success("Event archived");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not archive event");
        } finally {
            setBusyKey("");
        }
    };

    const restoreEvent = async (row) => {
        const key = `event:${row.id}`;
        setBusyKey(key);
        try {
            await restoreEventAdmin(row.id);
            await refresh();
            toast.success("Event restored");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not restore event");
        } finally {
            setBusyKey("");
        }
    };

    const contactSlugFor = (row) => row.kind === "org" ? row.id : row.orgSlug;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-content-workspace">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Content</div>
                    <h2 className="font-display font-black text-3xl mt-1">Manage everything quickly</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        One searchable workspace for events, organisations, venues and volunteering opportunities. View, edit, verify, message, archive or remove without hunting through separate admin sections.
                    </p>
                </div>
                <div className="relative w-full lg:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search names, dates, venues, organisations…"
                        className="w-full rounded-2xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
                {TYPES.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setType(item.key)}
                        className={`rounded-2xl border p-3 text-left transition ${type === item.key ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-muted/50"}`}
                    >
                        <div className="text-2xl font-black">{counts[item.key] || 0}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{item.label}</div>
                    </button>
                ))}
            </div>

            <div className="mt-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {[
                        ["active", "Published / active"],
                        ["upcoming", "Upcoming events"],
                        ["pending", "Pending"],
                        ["unchecked", "Not checked"],
                        ["archived", "Archived"],
                        ["all", "All statuses"],
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setStatus(key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${status === key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{visibleRows.length} shown</span>
                    {selectedRows.length > 0 && (
                        <button
                            type="button"
                            disabled={busyKey === "bulk-check"}
                            onClick={runSelectedChecks}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                        >
                            <ShieldCheck className="h-3.5 w-3.5" /> Check selected ({selectedRows.length})
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3">Item</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Accuracy</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.map((row) => {
                                const Icon = META[row.kind].icon;
                                const key = `${row.kind}:${row.id}`;
                                const result = checkResults[key] || row.raw?.check_result;
                                const orgSlug = contactSlugFor(row);
                                return (
                                    <tr key={key} className="border-t border-border align-top hover:bg-muted/20">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(key)}
                                                onChange={(event) => setSelected((current) => event.target.checked ? [...current, key] : current.filter((value) => value !== key))}
                                                aria-label={`Select ${row.title}`}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-3">
                                                <span className="h-9 w-9 rounded-xl bg-muted grid place-items-center shrink-0"><Icon className="h-4 w-4" /></span>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-foreground">{row.title}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 max-w-xl">{row.detail || row.id}</div>
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{META[row.kind].label}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="inline-flex px-2 py-1 rounded-full bg-muted text-[10px] font-bold uppercase tracking-wider">{row.status}</span>
                                        </td>
                                        <td className="p-3 max-w-xs">
                                            {["event", "org"].includes(row.kind) ? (
                                                <div>
                                                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${checkClass({ ...row, raw: { ...row.raw, check_result: result } })}`}>
                                                        {result?.verdict ? checkLabel({ ...row, raw: { ...row.raw, check_result: result } }) : "Not checked"}
                                                    </span>
                                                    {result?.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.summary}</div>}
                                                </div>
                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-end flex-wrap gap-1.5">
                                                {row.kind === "event" && (
                                                    <Link to={`/events/${row.id}`} target="_blank" className="action"><ExternalLink className="h-3.5 w-3.5" /> View</Link>
                                                )}
                                                {row.kind === "org" && (
                                                    <Link to={`/organisations/${row.id}`} target="_blank" className="action"><ExternalLink className="h-3.5 w-3.5" /> View</Link>
                                                )}
                                                {row.kind === "event" ? (
                                                    <Link to={`/edit-event/${row.id}`} className="action"><Edit3 className="h-3.5 w-3.5" /> Edit</Link>
                                                ) : (
                                                    <button type="button" onClick={() => openEdit(row)} className="action"><Edit3 className="h-3.5 w-3.5" /> Edit</button>
                                                )}
                                                {["event", "org"].includes(row.kind) && (
                                                    <button type="button" disabled={Boolean(busyKey)} onClick={() => row.kind === "event" && onCheckEvent ? onCheckEvent(row.id) : runCheck(row)} className="action">
                                                        <ShieldCheck className="h-3.5 w-3.5" /> Check
                                                    </button>
                                                )}
                                                {orgSlug && onMessageOrg && (
                                                    <button type="button" onClick={() => onMessageOrg(orgSlug)} className="action"><Mail className="h-3.5 w-3.5" /> Message</button>
                                                )}
                                                {row.kind === "event" && row.status !== "archived" && (
                                                    <button type="button" disabled={busyKey === key} onClick={() => archiveEvent(row)} className="action"><Archive className="h-3.5 w-3.5" /> Archive</button>
                                                )}
                                                {row.kind === "event" && row.status === "archived" && (
                                                    <button type="button" disabled={busyKey === key} onClick={() => restoreEvent(row)} className="action text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Restore</button>
                                                )}
                                                <button type="button" disabled={Boolean(busyKey)} onClick={() => remove(row)} className="action text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!visibleRows.length && (
                                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No matching content.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
                “Check” uses the existing live-web verification system. Permanent deletion always asks for confirmation; organisation deletion also removes linked site records to avoid orphaned content.
            </p>

            <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Quick edit {editRow ? META[editRow.kind].label.toLowerCase() : "item"}</DialogTitle>
                    </DialogHeader>
                    {editRow && (
                        <div className="grid gap-3">
                            {editRow.kind === "org" && (
                                <>
                                    <Field label="Name" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
                                    <Field label="Category" value={editForm.category} onChange={(v) => setEditForm((f) => ({ ...f, category: v }))} />
                                    <Field label="Short description" value={editForm.short} onChange={(v) => setEditForm((f) => ({ ...f, short: v }))} multiline />
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <Field label="Email" value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))} />
                                        <Field label="Phone" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} />
                                    </div>
                                    <Field label="Website" value={editForm.website} onChange={(v) => setEditForm((f) => ({ ...f, website: v }))} />
                                    <Field label="Address" value={editForm.address} onChange={(v) => setEditForm((f) => ({ ...f, address: v }))} />
                                </>
                            )}
                            {editRow.kind === "venue" && (
                                <>
                                    <Field label="Name" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
                                    <Field label="Address" value={editForm.address} onChange={(v) => setEditForm((f) => ({ ...f, address: v }))} />
                                    <Field label="Facilities" value={editForm.facilities} onChange={(v) => setEditForm((f) => ({ ...f, facilities: v }))} multiline />
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <Field label="Capacity" value={editForm.capacity} onChange={(v) => setEditForm((f) => ({ ...f, capacity: v }))} />
                                        <Field label="Accessibility" value={editForm.accessibility} onChange={(v) => setEditForm((f) => ({ ...f, accessibility: v }))} />
                                    </div>
                                    <Field label="Booking information" value={editForm.booking} onChange={(v) => setEditForm((f) => ({ ...f, booking: v }))} />
                                    <Field label="Image URL" value={editForm.image} onChange={(v) => setEditForm((f) => ({ ...f, image: v }))} />
                                </>
                            )}
                            {editRow.kind === "volunteer" && (
                                <>
                                    <Field label="Title" value={editForm.title} onChange={(v) => setEditForm((f) => ({ ...f, title: v }))} />
                                    <label className="block">
                                        <span className="text-xs font-bold">Organisation</span>
                                        <select value={editForm.orgSlug || ""} onChange={(e) => setEditForm((f) => ({ ...f, orgSlug: e.target.value }))} className={`${inputClass} mt-1`}>
                                            <option value="">Choose organisation</option>
                                            {(orgs || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}
                                        </select>
                                    </label>
                                    <Field label="Description" value={editForm.description} onChange={(v) => setEditForm((f) => ({ ...f, description: v }))} multiline />
                                    <div className="grid sm:grid-cols-3 gap-3">
                                        <Field label="Time commitment" value={editForm.time} onChange={(v) => setEditForm((f) => ({ ...f, time: v }))} />
                                        <Field label="Age" value={editForm.age} onChange={(v) => setEditForm((f) => ({ ...f, age: v }))} />
                                        <Field label="Skills" value={editForm.skills} onChange={(v) => setEditForm((f) => ({ ...f, skills: v }))} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <button type="button" onClick={() => setEditRow(null)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold"><XCircle className="h-4 w-4 inline mr-1" /> Cancel</button>
                        <button type="button" onClick={saveEdit} disabled={Boolean(busyKey)} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"><CheckCircle2 className="h-4 w-4 inline mr-1" /> Save changes</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style>{`.action{display:inline-flex;align-items:center;gap:.3rem;border:1px solid hsl(var(--border));border-radius:9999px;padding:.4rem .65rem;font-size:.7rem;font-weight:700;white-space:nowrap}.action:hover{background:hsl(var(--muted))}`}</style>
        </section>
    );
}

function Field({ label, value, onChange, multiline = false }) {
    return (
        <label className="block">
            <span className="text-xs font-bold">{label}</span>
            {multiline ? (
                <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputClass} mt-1 resize-y`} />
            ) : (
                <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`} />
            )}
        </label>
    );
}