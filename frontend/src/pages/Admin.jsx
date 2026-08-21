import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api, API } from "@/lib/api";
import { Stat, CategoryBadge, formatDate, formatTime } from "@/components/Cards";
import {
    CalendarDays, Building2, Inbox, Users, Star, Check, X, Trash2, BarChart3, Mail,
    Send, Edit3, Eye, MessageSquare, Bell, Pencil, UploadCloud, FileText, Sparkles, RefreshCw, Newspaper, HandHeart,
    LogIn, MapPin, ShieldCheck, Archive, PauseCircle, UserPlus, Link2, Search, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import EventImageInput from "@/components/EventImageInput";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import RecurrenceFields, { buildRecurrencePayload } from "@/components/RecurrenceFields";

export default function Admin() {
    const {
        events, orgs, stats, refresh,
        setEventStatus, toggleEventFeatured, deleteEvent,
        setOrgStatus, deleteOrg,
        role,
        adminCodeSession,
        impersonateOrg,
    } = useApp();

    const [requests, setRequests] = useState([]);
    const [requestNotes, setRequestNotes] = useState({});
    const [queueFilter, setQueueFilter] = useState(() => localStorage.getItem("rn-admin-queue-filter") || "all");
    const [query, setQuery] = useState(() => localStorage.getItem("rn-admin-queue-query") || "");
    const [selectedEventIds, setSelectedEventIds] = useState([]);
    const [selectedOrgSlugs, setSelectedOrgSlugs] = useState([]);
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [activeTarget, setActiveTarget] = useState(null);
    const [attention, setAttention] = useState({ counts: {}, attention: {} });
    const [orgsWithoutAdmins, setOrgsWithoutAdmins] = useState([]);
    const [claimInvites, setClaimInvites] = useState([]);
    const [userOverview, setUserOverview] = useState({ users: [], pending_invites: 0, pending_claims: 0, pending_member_invites: 0 });
    const [memberInvites, setMemberInvites] = useState([]);
    const [memberOrgSlug, setMemberOrgSlug] = useState("");
    const [memberRoster, setMemberRoster] = useState({ members: [], invites: [] });
    const [auditRows, setAuditRows] = useState([]);
    const [userSearch, setUserSearch] = useState("");
    const [taxonomy, setTaxonomy] = useState({ event_categories: [], organisation_categories: [] });
    const [taxonomyBusy, setTaxonomyBusy] = useState(false);
    const navigate = useNavigate();

    const loginAsOrg = async (slug, name) => {
        try {
            // Navigate BEFORE flipping role so Admin's RequireRole guard doesn't
            // race-redirect to '/' when it re-renders with role='org'.
            navigate("/organisation-dashboard");
            await impersonateOrg(slug);
            toast.success(`Logged in as ${name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Impersonation failed. Check admin code.");
        }
    };

    useEffect(() => {
        localStorage.setItem("rn-admin-queue-filter", queueFilter);
    }, [queueFilter]);

    useEffect(() => {
        localStorage.setItem("rn-admin-queue-query", query);
    }, [query]);

    useEffect(() => {
        api.orgEditRequests("pending").then(setRequests).catch(() => setRequests([]));
    }, []);

    useEffect(() => {
        if (!memberOrgSlug && orgs.length) {
            const first = orgs.find((o) => o.status !== "rejected") || orgs[0];
            if (first?.slug) setMemberOrgSlug(first.slug);
        }
    }, [orgs, memberOrgSlug]);

    useEffect(() => {
        if (!memberOrgSlug) {
            setMemberRoster({ members: [], invites: [] });
            return;
        }
        api.adminOrgMembers(memberOrgSlug)
            .then((data) => setMemberRoster(data || { members: [], invites: [] }))
            .catch(() => setMemberRoster({ members: [], invites: [] }));
    }, [memberOrgSlug]);

    useEffect(() => {
        const id = window.setTimeout(async () => {
            try {
                const [attentionData, orphanOrgs, invites, usersData, taxonomyData, auditData, memberInvitesData] = await Promise.all([
                    api.adminEventsAttention().catch(() => ({ counts: {}, attention: {} })),
                    api.adminOrgsWithoutAdmins().catch(() => []),
                    api.adminOrgClaimInvites("pending").catch(() => []),
                    api.adminUsersOverview(userSearch.trim()).catch(() => ({ users: [], pending_invites: 0, pending_claims: 0, pending_member_invites: 0 })),
                    api.taxonomy().catch(() => ({ event_categories: [], organisation_categories: [] })),
                    api.adminAuditLog(80).catch(() => []),
                    api.adminMemberInvites("pending").catch(() => []),
                ]);
                setAttention(attentionData || { counts: {}, attention: {} });
                setOrgsWithoutAdmins(orphanOrgs || []);
                setClaimInvites(invites || []);
                setUserOverview(usersData || { users: [], pending_invites: 0, pending_claims: 0, pending_member_invites: 0 });
                setTaxonomy(taxonomyData || { event_categories: [], organisation_categories: [] });
                setAuditRows(auditData || []);
                setMemberInvites(memberInvitesData || []);
            } catch {
                // non-blocking for legacy admin sections
            }
        }, 250);
        return () => window.clearTimeout(id);
    }, [userSearch]);

    // Manage table shows the real event records only — virtual recurring
    // instances share the same parent record so editing/deleting a virtual
    // clone would fail. Skipping them keeps every real event visible.
    const approvedEvents = events.filter(
        (e) => e.status === "approved" && !e.is_recurrence_instance
    );
    const pendingEvents = events.filter(
        (e) => e.status === "pending" && !e.is_recurrence_instance
    );
    const pendingOrgs = orgs.filter((o) => o.status === "pending");

    // Search + filter state for the Manage events table.
    const [eventSearch, setEventSearch] = useState("");
    const [eventOrgFilter, setEventOrgFilter] = useState("");
    const [eventCategoryFilter, setEventCategoryFilter] = useState("");
    const filteredApprovedEvents = React.useMemo(() => {
        const needle = eventSearch.trim().toLowerCase();
        const rows = approvedEvents.filter((e) => {
            if (eventOrgFilter && e.orgSlug !== eventOrgFilter) return false;
            if (eventCategoryFilter && e.category !== eventCategoryFilter) return false;
            if (!needle) return true;
            const hay = [e.title, e.venue, e.address, e.description, e.orgSlug, e.category]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return hay.includes(needle);
        });
        return rows.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    }, [approvedEvents, eventSearch, eventOrgFilter, eventCategoryFilter]);

    const analytics = stats?.analytics || {};
    const siteOverview = analytics.overview || {};
    const siteEngagement = analytics.engagement || {};
    const siteHealth = analytics.health || {};
    const topOrgs = analytics.top_orgs_30d || [];
    const topEvents = analytics.top_events_30d || [];
    const sharePlatforms = analytics.share_platforms_30d || [];

    const normalize = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const pendingEventDuplicates = new Map();
    approvedEvents.forEach((event) => {
        pendingEventDuplicates.set(`${normalize(event.title)}|${(event.start || "").slice(0, 10)}`, event);
    });
    const pendingOrgDuplicates = new Map();
    orgs.filter((o) => o.status === "approved").forEach((org) => pendingOrgDuplicates.set(normalize(org.name), org));

    const queryMatches = (value) => normalize(value).includes(normalize(query));
    const matchesFilter = (kind) => queueFilter === "all" || queueFilter === kind || (queueFilter === "duplicates" && kind === "duplicates");

    const visiblePendingEvents = pendingEvents.filter((event) => {
        const dup = pendingEventDuplicates.get(`${normalize(event.title)}|${(event.start || "").slice(0, 10)}`);
        const kind = dup ? "duplicates" : "events";
        return matchesFilter(kind) && (!query || queryMatches(`${event.title} ${event.venue} ${event.category}`));
    });
    const visiblePendingOrgs = pendingOrgs.filter((org) => {
        const dup = pendingOrgDuplicates.get(normalize(org.name));
        const kind = dup ? "duplicates" : "orgs";
        return matchesFilter(kind) && (!query || queryMatches(`${org.name} ${org.short} ${org.category}`));
    });
    const visibleRequests = requests.filter((request) => {
        const kind = request.request_type === "claim" ? "claims" : "requests";
        return matchesFilter(kind) && (!query || queryMatches(`${request.org_name} ${request.contact_name} ${request.message}`));
    });

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            const key = event.key.toLowerCase();
            if (!["a", "r"].includes(key)) return;
            const target = activeTarget || (
                visiblePendingEvents[0]
                    ? { kind: "event", id: visiblePendingEvents[0].id }
                    : visiblePendingOrgs[0]
                        ? { kind: "org", id: visiblePendingOrgs[0].slug }
                        : visibleRequests[0]
                            ? { kind: "request", id: visibleRequests[0].id }
                            : null
            );
            if (!target) return;
            event.preventDefault();
            if (target.kind === "event") {
                key === "a" ? approveEvent(target.id) : rejectEvent(target.id);
            } else if (target.kind === "org") {
                key === "a" ? approveOrg(target.id) : rejectOrg(target.id);
            } else if (target.kind === "request") {
                key === "a" ? reviewRequest(target.id, "approved") : reviewRequest(target.id, "rejected");
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeTarget, visiblePendingEvents, visiblePendingOrgs, visibleRequests]);

    const approveEvent = async (id) => {
        await setEventStatus(id, "approved");
        setSelectedEventIds((current) => current.filter((value) => value !== id));
        toast.success("Event approved");
    };

    const rejectEvent = async (id) => {
        await setEventStatus(id, "rejected");
        setSelectedEventIds((current) => current.filter((value) => value !== id));
        toast.info("Event rejected");
    };

    const approveOrg = async (slug) => {
        await setOrgStatus(slug, "approved");
        setSelectedOrgSlugs((current) => current.filter((value) => value !== slug));
        toast.success("Organisation approved");
    };

    const rejectOrg = async (slug) => {
        await deleteOrg(slug);
        setSelectedOrgSlugs((current) => current.filter((value) => value !== slug));
        toast.info("Organisation rejected");
    };

    const reviewRequest = async (id, status) => {
        await api.reviewOrgEditRequest(id, { status, reviewer_notes: requestNotes[id] || "" });
        setRequests((current) => current.filter((request) => request.id !== id));
        setSelectedRequestIds((current) => current.filter((value) => value !== id));
        await refresh();
        toast.success(status === "approved" ? "Request approved" : "Request rejected");
    };

    const bulkReview = async (kind, status) => {
        const ids = kind === "event" ? selectedEventIds : kind === "org" ? selectedOrgSlugs : selectedRequestIds;
        if (!ids.length) return;
        await Promise.all(ids.map((id) => {
            if (kind === "event") return setEventStatus(id, status);
            if (kind === "org") return status === "approved" ? setOrgStatus(id, status) : deleteOrg(id);
            return api.reviewOrgEditRequest(id, { status });
        }));
        if (kind === "event") setSelectedEventIds([]);
        if (kind === "org") setSelectedOrgSlugs([]);
        if (kind === "request") setSelectedRequestIds([]);
        toast.success(`${status === "approved" ? "Approved" : "Rejected"} ${ids.length} ${kind}${ids.length === 1 ? "" : "s"}`);
        if (kind === "request") {
            setRequests((current) => current.filter((request) => !ids.includes(request.id)));
            await refresh();
        }
    };

    const resetOrgPassword = async (slug, name) => {
        if (!adminCodeSession) {
            toast.error("Admin session code missing. Re-enter admin code from the top-right menu.");
            return;
        }
        const value = window.prompt(`Set a new password for ${name}. Leave blank to reset to default Organisat10n!&`, "");
        if (value === null) return;
        try {
            await api.adminResetOrgPassword(slug, {
                admin_code: adminCodeSession,
                ...(value.trim() ? { password: value.trim() } : {}),
            });
            toast.success(`Password reset for ${name}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Password reset failed");
        }
    };

    const refreshAdminControls = async () => {
        const [attentionData, orphanOrgs, invites, usersData, taxonomyData, auditData, memberInvitesData, orgMembersData] = await Promise.all([
            api.adminEventsAttention().catch(() => ({ counts: {}, attention: {} })),
            api.adminOrgsWithoutAdmins().catch(() => []),
            api.adminOrgClaimInvites("pending").catch(() => []),
            api.adminUsersOverview(userSearch.trim()).catch(() => ({ users: [], pending_invites: 0, pending_claims: 0, pending_member_invites: 0 })),
            api.taxonomy().catch(() => ({ event_categories: [], organisation_categories: [] })),
            api.adminAuditLog(80).catch(() => []),
            api.adminMemberInvites("pending").catch(() => []),
            memberOrgSlug ? api.adminOrgMembers(memberOrgSlug).catch(() => ({ members: [], invites: [] })) : Promise.resolve({ members: [], invites: [] }),
        ]);
        setAttention(attentionData || { counts: {}, attention: {} });
        setOrgsWithoutAdmins(orphanOrgs || []);
        setClaimInvites(invites || []);
        setUserOverview(usersData || { users: [], pending_invites: 0, pending_claims: 0, pending_member_invites: 0 });
        setTaxonomy(taxonomyData || { event_categories: [], organisation_categories: [] });
        setAuditRows(auditData || []);
        setMemberInvites(memberInvitesData || []);
        setMemberRoster(orgMembersData || { members: [], invites: [] });
    };

    const inviteOrgMember = async () => {
        if (!memberOrgSlug) {
            toast.error("Select an organisation first");
            return;
        }
        const email = window.prompt("Member email:")?.trim().toLowerCase();
        if (!email) return;
        const roleValue = (window.prompt("Role (owner/admin/editor/viewer):", "editor") || "editor").trim().toLowerCase();
        const role = ["owner", "admin", "editor", "viewer"].includes(roleValue) ? roleValue : "editor";
        const note = window.prompt("Optional invitation note:", "") || "";
        try {
            await api.adminInviteOrgMember(memberOrgSlug, { email, role, note });
            await refreshAdminControls();
            toast.success(`Invitation sent to ${email}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send member invite");
        }
    };

    const resendMemberInvite = async (inviteId) => {
        try {
            await api.adminResendMemberInvite(inviteId);
            await refreshAdminControls();
            toast.success("Invitation resent");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not resend invite");
        }
    };

    const resetMemberInvite = async (inviteId) => {
        try {
            await api.adminResetMemberInvite(inviteId);
            await refreshAdminControls();
            toast.success("Invitation reset and resent");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not reset invite");
        }
    };

    const changeMemberRole = async (member) => {
        const roleValue = (window.prompt(`Role for ${member.email} (owner/admin/editor/viewer):`, member.role || "editor") || "").trim().toLowerCase();
        if (!roleValue) return;
        const role = ["owner", "admin", "editor", "viewer"].includes(roleValue) ? roleValue : null;
        if (!role) {
            toast.error("Invalid role");
            return;
        }
        try {
            await api.adminSetOrgMemberRole(member.org_slug, member.id, { role });
            await refreshAdminControls();
            toast.success(`Role set to ${role}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not update role");
        }
    };

    const toggleMemberSuspend = async (member) => {
        const suspended = member.status === "active";
        try {
            await api.adminSuspendOrgMember(member.org_slug, member.id, { suspended });
            await refreshAdminControls();
            toast.success(suspended ? "Member suspended" : "Member reactivated");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not update member status");
        }
    };

    const removeMember = async (member) => {
        if (!window.confirm(`Remove ${member.email} from ${member.org_slug}?`)) return;
        try {
            await api.adminRemoveOrgMember(member.org_slug, member.id);
            await refreshAdminControls();
            toast.success("Member removed");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not remove member");
        }
    };

    const runOrgLifecycle = async (slug, action) => {
        try {
            await api.adminOrgLifecycle(slug, { action });
            await refresh();
            await refreshAdminControls();
            toast.success(`Organisation ${action}d`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Action failed");
        }
    };

    const inviteClaim = async (slug, orgName) => {
        const email = window.prompt(`Send claim invitation for ${orgName} to email:`)?.trim().toLowerCase();
        if (!email) return;
        const note = window.prompt("Optional invitation note:", "");
        try {
            await api.adminInviteOrgClaim(slug, { email, note: note || "" });
            await refreshAdminControls();
            toast.success(`Invitation sent to ${email}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send invitation");
        }
    };

    const transferOwnership = async (slug, orgName) => {
        const ownerEmail = window.prompt(`Transfer ownership of ${orgName} to email:`)?.trim().toLowerCase();
        if (!ownerEmail) return;
        try {
            await api.adminTransferOrgOwnership(slug, { owner_email: ownerEmail, add_to_admins: true });
            await refresh();
            await refreshAdminControls();
            toast.success(`Ownership transferred to ${ownerEmail}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Transfer failed");
        }
    };

    const assignAdmins = async (slug, orgName) => {
        const raw = window.prompt(`Assign admin emails for ${orgName} (comma-separated):`, "");
        if (raw === null) return;
        const emails = raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
        if (!emails.length) return;
        try {
            await api.adminAssignOrgAdmins(slug, { admin_emails: emails });
            await refresh();
            await refreshAdminControls();
            toast.success(`Assigned ${emails.length} admin email(s)`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not assign admins");
        }
    };

    const mergeDuplicateOrgs = async () => {
        const duplicate = window.prompt("Duplicate organisation slug to merge from:")?.trim();
        if (!duplicate) return;
        const primary = window.prompt("Primary organisation slug to merge into:")?.trim();
        if (!primary) return;
        if (duplicate === primary) {
            toast.error("Primary and duplicate slugs must be different");
            return;
        }
        try {
            await api.adminMergeOrgs({ primary_slug: primary, duplicate_slug: duplicate, archive_duplicate: true });
            await refresh();
            await refreshAdminControls();
            toast.success(`Merged ${duplicate} into ${primary}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Merge failed");
        }
    };

    const saveTaxonomy = async () => {
        setTaxonomyBusy(true);
        try {
            const event_categories = (taxonomy.event_categories || []).map((v) => v.trim()).filter(Boolean);
            const organisation_categories = (taxonomy.organisation_categories || []).map((v) => v.trim()).filter(Boolean);
            await api.updateTaxonomy({ event_categories, organisation_categories });
            await refreshAdminControls();
            toast.success("Taxonomy updated");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not update taxonomy");
        } finally {
            setTaxonomyBusy(false);
        }
    };

    return (
        <div data-testid="admin-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between gap-3 mb-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                        Admin · {role === "guest" ? "Demo mode" : role}
                    </span>
                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                        Admin dashboard
                    </h1>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <Link
                        to="/admin/impact"
                        data-testid="nav-impact-dashboard"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs"
                    >
                        <BarChart3 className="h-3.5 w-3.5" /> Impact dashboard
                    </Link>
                    <Link
                        to="/admin/flyers"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border font-semibold text-xs"
                    >
                        Flyers
                    </Link>
                    <Link
                        to="/admin/events"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border font-semibold text-xs"
                    >
                        Event manager
                    </Link>
                    <Link to="/" className="inline-flex px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                        View site
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="Total events" value={events.length} icon={CalendarDays} tone="primary" />
                <Stat label="Pending events" value={pendingEvents.length} icon={Inbox} />
                <Stat label="Total orgs" value={orgs.length} icon={Building2} />
                <Stat label="Pending orgs" value={pendingOrgs.length} icon={Inbox} />
                <Stat label="Edit requests" value={stats?.org_edit_requests_pending || 0} icon={Sparkles} />
                <Stat label="Unread messages" value={stats?.messages_unread || 0} icon={MessageSquare} />
            </div>

            <section className="mt-8 space-y-4" data-testid="site-admin-controls">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="font-display font-black text-2xl inline-flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-primary" /> Site Administrator
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Ownership, verification, moderation and quality controls.
                        </p>
                    </div>
                    <button onClick={mergeDuplicateOrgs} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold">
                        <Link2 className="h-3.5 w-3.5" /> Merge duplicates
                    </button>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="font-display font-bold text-lg">Organisation management</h3>
                            <span className="text-xs text-muted-foreground">Without admins: {orgsWithoutAdmins.length}</span>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {orgs.slice(0, 24).map((o) => (
                                <div key={o.slug} className="rounded-2xl border border-border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-semibold text-sm">{o.name}</div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">{o.slug} · {o.status || "approved"}{o.verified ? " · verified" : ""}</div>
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap justify-end">
                                            <button onClick={() => runOrgLifecycle(o.slug, "verify")} className="px-2 py-1 rounded-full bg-muted text-[11px] font-semibold">Verify</button>
                                            <button onClick={() => runOrgLifecycle(o.slug, "suspend")} className="px-2 py-1 rounded-full bg-muted text-[11px] font-semibold inline-flex items-center gap-1"><PauseCircle className="h-3 w-3" />Suspend</button>
                                            <button onClick={() => runOrgLifecycle(o.slug, "archive")} className="px-2 py-1 rounded-full bg-muted text-[11px] font-semibold inline-flex items-center gap-1"><Archive className="h-3 w-3" />Archive</button>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        <button onClick={() => assignAdmins(o.slug, o.name)} className="px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold inline-flex items-center gap-1"><UserPlus className="h-3 w-3" />Assign admins</button>
                                        <button onClick={() => transferOwnership(o.slug, o.name)} className="px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold">Transfer ownership</button>
                                        <button onClick={() => inviteClaim(o.slug, o.name)} className="px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold">Invite claim</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="font-display font-bold text-lg">Events needing attention</h3>
                            <Link to="/admin/events" className="text-xs font-semibold text-primary">Open event manager</Link>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <MiniMetric label="Missing venue" value={attention?.attention?.missing_venue || 0} />
                            <MiniMetric label="Missing time" value={attention?.attention?.missing_time || 0} />
                            <MiniMetric label="Missing image" value={attention?.attention?.missing_image || 0} />
                            <MiniMetric label="Possible duplicate" value={attention?.attention?.possible_duplicate || 0} />
                            <MiniMetric label="Past but published" value={attention?.attention?.date_passed_but_published || 0} />
                            <MiniMetric label="Pending" value={attention?.counts?.pending || 0} />
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">User management</h3>
                        <div className="mt-3 relative">
                            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search email or organisation" className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                            Pending org invites: {userOverview.pending_invites || 0} · Pending claims: {userOverview.pending_claims || 0} · Pending member invites: {userOverview.pending_member_invites || 0}
                        </div>
                        <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                            {(userOverview.users || []).slice(0, 12).map((u) => (
                                <div key={u.email} className="rounded-2xl border border-border p-2.5">
                                    <div className="text-sm font-semibold truncate">{u.email}</div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">Roles: {(u.roles || []).join(", ") || "none"}</div>
                                    <div className="text-[11px] text-muted-foreground">Orgs: {(u.organisations || []).map((o) => o.name).slice(0, 2).join(", ") || "none"}</div>
                                    <div className="text-[11px] text-muted-foreground">Status: {u.status || "active"}{u.pending_invitations ? ` · pending invites: ${u.pending_invitations}` : ""}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="font-display font-bold text-lg">Org member access</h3>
                            <button onClick={inviteOrgMember} className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">Invite member</button>
                        </div>
                        <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Organisation</label>
                        <select value={memberOrgSlug} onChange={(e) => setMemberOrgSlug(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                            <option value="">Select organisation</option>
                            {orgs
                                .filter((o) => o.status !== "rejected")
                                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                                .map((o) => (
                                    <option key={o.slug} value={o.slug}>{o.name}</option>
                                ))}
                        </select>
                        <div className="mt-3 text-xs text-muted-foreground">Global pending member invites: {memberInvites.length}</div>
                        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {(memberRoster.members || []).slice(0, 8).map((m) => (
                                <div key={m.id} className="rounded-2xl border border-border p-2.5">
                                    <div className="text-sm font-semibold truncate">{m.email}</div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">{m.role || "editor"} · {m.status || "active"}</div>
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        <button onClick={() => changeMemberRole(m)} className="px-2 py-1 rounded-full border border-border text-[11px] font-semibold">Role</button>
                                        <button onClick={() => toggleMemberSuspend(m)} className="px-2 py-1 rounded-full border border-border text-[11px] font-semibold">{m.status === "active" ? "Suspend" : "Activate"}</button>
                                        <button onClick={() => removeMember(m)} className="px-2 py-1 rounded-full border border-border text-[11px] font-semibold">Remove</button>
                                    </div>
                                </div>
                            ))}
                            {(memberRoster.members || []).length === 0 && (
                                <p className="text-sm text-muted-foreground">No members for this organisation yet.</p>
                            )}
                        </div>
                        <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                            {(memberRoster.invites || []).filter((i) => i.status === "pending").slice(0, 6).map((inv) => (
                                <div key={inv.id} className="rounded-2xl border border-border p-2.5">
                                    <div className="text-xs font-semibold truncate">{inv.email}</div>
                                    <div className="text-[11px] text-muted-foreground">{inv.role || "editor"} · pending</div>
                                    <div className="mt-2 flex gap-1.5">
                                        <button onClick={() => resendMemberInvite(inv.id)} className="px-2 py-1 rounded-full border border-border text-[11px] font-semibold">Resend</button>
                                        <button onClick={() => resetMemberInvite(inv.id)} className="px-2 py-1 rounded-full border border-border text-[11px] font-semibold">Reset token</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Category taxonomy</h3>
                        <p className="text-xs text-muted-foreground mt-1">Central lists for consistent filtering.</p>
                        <label className="block mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event categories (one per line)</label>
                        <textarea
                            rows={6}
                            value={(taxonomy.event_categories || []).join("\n")}
                            onChange={(e) => setTaxonomy((t) => ({ ...t, event_categories: e.target.value.split("\n") }))}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-xs"
                        />
                        <label className="block mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation categories (one per line)</label>
                        <textarea
                            rows={5}
                            value={(taxonomy.organisation_categories || []).join("\n")}
                            onChange={(e) => setTaxonomy((t) => ({ ...t, organisation_categories: e.target.value.split("\n") }))}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background text-xs"
                        />
                        <button onClick={saveTaxonomy} disabled={taxonomyBusy} className="mt-3 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60">
                            {taxonomyBusy ? "Saving…" : "Save taxonomy"}
                        </button>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Audit history</h3>
                        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                            {auditRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No audit actions yet.</p>
                            ) : auditRows.slice(0, 20).map((row) => (
                                <div key={row.id} className="rounded-2xl border border-border p-2.5">
                                    <div className="text-sm font-semibold">{row.summary || row.action}</div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(row.created_at).toLocaleString("en-GB")} · {row.actor || "admin"}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">Claim invites pending: {claimInvites.length}</div>
                    </div>
                </div>
            </section>

            <section className="mt-8 space-y-4" data-testid="admin-analytics-section">
                <div>
                    <h2 className="font-display font-black text-2xl">Success metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Reach, engagement and content health for the last {analytics.window_days || 30} days.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Event views" value={siteEngagement.event_views_30d || 0} icon={Eye} tone="primary" />
                    <Stat label="Org views" value={siteEngagement.org_views_30d || 0} icon={BarChart3} />
                    <Stat label="Share clicks" value={siteEngagement.share_clicks_30d || 0} icon={RefreshCw} />
                    <Stat label="Follower links" value={siteOverview.org_follow_links || 0} icon={Users} />
                    <Stat label="Digest subs" value={siteOverview.digest_subscribers || 0} icon={Mail} />
                    <Stat label="Active orgs" value={siteOverview.orgs_with_upcoming_events || 0} icon={HandHeart} />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Health snapshot</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <MiniMetric label="Upcoming events" value={siteOverview.upcoming_events || 0} />
                            <MiniMetric label="Approved orgs" value={siteOverview.approved_orgs || 0} />
                            <MiniMetric label="Avg event views" value={siteHealth.avg_event_views_30d || 0} />
                            <MiniMetric label="Share rate" value={`${Math.round((siteHealth.share_click_rate || 0) * 100)}%`} />
                            <MiniMetric label="Orgs with upcoming" value={`${Math.round((siteHealth.orgs_with_upcoming_rate || 0) * 100)}%`} />
                            <MiniMetric label="Pending content" value={`${Math.round((siteHealth.pending_content_ratio || 0) * 100)}%`} />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Top organisations</h3>
                        {topOrgs.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">No engagement data yet.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topOrgs.map((orgItem) => (
                                    <div key={orgItem.slug} className="flex items-start justify-between gap-3 text-sm">
                                        <div>
                                            <Link to={`/organisations/${orgItem.slug}`} className="font-semibold hover:text-primary">{orgItem.name}</Link>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {orgItem.page_views} profile views · {orgItem.event_views} event views · {orgItem.share_clicks} shares
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <div>{orgItem.followers} followers</div>
                                            <div>{orgItem.upcoming_events} upcoming</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                        <h3 className="font-display font-bold text-lg">Top events</h3>
                        {topEvents.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">No event engagement data yet.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {topEvents.map((eventItem) => (
                                    <div key={eventItem.id} className="flex items-start justify-between gap-3 text-sm">
                                        <div>
                                            <Link to={`/events/${eventItem.id}`} className="font-semibold hover:text-primary">{eventItem.title}</Link>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {eventItem.views} views · {eventItem.shares} shares
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">{eventItem.org_slug}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-5">
                    <h3 className="font-display font-bold text-lg">Share channels</h3>
                    {sharePlatforms.length === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">Share data will appear once residents or admins use the share buttons.</p>
                    ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {sharePlatforms.map((item) => (
                                <span key={item.platform} className="px-3 py-2 rounded-full bg-muted text-sm">
                                    {item.platform} · {item.count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="mt-8">
                <SiteModeCard />
            </section>

            <section className="mt-8">
                <QuickAddContentCard orgs={orgs} onCreated={refresh} />
            </section>

            <section className="mt-8 rounded-[2rem] border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div>
                        <h2 className="font-display font-black text-2xl">Triage queue</h2>
                        <p className="text-sm text-muted-foreground mt-1">Search, filter, bulk-approve and use `a` / `r` on the focused item.</p>
                    </div>
                    <div className="grid sm:grid-cols-[1fr_220px] gap-3 w-full lg:w-auto">
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search queue…" className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm" />
                        <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm">
                            <option value="all">All items</option>
                            <option value="events">Events</option>
                            <option value="orgs">Organisations</option>
                            <option value="claims">Claim requests</option>
                            <option value="requests">Edit requests</option>
                            <option value="duplicates">Duplicates only</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="px-2.5 py-1 rounded-full bg-muted">Keyboard: `a` approve, `r` reject</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted">Saved filter: {queueFilter}</span>
                    <span className="px-2.5 py-1 rounded-full bg-muted">Search saved locally</span>
                </div>
            </section>

            <section className="mt-10" data-testid="admin-bulk-import-section">
                <BulkDocumentImportCard orgs={orgs} />
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <BroadcastCard onSent={refresh} />
                <NewsletterCard orgs={orgs} />
            </section>

            <section className="mt-10">
                <AdminEmailCentre orgs={orgs} onChange={refresh} />
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <ScheduledBroadcastsCard />
                <ModerationQueueCard />
            </section>

            <section className="mt-10 grid lg:grid-cols-2 gap-4">
                <NotifyOrgCard orgs={orgs} />
                <SubscribersCard />
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Pending events <span className="text-muted-foreground text-base">({visiblePendingEvents.length})</span></h2>
                    {selectedEventIds.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("event", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("event", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visiblePendingEvents.length === 0 ? (
                    <Empty>No events waiting for approval.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {visiblePendingEvents.map((e) => {
                            const duplicate = approvedEvents.find((approved) => normalize(approved.title) === normalize(e.title) && (approved.start || "").slice(0, 10) === (e.start || "").slice(0, 10));
                            const selected = selectedEventIds.includes(e.id);
                            return (
                                <div key={e.id} data-testid={`admin-event-${e.id}`} onClick={() => setActiveTarget({ kind: "event", id: e.id })}
                                    className={`rounded-3xl border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <label className="flex items-center gap-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <input type="checkbox" checked={selected} onChange={(ev) => {
                                            ev.stopPropagation();
                                            setSelectedEventIds((current) => current.includes(e.id) ? current.filter((value) => value !== e.id) : [...current, e.id]);
                                        }} />
                                        Select
                                    </label>
                                    <div className="flex-1">
                                        <CategoryBadge category={e.category} />
                                        <h3 className="font-display font-bold text-lg mt-2">{e.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">{formatDate(e.start)} · {formatTime(e.start)} · {e.venue || "No venue yet"}</p>
                                        {duplicate && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Possible duplicate: {duplicate.title}</p>}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <Link to={`/edit-event/${e.id}`} data-testid={`admin-edit-event-${e.id}`} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-border font-semibold text-xs hover:bg-muted" onClick={(ev) => ev.stopPropagation()}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Link>
                                        <button data-testid={`approve-event-${e.id}`} onClick={(ev) => { ev.stopPropagation(); approveEvent(e.id); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs">
                                            <Check className="h-3.5 w-3.5" /> Approve
                                        </button>
                                        <button data-testid={`reject-event-${e.id}`} onClick={(ev) => { ev.stopPropagation(); rejectEvent(e.id); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                                            <X className="h-3.5 w-3.5" /> Reject
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">
                        Manage events{" "}
                        <span className="text-muted-foreground text-base font-normal">
                            ({approvedEvents.length})
                        </span>
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            data-testid="admin-events-search"
                            type="search"
                            value={eventSearch}
                            onChange={(e) => setEventSearch(e.target.value)}
                            placeholder="Search title, venue, description…"
                            className="px-3 py-2 rounded-full border border-border bg-background text-sm w-56"
                        />
                        <select
                            data-testid="admin-events-org-filter"
                            value={eventOrgFilter}
                            onChange={(e) => setEventOrgFilter(e.target.value)}
                            className="px-3 py-2 rounded-full border border-border bg-background text-sm"
                        >
                            <option value="">All organisations</option>
                            {orgs
                                .filter((o) => o.status !== "rejected")
                                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                                .map((o) => (
                                    <option key={o.slug} value={o.slug}>{o.name}</option>
                                ))}
                        </select>
                        <select
                            data-testid="admin-events-category-filter"
                            value={eventCategoryFilter}
                            onChange={(e) => setEventCategoryFilter(e.target.value)}
                            className="px-3 py-2 rounded-full border border-border bg-background text-sm"
                        >
                            <option value="">All categories</option>
                            {[...new Set(approvedEvents.map((e) => e.category).filter(Boolean))]
                                .sort()
                                .map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                        </select>
                        {(eventSearch || eventOrgFilter || eventCategoryFilter) && (
                            <button
                                type="button"
                                data-testid="admin-events-clear-filters"
                                onClick={() => { setEventSearch(""); setEventOrgFilter(""); setEventCategoryFilter(""); }}
                                className="text-xs uppercase tracking-wider font-bold text-primary hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <div className="rounded-3xl border border-border bg-surface overflow-hidden">
                    <div className="max-h-[65vh] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-4 py-3">Event</th>
                                    <th className="text-left px-4 py-3 hidden sm:table-cell">Date</th>
                                    <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredApprovedEvents.map((e) => (
                                    <tr key={e.id} className="border-t border-border" data-testid={`admin-manage-event-row-${e.id}`}>
                                        <td className="px-4 py-3 font-medium">
                                            <Link to={`/events/${e.id}`} className="hover:text-primary">{e.title}</Link>
                                            {e.recurrence && ((e.recurrence.freq && e.recurrence.freq !== "none") || e.recurrence.extra_dates?.length > 0) && (
                                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground text-[9px] font-black uppercase tracking-wider">
                                                    {e.recurrence.freq === "monthly_weekday"
                                                        ? "Repeats monthly (same weekday)"
                                                        : e.recurrence.freq && e.recurrence.freq !== "none"
                                                            ? `Repeats ${e.recurrence.interval > 1 ? `every ${e.recurrence.interval} ` : ""}${e.recurrence.freq}`
                                                            : `+${e.recurrence.extra_dates.length} extra date${e.recurrence.extra_dates.length > 1 ? "s" : ""}`}
                                                </span>
                                            )}
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {orgs.find((o) => o.slug === e.orgSlug)?.name || e.orgSlug}
                                            </div>
                                            <div className="mt-1.5">
                                                <EntityCheck kind="event" id={e.id} initial={e.check_result} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(e.start)}</td>
                                        <td className="px-4 py-3 hidden md:table-cell"><CategoryBadge category={e.category} /></td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 justify-end">
                                                <Link to={`/edit-event/${e.id}`} data-testid={`admin-edit-approved-${e.id}`} className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground" title="Edit event"><Pencil className="h-3.5 w-3.5" /></Link>
                                                <button data-testid={`feature-event-${e.id}`} onClick={async () => { await toggleEventFeatured(e.id); toast.success(e.featured ? "Unfeatured" : "Featured"); }} className={`h-8 w-8 grid place-items-center rounded-full ${e.featured ? "bg-secondary text-secondary-foreground" : "bg-muted"}`} title={e.featured ? "Unfeature" : "Feature on homepage"}><Star className="h-3.5 w-3.5" /></button>
                                                <button data-testid={`delete-event-${e.id}`} onClick={async () => { await deleteEvent(e.id); toast.info("Event deleted"); }} className="h-8 w-8 grid place-items-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredApprovedEvents.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                            {approvedEvents.length === 0 ? "No approved events yet." : "No events match your filters."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Pending organisations <span className="text-muted-foreground text-base">({visiblePendingOrgs.length})</span></h2>
                    {selectedOrgSlugs.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("org", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("org", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visiblePendingOrgs.length === 0 ? (
                    <Empty>No organisations waiting for approval.</Empty>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {visiblePendingOrgs.map((o) => {
                            const duplicate = pendingOrgDuplicates.get(normalize(o.name));
                            const selected = selectedOrgSlugs.includes(o.slug);
                            return (
                                <div key={o.slug} data-testid={`admin-org-${o.slug}`} onClick={() => setActiveTarget({ kind: "org", id: o.slug })} className={`rounded-3xl border bg-surface p-5 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <input type="checkbox" checked={selected} onChange={(ev) => {
                                            ev.stopPropagation();
                                            setSelectedOrgSlugs((current) => current.includes(o.slug) ? current.filter((value) => value !== o.slug) : [...current, o.slug]);
                                        }} />
                                        Select
                                    </label>
                                    <h3 className="font-display font-bold mt-2">{o.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{o.category}</p>
                                    <p className="text-sm mt-2 line-clamp-2">{o.short}</p>
                                    {duplicate && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Possible duplicate: {duplicate.name}</p>}
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        <button data-testid={`approve-org-${o.slug}`} onClick={(ev) => { ev.stopPropagation(); approveOrg(o.slug); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"><Check className="h-3.5 w-3.5" /> Approve</button>
                                        <button data-testid={`reject-org-${o.slug}`} onClick={(ev) => { ev.stopPropagation(); rejectOrg(o.slug); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"><X className="h-3.5 w-3.5" /> Reject</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="font-display font-bold text-xl">Claim and edit requests <span className="text-muted-foreground text-base">({visibleRequests.length})</span></h2>
                    {selectedRequestIds.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={() => bulkReview("request", "approved")} className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">Approve selected</button>
                            <button onClick={() => bulkReview("request", "rejected")} className="px-4 py-2 rounded-full border border-foreground text-xs font-semibold">Reject selected</button>
                        </div>
                    )}
                </div>
                {visibleRequests.length === 0 ? (
                    <Empty>No claim or edit requests waiting.</Empty>
                ) : (
                    <div className="grid gap-3">
                        {visibleRequests.map((request) => {
                            const selected = selectedRequestIds.includes(request.id);
                            return (
                                <div key={request.id} onClick={() => setActiveTarget({ kind: "request", id: request.id })} className={`rounded-3xl border bg-surface p-5 ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <input type="checkbox" checked={selected} onChange={(ev) => {
                                                ev.stopPropagation();
                                                setSelectedRequestIds((current) => current.includes(request.id) ? current.filter((value) => value !== request.id) : [...current, request.id]);
                                            }} />
                                            Select
                                        </label>
                                        <span className="px-2.5 py-1 rounded-full bg-muted text-[11px] font-bold uppercase tracking-wider">{request.request_type === "claim" ? "Claim" : "Suggest edit"}</span>
                                    </div>
                                    <h3 className="font-display font-bold text-lg mt-2">{request.org_name}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{request.contact_name} {request.contact_email ? `· ${request.contact_email}` : ""}{request.contact_phone ? ` · 📞 ${request.contact_phone}` : ""}</p>
                                    {request.message && <p className="text-sm mt-3">{request.message}</p>}
                                    {request.request_type === "claim" && (
                                        <textarea
                                            rows={2}
                                            value={requestNotes[request.id] || ""}
                                            onChange={(ev) => { ev.stopPropagation(); setRequestNotes((n) => ({ ...n, [request.id]: ev.target.value })); }}
                                            onClick={(ev) => ev.stopPropagation()}
                                            placeholder="Reviewer notes (optional) — included in approval/rejection email"
                                            className="w-full mt-3 px-3 py-2 rounded-2xl border border-border bg-background text-sm resize-none"
                                        />
                                    )}
                                    {request.request_type === "suggest_edit" && Object.keys(request.payload || {}).length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                            {Object.entries(request.payload).slice(0, 6).map(([key, value]) => (
                                                <span key={key} className="px-2.5 py-1 rounded-full bg-muted">{key}: {typeof value === "string" ? value : "updated"}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        <button onClick={(ev) => { ev.stopPropagation(); reviewRequest(request.id, "approved"); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs"><Check className="h-3.5 w-3.5" /> Approve</button>
                                        <button onClick={(ev) => { ev.stopPropagation(); reviewRequest(request.id, "rejected"); }} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs"><X className="h-3.5 w-3.5" /> Reject</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="mt-10">
                <h2 className="font-display font-bold text-xl mb-3">Manage organisations</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {orgs.filter((o) => o.status !== "pending").map((o) => (
                        <div key={o.slug} className="min-w-0 rounded-3xl border border-border bg-surface p-4" data-testid={`manage-org-card-${o.slug}`}>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center text-xl shrink-0">{o.logo}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm leading-snug" data-testid={`manage-org-name-${o.slug}`}>{o.name}</div>
                                    <div className="text-xs text-muted-foreground">{o.category}</div>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 flex-wrap">
                                <button
                                    data-testid={`impersonate-org-${o.slug}`}
                                    onClick={() => loginAsOrg(o.slug, o.name)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wider"
                                    title={`Log in as ${o.name}`}
                                >
                                    <LogIn className="h-3 w-3" /> Log in as
                                </button>
                                <button
                                    onClick={() => resetOrgPassword(o.slug, o.name)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-semibold uppercase tracking-wider"
                                    title="Reset organisation password"
                                >
                                    <RefreshCw className="h-3 w-3" /> Reset pwd
                                </button>
                                <Link to={`/edit-organisation/${o.slug}`} data-testid={`edit-org-${o.slug}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-semibold uppercase tracking-wider"><Edit3 className="h-3 w-3" /> Edit</Link>
                            </div>
                            <div className="mt-2">
                                <EntityCheck kind="org" id={o.slug} initial={o.check_result} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

const CHECK_STYLES = {
    looks_accurate: { label: "Looks accurate", cls: "bg-green-100 text-green-800" },
    needs_attention: { label: "Needs attention", cls: "bg-amber-100 text-amber-800" },
    likely_outdated: { label: "Likely outdated", cls: "bg-red-100 text-red-700" },
    could_not_verify: { label: "Could not verify", cls: "bg-muted text-muted-foreground" },
};

const EntityCheck = ({ kind, id, initial }) => {
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(initial || null);
    const [open, setOpen] = useState(false);

    const run = async () => {
        setChecking(true);
        try {
            const res = await api.adminCheckEntity(kind, id);
            setResult(res);
            setOpen(true);
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Check failed — please try again");
        } finally {
            setChecking(false);
        }
    };

    const style = result ? CHECK_STYLES[result.verdict] || CHECK_STYLES.could_not_verify : null;
    return (
        <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
                <button
                    onClick={run}
                    disabled={checking}
                    data-testid={`check-${kind}-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-[10px] font-bold uppercase tracking-wider hover:bg-muted disabled:opacity-60"
                    title="Search the web to verify this listing is accurate and still running"
                >
                    {checking ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                    {checking ? "Checking…" : result ? "Re-check" : "Check"}
                </button>
                {result && style && (
                    <button onClick={() => setOpen((o) => !o)} data-testid={`check-verdict-${kind}-${id}`}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${style.cls}`}
                        title={`Checked ${result.checked_at ? new Date(result.checked_at).toLocaleString("en-GB") : ""} — click for details`}>
                        {style.label}
                    </button>
                )}
            </div>
            {result && open && (
                <div className="mt-2 rounded-xl border border-border bg-background p-3 text-xs space-y-2" data-testid={`check-details-${kind}-${id}`}>
                    <p>{result.summary}</p>
                    {result.issues?.length > 0 && (
                        <ul className="list-disc pl-4 text-amber-700 space-y-0.5">
                            {result.issues.map((i, n) => <li key={n}>{i}</li>)}
                        </ul>
                    )}
                    {result.sources?.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {result.sources.map((s, n) => (
                                <a key={n} href={s.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 truncate max-w-[240px]">
                                    {s.title || s.url}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const Empty = ({ children }) => (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {children}
    </div>
);

const MiniMetric = ({ label, value }) => (
    <div className="rounded-2xl bg-muted/50 px-3 py-3">
        <div className="text-lg font-display font-bold">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
);

const ACTION_LABELS = {
    new_event: "New event",
    update_event: "Update event",
    new_volunteer: "New volunteering",
    update_volunteer: "Update volunteering",
    new_organisation: "New organisation",
    update_organisation: "Update organisation",
    new_venue: "New venue",
    update_venue: "Update venue",
    unclear: "Needs review",
};

const DESTINATION_LABELS = {
    events: "Events",
    organisations: "Organisations",
    local_feed: "Local feed",
    volunteering: "Volunteering",
    venues: "Venues",
};

const inp = "w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm";
const LOW_CONFIDENCE_THRESHOLD = 0.75;

const BULK_PARSE_JOB_STORAGE_KEY = "rn-admin-active-parse-job";
const BULK_PARSE_POLL_INTERVAL_MS = 2500;
const BULK_PARSE_MAX_RECONNECT_DELAY_MS = 15000;

const readStoredParseJob = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(BULK_PARSE_JOB_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.job_id ? parsed : null;
    } catch {
        return null;
    }
};

const writeStoredParseJob = (job) => {
    if (typeof window === "undefined" || !job?.job_id) return;
    try {
        localStorage.setItem(BULK_PARSE_JOB_STORAGE_KEY, JSON.stringify(job));
    } catch {
        // Local storage is a convenience for resume/reconnect. The backend
        // job continues even if the browser refuses local storage.
    }
};

const clearStoredParseJob = () => {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(BULK_PARSE_JOB_STORAGE_KEY);
    } catch {
        // Non-blocking.
    }
};

const parserErrorStatus = (error) =>
    error?.originalError?.response?.status ||
    error?.response?.status ||
    0;

const parserErrorMessage = (error) =>
    error?.response?.data?.detail ||
    error?.originalError?.response?.data?.detail ||
    error?.message ||
    "Could not contact the parser";


const Field = ({ label, children }) => (
    <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="mt-1">{children}</div>
    </label>
);

function BulkDocumentImportCard({ orgs }) {
    const { refresh } = useApp();
    const pollGenerationRef = useRef(0);
    const mountedRef = useRef(false);
    const [files, setFiles] = useState([]);
    const [linkSources, setLinkSources] = useState("");
    const [textSources, setTextSources] = useState("");
    const [sourceOrgSlug, setSourceOrgSlug] = useState("");
    const [busy, setBusy] = useState(false);
    const [parseProgress, setParseProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [reviewDocs, setReviewDocs] = useState([]);
    const [confirmPost, setConfirmPost] = useState(null);
    const [selectedReviewIds, setSelectedReviewIds] = useState([]);
    const [batchReport, setBatchReport] = useState(null);
    const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
    const [reviewOwnerFilter, setReviewOwnerFilter] = useState("all");
    const [activeJobId, setActiveJobId] = useState(() => readStoredParseJob()?.job_id || "");
    const [connectionState, setConnectionState] = useState("idle");
    const [lastPollError, setLastPollError] = useState("");
    const REVIEWER_NAME = "Admin";

    const isUpdateAction = (action) => ["update_event", "update_volunteer", "update_organisation", "update_venue"].includes(action);

    const inferDestination = (draft) => {
        const manual = (draft.publish_target || "").toLowerCase();
        if (["events", "organisations", "local_feed", "volunteering", "venues"].includes(manual)) {
            return manual;
        }

        const isVolunteerAction = ["new_volunteer", "update_volunteer"].includes(draft.action) || draft.suggested_type === "volunteer";
        const isOrgAction = ["new_organisation", "update_organisation"].includes(draft.action) || draft.suggested_type === "organisation";
        const isVenueAction = ["new_venue", "update_venue"].includes(draft.action) || draft.suggested_type === "venue";
        const isEventAction = ["new_event", "update_event"].includes(draft.action) || (!isVolunteerAction && !isOrgAction && draft.suggested_type === "event");
        if (isEventAction) return "events";
        if (isOrgAction) return "organisations";
        if (isVolunteerAction) return "volunteering";
        if (isVenueAction) return "venues";

        const title = (draft.title || "").toLowerCase();
        const description = (draft.description || "").toLowerCase();
        const merged = `${title} ${description}`;
        const looksLikePublicUpdate = /\b(consultation|survey|consult|announcement|update|notice|news|community update|public meeting)\b/.test(merged);
        const looksLikeVenue = /\b(venue|hall|community centre|community center|sports centre|sports center|facility|facilities|room hire|booking)\b/.test(merged);

        if (looksLikeVenue) {
            return "venues";
        }

        if (draft.suggested_type === "update" && (!draft.matched_org_slug || looksLikePublicUpdate)) {
            return "local_feed";
        }
        if (looksLikePublicUpdate && !draft.date) {
            return "local_feed";
        }
        return "organisations";
    };

    const destinationLabel = (draft) => DESTINATION_LABELS[inferDestination(draft)] || DESTINATION_LABELS.organisations;

    const detectFeedType = (draft) => {
        const text = `${draft.title || ""} ${draft.description || ""}`.toLowerCase();
        if (/\b(news|press release|breaking)\b/.test(text)) return "news";
        if (/\b(consultation|survey|deadline|important|alert|warning|notice|road closure)\b/.test(text)) return "announcement";
        return "update";
    };

    const extractFirstUrl = (draft, doc) => {
        const text = [
            draft.description || "",
            draft.title || "",
            doc?.text_excerpt || "",
            ...(doc?.warnings || []),
        ].join("\n");
        const qrMatch = text.match(/QR\s*code\s*link:\s*(https?:\/\/[^\s)]+)/i);
        if (qrMatch?.[1]) return qrMatch[1].replace(/[.,;!?]+$/, "");
        const m = text.match(/https?:\/\/[^\s)]+/i);
        return m ? m[0].replace(/[.,;!?]+$/, "") : "";
    };

    const normalizeDocs = (documents) =>
        (Array.isArray(documents) ? documents : []).map((doc, docIndex) => ({
            ...doc,
            filename: doc?.filename || `Source ${docIndex + 1}`,
            source_type: doc?.source_type || "unknown",
            text_excerpt: doc?.text_excerpt || "",
            warnings: Array.isArray(doc?.warnings) ? doc.warnings : [],
            items: (Array.isArray(doc?.items) ? doc.items : []).map((item, itemIndex) => ({
                ...item,
                reviewId: `${docIndex}-${itemIndex}`,
                isEditing: false,
                draft: {
                    ...item,
                    review_status: item.review_status || "open",
                    review_owner: item.review_owner || "",
                },
            })),
        }));

    const setItemMeta = (reviewId, patch) => {
        setReviewDocs((current) =>
            current.map((doc) => ({
                ...doc,
                items: doc.items.map((item) =>
                    item.reviewId === reviewId
                        ? { ...item, draft: { ...(item.draft || item), ...patch } }
                        : item,
                ),
            })),
        );
    };

    const bulkPatchSelected = (patch) => {
        if (!selectedReviewIds.length) return;
        selectedReviewIds.forEach((id) => setItemMeta(id, patch));
        toast.success(`Updated ${selectedReviewIds.length} selected item${selectedReviewIds.length === 1 ? "" : "s"}`);
    };

    const visibleReviewDocs = reviewDocs
        .map((doc) => ({
            ...doc,
            items: (doc.items || []).filter((item) => {
                const draft = item.draft || item;
                const status = draft.review_status || "open";
                const owner = draft.review_owner || "";
                const statusOk = reviewStatusFilter === "all" || status === reviewStatusFilter;
                const ownerOk = reviewOwnerFilter === "all"
                    || (reviewOwnerFilter === "assigned" && Boolean(owner))
                    || (reviewOwnerFilter === "unassigned" && !owner)
                    || (reviewOwnerFilter === "mine" && owner === REVIEWER_NAME);
                return statusOk && ownerOk;
            }),
        }))
        .filter((doc) => doc.items.length > 0);

    const updateItem = (filename, reviewId, patch) => {
        setReviewDocs((current) =>
            current.map((doc) => {
                if (doc.filename !== filename) return doc;
                return {
                    ...doc,
                    items: doc.items.map((item) =>
                        item.reviewId === reviewId
                            ? { ...item, draft: { ...item.draft, ...patch } }
                            : item,
                    ),
                };
            }),
        );
    };

    const toggleSelectedItem = (reviewId) => {
        setSelectedReviewIds((current) =>
            current.includes(reviewId)
                ? current.filter((id) => id !== reviewId)
                : [...current, reviewId],
        );
    };

    const toggleEdit = (filename, reviewId) => {
        setReviewDocs((current) =>
            current.map((doc) => {
                if (doc.filename !== filename) return doc;
                return {
                    ...doc,
                    items: doc.items.map((item) =>
                        item.reviewId === reviewId
                            ? { ...item, isEditing: !item.isEditing }
                            : item,
                    ),
                };
            }),
        );
    };

    const removeItemFromDocs = (docs, filename, reviewId) =>
        docs
            .map((doc) =>
                doc.filename !== filename
                    ? doc
                    : { ...doc, items: doc.items.filter((item) => item.reviewId !== reviewId) },
            )
            .filter((doc) => doc.items.length > 0);

    const deleteItem = (filename, reviewId) => {
        setReviewDocs((current) => removeItemFromDocs(current, filename, reviewId));
        setSelectedReviewIds((current) => current.filter((id) => id !== reviewId));
    };

    const deleteItemWithUndo = (doc, item) => {
        const snapshot = {
            filename: doc.filename,
            source_type: doc.source_type,
            text_excerpt: doc.text_excerpt,
            warnings: doc.warnings,
            item,
            index: doc.items.findIndex((it) => it.reviewId === item.reviewId),
        };
        deleteItem(doc.filename, item.reviewId);
        toast("Item removed from review", {
            action: {
                label: "Undo",
                onClick: () => {
                    setReviewDocs((current) => {
                        const existing = current.find((d) => d.filename === snapshot.filename);
                        if (existing) {
                            return current.map((d) => {
                                if (d.filename !== snapshot.filename) return d;
                                if (d.items.some((it) => it.reviewId === snapshot.item.reviewId)) return d;
                                const items = [...d.items];
                                const idx = Math.max(0, Math.min(snapshot.index, items.length));
                                items.splice(idx, 0, snapshot.item);
                                return { ...d, items };
                            });
                        }
                        return [...current, {
                            filename: snapshot.filename,
                            source_type: snapshot.source_type,
                            text_excerpt: snapshot.text_excerpt,
                            warnings: snapshot.warnings,
                            items: [snapshot.item],
                        }];
                    });
                },
            },
        });
    };

    const parseDateTime = (date, startTime, endTime, endDate) => {
        if (!date) return null;
        const start = new Date(`${date}T${startTime || "10:00"}`);
        let end = new Date(`${endDate || date}T${endTime || startTime || "11:00"}`);
        if (Number.isNaN(start.getTime())) return null;
        if (Number.isNaN(end.getTime()) || end <= start) {
            end = new Date(start.getTime() + 60 * 60 * 1000);
        }
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const validateItem = (doc, item) => {
        const draft = item.draft || item;
        const destination = inferDestination(draft);
        const errors = [];
        const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;

        if (!draft.title) errors.push("Missing title");

        if (destination === "events") {
            if (!draft.date) errors.push("Missing event date");
            if (!draft.start_time) errors.push("Missing event start time");
            if (!orgSlug) errors.push("Missing source organisation");
            if (draft.action === "update_event" && !draft.matched_event_id) errors.push("Update event has no matched event ID");
        }

        if (destination === "volunteering") {
            if (!orgSlug) errors.push("Missing source organisation");
            if (!draft.description) errors.push("Missing volunteering description");
            if (draft.action === "update_volunteer" && !draft.matched_volunteer_id) errors.push("Update volunteering has no matched volunteering ID");
        }

        if (destination === "local_feed") {
            if (!orgSlug) errors.push("Missing source organisation");
            if (!draft.description && !draft.title) errors.push("Missing feed content");
        }

        if (destination === "organisations") {
            if (!draft.description) errors.push("Missing organisation summary/description");
            if (draft.action === "update_organisation" && !draft.matched_org_slug) errors.push("Update organisation has no matched organisation slug");
        }

        if (destination === "venues") {
            if (draft.action === "update_venue" && !draft.matched_venue_id) errors.push("Update venue has no matched venue ID");
        }

        return { destination, errors };
    };

    const flattenReviewItems = () =>
        reviewDocs.flatMap((doc) => (doc.items || []).map((item) => ({ doc, item })));

    const runDryValidation = (scope = "all") => {
        const pool = flattenReviewItems();
        const targets = scope === "selected"
            ? pool.filter(({ item }) => selectedReviewIds.includes(item.reviewId))
            : pool;
        const rows = targets.map(({ doc, item }) => {
            const result = validateItem(doc, item);
            return {
                reviewId: item.reviewId,
                filename: doc.filename,
                title: (item.draft || item).title || "Untitled",
                destination: result.destination,
                errors: result.errors,
            };
        });
        const valid = rows.filter((row) => row.errors.length === 0);
        const invalid = rows.filter((row) => row.errors.length > 0);
        const report = {
            scope,
            total: rows.length,
            valid: valid.length,
            invalid: invalid.length,
            invalidRows: invalid,
        };
        setBatchReport(report);
        if (invalid.length === 0) {
            toast.success(`Validation passed: ${valid.length}/${rows.length} ready to publish`);
        } else {
            toast.warning(`Validation found ${invalid.length} issue${invalid.length === 1 ? "" : "s"}`);
        }
        return { report, validRows: valid };
    };

    const publishBatch = async (scope = "all") => {
        const { report, validRows } = runDryValidation(scope);
        if (!report.total) {
            toast.error(scope === "selected" ? "Select items first" : "No parsed items to publish");
            return;
        }
        if (!validRows.length) {
            toast.error("No valid items to publish");
            return;
        }

        let successCount = 0;
        for (const row of validRows) {
            const pair = flattenReviewItems().find(({ item }) => item.reviewId === row.reviewId);
            if (!pair) continue;
            try {
                // postItem removes the item from the review list on success.
                // Keep item-level success toasts for transparency during batch operations.
                // eslint-disable-next-line no-await-in-loop
                await postItem(pair.doc, pair.item);
                successCount += 1;
            } catch {
                // postItem already surfaces the error toast.
            }
        }
        toast.success(`Batch publish complete: ${successCount}/${validRows.length} posted`);
        await refresh();
    };

    const postItem = async (doc, item) => {
        const draft = item.draft || item;
        try {
            const destination = inferDestination(draft);

            if (destination === "events") {
                const timing = parseDateTime(draft.date, draft.start_time, draft.end_time, draft.end_date);
                if (!timing) {
                    toast.error("Add a date and time before posting this event");
                    return false;
                }
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const payload = {
                    title: draft.title,
                    orgSlug,
                    category: draft.category || "Community",
                    start: timing.start,
                    end: timing.end,
                    venue: draft.location || "",
                    address: draft.address || draft.location || "",
                    description: draft.description || draft.title,
                    cost: draft.cost || "",
                    age: draft.age || "",
                    accessibility: draft.accessibility || "",
                    booking: draft.booking || draft.url || "",
                    contactEmail: draft.contact_email || draft.email || "",
                    contactPhone: draft.contact_phone || draft.phone || "",
                    image: draft.image || "",
                    status: "approved",
                    recurrence: buildRecurrencePayload(
                        draft.recurrence_freq || "none",
                        draft.recurrence_until || ""
                    ),
                };
                if (draft.action === "update_event" && draft.matched_event_id) {
                    await api.updateEvent(draft.matched_event_id, payload);
                } else {
                    await api.createEvent(payload);
                }
            } else if (destination === "volunteering") {
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const volunteerPayload = {
                    title: draft.title,
                    orgSlug,
                    description: draft.description || draft.title,
                    age: draft.category === "Youth" ? "Youth" : "",
                    time: [draft.date, draft.start_time].filter(Boolean).join(" ").trim(),
                    skills: "",
                };
                if (draft.action === "update_volunteer" && draft.matched_volunteer_id) {
                    await api.updateVolunteer(draft.matched_volunteer_id, volunteerPayload);
                } else {
                    await api.createVolunteer(volunteerPayload);
                }
            } else if (destination === "local_feed") {
                const orgSlug = draft.matched_org_slug || sourceOrgSlug || orgs[0]?.slug;
                if (!orgSlug) {
                    toast.error("Pick a source organisation first");
                    return false;
                }
                const feedUrl = extractFirstUrl(draft, doc);
                const body = [
                    draft.description || draft.title,
                    feedUrl ? `More info: ${feedUrl}` : "",
                ].filter(Boolean).join("\n\n");
                await api.createFeedPost({
                    orgSlug,
                    type: detectFeedType(draft),
                    title: draft.title,
                    body,
                    image: "",
                });
            } else if (destination === "venues") {
                const venuePayload = {
                    name: draft.title,
                    address: draft.location || "",
                    facilities: [],
                    accessibility: "",
                    capacity: 0,
                    booking: draft.description || "",
                    image: "",
                };
                if (draft.action === "update_venue" && draft.matched_venue_id) {
                    await api.updateVenue(draft.matched_venue_id, venuePayload);
                } else {
                    await api.createVenue(venuePayload);
                }
            } else {
                const orgContactEmail = (draft.contact_email || draft.contactEmail || "").trim();
                if (!orgContactEmail) {
                    toast.error("Contact email is required before posting an organisation");
                    return false;
                }
                const payload = {
                    slug: (draft.matched_org_slug || draft.title || doc.filename)
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, ""),
                    name: draft.title,
                    category: draft.category || "Community groups",
                    short: draft.description || draft.title,
                    about: draft.description || draft.title,
                    does: draft.description || draft.title,
                    forWho: "",
                    meeting: "",
                    address: draft.location || "",
                    location: "Blackrod",
                    email: orgContactEmail,
                    phone: "",
                    website: "",
                    socials: { facebook: "", instagram: "", tiktok: "", linkedin: "" },
                    brandColor: "#0052FF",
                    logo: "✨",
                    cover: "",
                    status: "approved",
                };
                if (draft.action === "update_organisation" && draft.matched_org_slug) {
                    await api.patchOrg(draft.matched_org_slug, {
                        name: draft.title,
                        short: draft.description || draft.title,
                        about: draft.description || draft.title,
                        does: draft.description || draft.title,
                        address: draft.location || "",
                    });
                    await api.setOrgStatus(draft.matched_org_slug, "approved");
                } else {
                    const created = await api.submitOrg(payload);
                    await api.setOrgStatus(created.slug, "approved");
                }
            }
            toast.success("Posted to the site");
            deleteItem(doc.filename, item.reviewId);
            await refresh();
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Couldn't post this item");
            return false;
        }
    };

    const requestPost = (doc, item) => {
        const draft = item.draft || item;
        if (isUpdateAction(draft.action)) {
            setConfirmPost({ doc, item });
            return;
        }
        postItem(doc, item);
    };

    const confirmAndPost = async () => {
        if (!confirmPost) return;
        await postItem(confirmPost.doc, confirmPost.item);
        setConfirmPost(null);
    };

    const onSelectFiles = (event) => {
        setFiles(Array.from(event.target.files || []));
    };

    const waitForParserPoll = (ms) =>
        new Promise((resolve) => window.setTimeout(resolve, ms));

    const watchParseJob = async (jobId, fallbackTotal = 1, { resuming = false } = {}) => {
        if (!jobId) return;

        const generation = ++pollGenerationRef.current;
        let consecutiveFailures = 0;

        setBusy(true);
        setConnectionState(resuming ? "reconnecting" : "connected");
        setLastPollError("");

        while (mountedRef.current && generation === pollGenerationRef.current) {
            try {
                const status = await api.getParseJob(jobId);

                if (!mountedRef.current || generation !== pollGenerationRef.current) {
                    return;
                }

                consecutiveFailures = 0;
                setConnectionState("connected");
                setLastPollError("");

                const total = Math.max(
                    1,
                    Number(status?.total ?? status?.total_sources ?? fallbackTotal ?? 1) || 1,
                );
                const done = Math.max(0, Number(status?.done ?? 0) || 0);
                const parserStatus = String(status?.status || "processing").toLowerCase();

                const progress = {
                    done,
                    total,
                    current: status?.current || "",
                    status: parserStatus,
                    attempts: Number(status?.attempts ?? status?.attempt ?? 0) || 0,
                    error: status?.error || "",
                    updatedAt: status?.updated_at || "",
                };

                setParseProgress(progress);

                writeStoredParseJob({
                    ...(readStoredParseJob() || {}),
                    job_id: jobId,
                    total,
                    done,
                    current: progress.current,
                    status: parserStatus,
                    updated_at: progress.updatedAt || new Date().toISOString(),
                    source_org_slug: sourceOrgSlug || readStoredParseJob()?.source_org_slug || "",
                });

                if (parserStatus === "done") {
                    const res = status?.result || { documents: [] };
                    const documents = Array.isArray(res?.documents) ? res.documents : [];

                    setResult(res);
                    setReviewDocs(normalizeDocs(documents));
                    setSelectedReviewIds([]);
                    setBatchReport(null);
                    setBusy(false);
                    setConnectionState("done");
                    setLastPollError("");

                    writeStoredParseJob({
                        ...(readStoredParseJob() || {}),
                        job_id: jobId,
                        total,
                        done: total,
                        current: "",
                        status: "done",
                        completed_at: status?.completed_at || new Date().toISOString(),
                    });

                    toast.success(
                        `${resuming ? "Recovered" : "Parsed"} ${documents.length} source${documents.length === 1 ? "" : "s"}`,
                    );
                    return;
                }

                if (parserStatus === "failed") {
                    const message = status?.error || "The parser could not complete this import.";
                    setBusy(false);
                    setConnectionState("failed");
                    setLastPollError(message);

                    writeStoredParseJob({
                        ...(readStoredParseJob() || {}),
                        job_id: jobId,
                        status: "failed",
                        error: message,
                        updated_at: new Date().toISOString(),
                    });

                    toast.error(message);
                    return;
                }
            } catch (error) {
                if (!mountedRef.current || generation !== pollGenerationRef.current) {
                    return;
                }

                const statusCode = parserErrorStatus(error);
                const message = parserErrorMessage(error);

                if (statusCode === 404) {
                    clearStoredParseJob();
                    setActiveJobId("");
                    setBusy(false);
                    setParseProgress(null);
                    setConnectionState("failed");
                    setLastPollError("The saved import job no longer exists on the server.");
                    toast.error("The saved import job no longer exists. Start a new import.");
                    return;
                }

                if (statusCode === 401 || statusCode === 403) {
                    setBusy(false);
                    setConnectionState("failed");
                    setLastPollError("Your admin session can no longer access this import.");
                    toast.error("Your admin session expired. Sign in again, then reopen this page to resume the import.");
                    return;
                }

                consecutiveFailures += 1;
                setConnectionState("reconnecting");
                setLastPollError(message);
            }

            const reconnectDelay = consecutiveFailures
                ? Math.min(
                    BULK_PARSE_POLL_INTERVAL_MS * Math.pow(1.7, Math.min(consecutiveFailures, 6)),
                    BULK_PARSE_MAX_RECONNECT_DELAY_MS,
                )
                : BULK_PARSE_POLL_INTERVAL_MS;

            await waitForParserPoll(reconnectDelay);
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        const stored = readStoredParseJob();
        if (stored?.job_id) {
            setActiveJobId(stored.job_id);
            setParseProgress({
                done: Number(stored.done || 0),
                total: Math.max(1, Number(stored.total || 1)),
                current: stored.current || "",
                status: stored.status || "queued",
                attempts: Number(stored.attempts || 0),
                error: stored.error || "",
                updatedAt: stored.updated_at || "",
            });
            watchParseJob(stored.job_id, stored.total || 1, { resuming: true });
        }

        return () => {
            mountedRef.current = false;
            pollGenerationRef.current += 1;
        };
        // This intentionally runs once. A newly-created job is watched directly
        // by parse(); a saved job is recovered here after a refresh/revisit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clear = () => {
        if (busy) {
            toast.info("This import is still running. You can safely leave this page and come back later.");
            return;
        }

        pollGenerationRef.current += 1;
        clearStoredParseJob();
        setActiveJobId("");
        setFiles([]);
        setLinkSources("");
        setTextSources("");
        setResult(null);
        setReviewDocs([]);
        setSelectedReviewIds([]);
        setBatchReport(null);
        setParseProgress(null);
        setConnectionState("idle");
        setLastPollError("");
    };

    const reconnectToSavedJob = () => {
        const stored = readStoredParseJob();
        if (!stored?.job_id) {
            toast.error("There is no saved import to reconnect to.");
            return;
        }
        setActiveJobId(stored.job_id);
        watchParseJob(stored.job_id, stored.total || 1, { resuming: true });
    };

    const parse = async () => {
        const links = linkSources
            .split(/\n+/)
            .map((value) => value.trim())
            .filter(Boolean);

        // Blank lines are deliberately preserved because they are common inside
        // copied emails, event notices and Word-style content. If an admin wants
        // to submit several unrelated pasted sources at once, a line containing
        // three or more dashes acts as the explicit source separator.
        const textBlocks = textSources.trim()
            ? textSources
                .split(/\n\s*-{3,}\s*\n/g)
                .map((value) => value.trim())
                .filter(Boolean)
            : [];

        if (!files.length && !links.length && !textBlocks.length) {
            toast.error("Add files, links or pasted text first");
            return;
        }

        pollGenerationRef.current += 1;
        setBusy(true);
        setResult(null);
        setReviewDocs([]);
        setSelectedReviewIds([]);
        setBatchReport(null);
        setConnectionState("uploading");
        setLastPollError("");
        setParseProgress({
            done: 0,
            total: Math.max(1, files.length + links.length + textBlocks.length),
            current: "Uploading sources…",
            status: "uploading",
            attempts: 0,
            error: "",
            updatedAt: "",
        });

        try {
            const job = await api.createParseJob(files, sourceOrgSlug, { links, textBlocks });
            const total = Math.max(
                1,
                Number(job?.total ?? job?.total_sources ?? files.length + links.length + textBlocks.length) || 1,
            );

            setActiveJobId(job.job_id);
            setConnectionState("connected");
            setParseProgress({
                done: 0,
                total,
                current: "",
                status: job?.status || "queued",
                attempts: 0,
                error: "",
                updatedAt: "",
            });

            writeStoredParseJob({
                job_id: job.job_id,
                total,
                done: 0,
                current: "",
                status: job?.status || "queued",
                created_at: new Date().toISOString(),
                source_org_slug: sourceOrgSlug || "",
                filenames: files.map((file) => file.name),
                link_count: links.length,
                text_count: textBlocks.length,
            });

            toast.success("Import accepted. You can leave this page — processing will continue in the background.");
            await watchParseJob(job.job_id, total);
        } catch (error) {
            setBusy(false);
            setConnectionState("failed");
            setLastPollError(parserErrorMessage(error));
            toast.error(parserErrorMessage(error) || "Could not start the bulk import");
        }
    };

    const hasSources = files.length > 0 || linkSources.trim().length > 0 || textSources.trim().length > 0;

    return (
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" /> Bulk document import
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl mt-3">Upload documents, links or text and route them to the right place</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                        Add PDFs, Word files, spreadsheets, images, Facebook page links or pasted text in one go. The parser will extract text, flag whether each source looks like an event, organisation, local feed update, volunteering opportunity, venue, or an update to something existing, and show the best match for review.
                    </p>
                </div>
                <div className="min-w-full lg:min-w-[280px] space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional source organisation hint</label>
                    <select
                        value={sourceOrgSlug}
                        onChange={(e) => setSourceOrgSlug(e.target.value)}
                        className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                    >
                        <option value="">No hint</option>
                        {orgs.map((org) => (
                            <option key={org.slug} value={org.slug}>{org.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-dashed border-border p-5 bg-background/60">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                            <UploadCloud className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold">Choose one or more files</div>
                            <p className="text-sm text-muted-foreground mt-1">Best results: PDF, DOCX, PPTX, XLSX, TXT, CSV or image files (including iPhone HEIC photos). Scanned flyers, Canva PDFs and screenshots are OCR’d automatically before classification.</p>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold cursor-pointer">
                            <UploadCloud className="h-3.5 w-3.5" /> {busy ? "Parsing…" : "Select files"}
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff,.heic,.heif"
                                className="hidden"
                                onChange={onSelectFiles}
                                disabled={busy}
                                data-testid="admin-bulk-file-input"
                            />
                        </label>
                        <button
                            onClick={parse}
                            disabled={busy || !hasSources}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-foreground text-xs font-semibold disabled:opacity-60"
                            data-testid="admin-bulk-parse-btn"
                        >
                            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {busy && parseProgress
                                ? parseProgress.status === "uploading"
                                    ? "Uploading…"
                                    : parseProgress.status === "queued"
                                        ? "Queued…"
                                        : `Processing ${Math.min(parseProgress.done + 1, parseProgress.total)}/${parseProgress.total}…`
                                : "Parse documents"}
                        </button>
                        <button
                            onClick={clear}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-muted text-xs font-semibold disabled:opacity-60"
                        >
                            Clear
                        </button>
                        <a
                            href={`${API}/admin/documents/template.xlsx`}
                            download
                            data-testid="admin-bulk-template-link"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                            title="Blank Excel template with the exact columns the parser understands"
                        >
                            <FileText className="h-3.5 w-3.5" /> Spreadsheet template
                        </a>
                        <a
                            href={`${API}/admin/documents/template.docx`}
                            download
                            data-testid="admin-bulk-word-template-link"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-semibold hover:bg-muted"
                            title="Word template using labelled event blocks — parses instantly without AI"
                        >
                            <FileText className="h-3.5 w-3.5" /> Word template
                        </a>
                    </div>
                    <div className="mt-4 grid gap-3">
                        <Field label="Page links or Facebook URLs, one per line">
                            <textarea
                                value={linkSources}
                                onChange={(e) => setLinkSources(e.target.value)}
                                placeholder="https://www.facebook.com/...\nhttps://example.org/page"
                                rows={4}
                                className={inp}
                            />
                        </Field>
                        <Field label="Pasted text — paste one notice, email, programme or multiple events together">
                            <textarea
                                value={textSources}
                                onChange={(e) => setTextSources(e.target.value)}
                                placeholder={"Paste flyer text, copied email content, a programme or several events here. Blank lines are preserved.\n\nIf you are pasting completely unrelated sources, put --- on its own line between them."}
                                rows={7}
                                className={inp}
                            />
                        </Field>
                    </div>
                    {parseProgress && (
                        <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4" data-testid="parse-progress-panel">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                    {busy ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                                    ) : parseProgress.status === "done" ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span>
                                        {connectionState === "reconnecting"
                                            ? "Reconnecting to parser…"
                                            : parseProgress.status === "uploading"
                                                ? "Uploading sources…"
                                                : parseProgress.status === "queued"
                                                    ? "Import queued"
                                                    : parseProgress.status === "done"
                                                        ? "Import complete"
                                                        : parseProgress.status === "failed"
                                                            ? "Import failed"
                                                            : parseProgress.current
                                                                ? `Working on: ${parseProgress.current}`
                                                                : "Processing import…"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        connectionState === "reconnecting"
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                            : parseProgress.status === "done"
                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                : parseProgress.status === "failed"
                                                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                                    : "bg-primary/10 text-primary"
                                    }`}>
                                        {connectionState === "reconnecting" ? "Reconnecting" : parseProgress.status || "processing"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {Math.min(parseProgress.done || 0, parseProgress.total || 1)} of {parseProgress.total || 1} done
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{
                                        width: `${
                                            parseProgress.status === "done"
                                                ? 100
                                                : Math.max(
                                                    parseProgress.status === "uploading" ? 3 : 5,
                                                    Math.round(((parseProgress.done || 0) / Math.max(1, parseProgress.total || 1)) * 100),
                                                )
                                        }%`,
                                    }}
                                />
                            </div>

                            {connectionState === "reconnecting" && (
                                <div className="mt-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                    The browser temporarily lost contact with the parser. The import has <b>not</b> been cancelled. Blackrod Now will keep reconnecting automatically.
                                    {lastPollError ? <div className="mt-1 opacity-80">{lastPollError}</div> : null}
                                </div>
                            )}

                            {parseProgress.status === "failed" && lastPollError && (
                                <div className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                                    {lastPollError}
                                </div>
                            )}

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                <span>
                                    {busy
                                        ? "Processing is server-side. You can safely leave or refresh this page and return later."
                                        : parseProgress.status === "done"
                                            ? "Results are retained against this import until you clear it or start another import."
                                            : "This import is saved in your browser and can be reconnected."}
                                </span>
                                {activeJobId && (
                                    <span className="font-mono text-[10px]" title={activeJobId}>
                                        Job {activeJobId.slice(0, 8)}…
                                    </span>
                                )}
                            </div>

                            {!busy && activeJobId && parseProgress.status !== "done" && (
                                <button
                                    type="button"
                                    onClick={reconnectToSavedJob}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" /> Reconnect to saved import
                                </button>
                            )}
                        </div>
                    )}
                    {files.length > 0 && (
                        <ul className="mt-4 grid gap-2 text-sm">
                            {files.map((file) => (
                                <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2 bg-surface">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-3xl border border-border p-5 bg-muted/30">
                    <h3 className="font-display font-bold text-lg">What the parser looks for</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li>• Event dates, times and venue clues</li>
                        <li>• Volunteering keywords, helper roles and recruitment language</li>
                        <li>• Organisational names and update language</li>
                        <li>• Venue names, addresses, halls and facility/booking cues</li>
                        <li>• Existing org, event, volunteer and venue matches from current site data</li>
                        <li>• Review hints when the parser is not certain</li>
                    </ul>
                </div>
            </div>

            {result && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display font-bold text-xl">Parsed results</h3>
                        <span className="text-xs text-muted-foreground">{result.mocked ? "Fallback parser" : "AI-assisted parser"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={reviewStatusFilter} onChange={(e) => setReviewStatusFilter(e.target.value)} className="px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold">
                            <option value="all">All statuses</option>
                            <option value="open">Open</option>
                            <option value="in_review">In review</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <select value={reviewOwnerFilter} onChange={(e) => setReviewOwnerFilter(e.target.value)} className="px-3 py-2 rounded-full border border-border bg-background text-xs font-semibold">
                            <option value="all">All owners</option>
                            <option value="mine">Assigned to me</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                        <button type="button" onClick={() => bulkPatchSelected({ review_owner: REVIEWER_NAME, review_status: "in_review" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Assign selected to me</button>
                        <button type="button" onClick={() => bulkPatchSelected({ review_status: "blocked" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Mark selected blocked</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => runDryValidation("all")} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">Validate all</button>
                        <button type="button" onClick={() => publishBatch("all")} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Post all valid</button>
                        <button type="button" onClick={() => runDryValidation("selected")} className="px-3 py-2 rounded-full border border-border text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Validate selected</button>
                        <button type="button" onClick={() => publishBatch("selected")} className="px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-60" disabled={!selectedReviewIds.length}>Post selected valid</button>
                        <span className="text-xs text-muted-foreground">{selectedReviewIds.length} selected</span>
                    </div>
                    {batchReport && (
                        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs">
                            <div className="font-semibold">Validation summary ({batchReport.scope})</div>
                            <div className="mt-1 text-muted-foreground">{batchReport.valid}/{batchReport.total} valid · {batchReport.invalid} with issues</div>
                            {batchReport.invalidRows.length > 0 && (
                                <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                                    {batchReport.invalidRows.slice(0, 6).map((row) => (
                                        <li key={row.reviewId}>- {row.title} ({row.destination}): {row.errors.join(", ")}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className="grid gap-4">
                        {visibleReviewDocs.map((doc) => (
                            <div key={doc.filename} className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div>
                                        <div className="font-semibold">{doc.filename}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{(doc.source_type || "unknown").toUpperCase()}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {doc.items.map((item, index) => (
                                            <span key={`${doc.filename}-${index}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
                                                {ACTION_LABELS[item.action] || ACTION_LABELS.unclear}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {doc.warnings.length > 0 && (
                                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{doc.warnings.join(" · ")}</p>
                                )}
                                {doc.text_excerpt && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{doc.text_excerpt}</p>}
                                <div className="mt-4 grid gap-3">
                                    {doc.items.map((item, index) => (
                                        <div key={`${doc.filename}-item-${index}`} className="rounded-2xl border border-border p-4 bg-surface">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground mr-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedReviewIds.includes(item.reviewId)}
                                                        onChange={() => toggleSelectedItem(item.reviewId)}
                                                    />
                                                    Select
                                                </label>
                                                <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.suggested_type}</span>
                                                <span className="text-xs text-muted-foreground">{item.title}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">Owner: {(item.draft || item).review_owner || "Unassigned"}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">Status: {(item.draft || item).review_status || "open"}</span>
                                                {typeof item.entity_confidence === "number" && <span className="text-xs text-muted-foreground">{Math.round(item.entity_confidence * 100)}% entity match</span>}
                                                {typeof item.confidence === "number" && typeof item.entity_confidence !== "number" && <span className="text-xs text-muted-foreground">{Math.round(item.confidence * 100)}% match</span>}
                                            </div>
                                            {item.isEditing ? (
                                                <div className="mt-3 grid gap-3">
                                                    <Field label="Post to">
                                                        <select value={inferDestination(item.draft || item)} onChange={(e) => updateItem(doc.filename, item.reviewId, { publish_target: e.target.value })} className={inp}>
                                                            <option value="events">Events</option>
                                                            <option value="organisations">Organisations</option>
                                                            <option value="local_feed">Local feed</option>
                                                            <option value="volunteering">Volunteering</option>
                                                            <option value="venues">Venues</option>
                                                        </select>
                                                    </Field>
                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        <Field label="Review owner">
                                                            <input value={(item.draft || item).review_owner || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { review_owner: e.target.value })} placeholder="e.g. Admin" className={inp} />
                                                        </Field>
                                                        <Field label="Review status">
                                                            <select value={(item.draft || item).review_status || "open"} onChange={(e) => updateItem(doc.filename, item.reviewId, { review_status: e.target.value })} className={inp}>
                                                                <option value="open">Open</option>
                                                                <option value="in_review">In review</option>
                                                                <option value="blocked">Blocked</option>
                                                            </select>
                                                        </Field>
                                                    </div>
                                                    <Field label="Title">
                                                        <input value={item.draft.title || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { title: e.target.value })} className={inp} />
                                                    </Field>
                                                    <Field label="Description">
                                                        <textarea rows={3} value={item.draft.description || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { description: e.target.value })} className={inp} />
                                                    </Field>
                                                    {item.suggested_type === "event" ? (
                                                        <>
                                                            <div className="grid sm:grid-cols-3 gap-3">
                                                                <Field label="Date">
                                                                    <input type="date" value={item.draft.date || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { date: e.target.value })} className={inp} />
                                                                </Field>
                                                                <Field label="Start">
                                                                    <input type="time" value={item.draft.start_time || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { start_time: e.target.value })} className={inp} />
                                                                </Field>
                                                                <Field label="End">
                                                                    <input type="time" value={item.draft.end_time || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { end_time: e.target.value })} className={inp} />
                                                                </Field>
                                                            </div>
                                                            <div className="grid sm:grid-cols-2 gap-3">
                                                                <Field label={
                                                                    <span className="inline-flex items-center gap-2">
                                                                        Repeat
                                                                        {item.recurrence_freq && item.recurrence_freq !== "none" && (
                                                                            <span
                                                                                data-testid={`bulk-item-recurrence-detected-${item.reviewId}`}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground text-[9px] font-black uppercase tracking-wider"
                                                                                title={`Detected "${item.recurrence_raw_text || ""}" in the source text`}
                                                                            >
                                                                                Auto-detected{item.recurrence_weekday ? ` · ${item.recurrence_weekday}s` : ""}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                }>
                                                                    <select
                                                                        data-testid={`bulk-item-recurrence-freq-${item.reviewId}`}
                                                                        value={item.draft.recurrence_freq || "none"}
                                                                        onChange={(e) => updateItem(doc.filename, item.reviewId, { recurrence_freq: e.target.value })}
                                                                        className={inp}
                                                                    >
                                                                        <option value="none">Doesn&apos;t repeat</option>
                                                                        <option value="daily">Every day</option>
                                                                        <option value="weekly">Every week</option>
                                                                        <option value="biweekly">Every 2 weeks</option>
                                                                        <option value="monthly">Every month</option>
                                                                        <option value="monthly_weekday">Same weekday each month (e.g. 1st Thursday)</option>
                                                                        <option value="annually">Every year</option>
                                                                    </select>
                                                                </Field>
                                                                <Field label="Repeat until (optional)">
                                                                    <input
                                                                        data-testid={`bulk-item-recurrence-until-${item.reviewId}`}
                                                                        type="date"
                                                                        value={item.draft.recurrence_until || ""}
                                                                        onChange={(e) => updateItem(doc.filename, item.reviewId, { recurrence_until: e.target.value })}
                                                                        disabled={!item.draft.recurrence_freq || item.draft.recurrence_freq === "none"}
                                                                        className={`${inp} disabled:opacity-60`}
                                                                    />
                                                                </Field>
                                                            </div>
                                                        </>  
                                                    ) : (
                                                        <Field label="Location">
                                                            <input value={item.draft.location || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { location: e.target.value })} className={inp} />
                                                        </Field>
                                                    )}
                                                    {item.suggested_type === "event" && (
                                                        <>
                                                            <div className="grid sm:grid-cols-2 gap-3">
                                                                <Field label="Venue name">
                                                                    <input value={item.draft.location || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { location: e.target.value })} className={inp} placeholder="e.g. St Catherine's Hall" />
                                                                </Field>
                                                                <Field label="Street address">
                                                                    <input value={item.draft.address || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { address: e.target.value })} className={inp} placeholder="e.g. Church Road, Blackrod" />
                                                                </Field>
                                                            </div>
                                                            <div className="grid sm:grid-cols-2 gap-3">
                                                                <Field label="Cost">
                                                                    <input value={item.draft.cost || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { cost: e.target.value })} className={inp} placeholder="e.g. Free, £5, £3/£5" />
                                                                </Field>
                                                                <Field label="Suitable for">
                                                                    <input value={item.draft.age || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { age: e.target.value })} className={inp} placeholder="e.g. All ages, Adults, Under 16s" />
                                                                </Field>
                                                            </div>
                                                            <div className="grid sm:grid-cols-2 gap-3">
                                                                <Field label="Contact email">
                                                                    <input type="email" value={item.draft.contact_email || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { contact_email: e.target.value })} className={inp} />
                                                                </Field>
                                                                <Field label="Contact phone">
                                                                    <input type="tel" value={item.draft.contact_phone || ""} onChange={(e) => updateItem(doc.filename, item.reviewId, { contact_phone: e.target.value })} className={inp} />
                                                                </Field>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button type="button" onClick={() => toggleEdit(doc.filename, item.reviewId)} className="px-3 py-2 rounded-full bg-muted text-xs font-semibold">Done</button>
                                                        <button type="button" onClick={() => deleteItemWithUndo(doc, item)} className="px-3 py-2 rounded-full border border-foreground text-xs font-semibold">Delete</button>
                                                        <button type="button" onClick={() => requestPost(doc, item)} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Post</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-sm text-muted-foreground">{item.description}</div>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                                <span className="px-2.5 py-1 rounded-full bg-muted font-semibold">{ACTION_LABELS[item.action] || ACTION_LABELS.unclear}</span>
                                                <span className="px-2.5 py-1 rounded-full bg-muted">Destination: {destinationLabel(item.draft || item)}</span>
                                                {item.matched_org_name && <span className="px-2.5 py-1 rounded-full bg-muted">Org: {item.matched_org_name}</span>}
                                                {item.matched_event_title && <span className="px-2.5 py-1 rounded-full bg-muted">Event: {item.matched_event_title}</span>}
                                                {item.matched_volunteer_title && <span className="px-2.5 py-1 rounded-full bg-muted">Volunteer: {item.matched_volunteer_title}</span>}
                                                {item.matched_venue_name && <span className="px-2.5 py-1 rounded-full bg-muted">Venue: {item.matched_venue_name}</span>}
                                                {item.location && <span className="px-2.5 py-1 rounded-full bg-muted">{item.location}</span>}
                                                {item.address && <span className="px-2.5 py-1 rounded-full bg-muted">📍 {item.address}</span>}
                                                {item.date && <span className="px-2.5 py-1 rounded-full bg-muted">{item.date}{item.end_date ? ` → ${item.end_date}` : ""}</span>}
                                                {item.start_time && <span className="px-2.5 py-1 rounded-full bg-muted">{item.start_time}{item.end_time ? `-${item.end_time}` : ""}</span>}
                                                {item.cost && <span className="px-2.5 py-1 rounded-full bg-muted">💷 {item.cost}</span>}
                                                {item.booking && <span className="px-2.5 py-1 rounded-full bg-muted">🎫 {item.booking}</span>}
                                                {item.age && <span className="px-2.5 py-1 rounded-full bg-muted">👥 {item.age}</span>}
                                                {item.accessibility && <span className="px-2.5 py-1 rounded-full bg-muted">♿ {item.accessibility}</span>}
                                                {item.contact_email && <span className="px-2.5 py-1 rounded-full bg-muted">✉ {item.contact_email}</span>}
                                                {item.contact_phone && <span className="px-2.5 py-1 rounded-full bg-muted">☎ {item.contact_phone}</span>}
                                                {item.recurrence_freq && item.recurrence_freq !== "none" && (
                                                    <span
                                                        data-testid={`bulk-item-recurrence-chip-${item.reviewId}`}
                                                        className="px-2.5 py-1 rounded-full bg-secondary/25 text-secondary-foreground font-bold uppercase tracking-wider text-[10px]"
                                                        title={`Detected "${item.recurrence_raw_text || ""}" in the source text`}
                                                    >
                                                        Repeats {item.recurrence_freq}{item.recurrence_weekday ? ` · ${item.recurrence_weekday}s` : ""}
                                                    </span>
                                                )}
                                            </div>
                                            {(typeof item.date_confidence === "number" && item.date_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                                    Low date confidence ({Math.round(item.date_confidence * 100)}%). Raw date text: {item.raw_date_text || "unknown"}
                                                </p>
                                            )}
                                            {(typeof item.time_confidence === "number" && item.time_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                    Low time confidence ({Math.round(item.time_confidence * 100)}%). Raw time text: {item.raw_time_text || "unknown"}
                                                </p>
                                            )}
                                            {(typeof item.entity_confidence === "number" && item.entity_confidence < LOW_CONFIDENCE_THRESHOLD) && (
                                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                                    Low entity confidence ({Math.round(item.entity_confidence * 100)}%). Double-check match before posting.
                                                </p>
                                            )}
                                            <div className="mt-3 flex gap-2 flex-wrap">
                                                <button type="button" onClick={() => toggleEdit(doc.filename, item.reviewId)} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">
                                                    Edit
                                                </button>
                                                <button type="button" onClick={() => setItemMeta(item.reviewId, { review_owner: REVIEWER_NAME, review_status: "in_review" })} className="px-3 py-2 rounded-full border border-border text-xs font-semibold">
                                                    Assign to me
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateItem(doc.filename, item.reviewId, { publish_target: "local_feed" });
                                                        requestPost(doc, item);
                                                    }}
                                                    className="px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold"
                                                >
                                                    Post to local feed
                                                </button>
                                                <button type="button" onClick={() => deleteItemWithUndo(doc, item)} className="px-3 py-2 rounded-full border border-foreground text-xs font-semibold">
                                                    Delete
                                                </button>
                                                <button type="button" onClick={() => requestPost(doc, item)} className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                                    Post to site
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Dialog open={Boolean(confirmPost)} onOpenChange={(open) => !open && setConfirmPost(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Confirm update publish</DialogTitle>
                    </DialogHeader>
                    {confirmPost && (
                        <div className="space-y-3 text-sm">
                            <p>
                                This will update an existing item in the <b>{destinationLabel(confirmPost.item.draft || confirmPost.item)}</b> section.
                            </p>
                            <div className="rounded-2xl border border-border bg-muted/30 p-3">
                                <div className="font-semibold">{(confirmPost.item.draft || confirmPost.item).title}</div>
                                <div className="text-xs text-muted-foreground mt-1">Action: {ACTION_LABELS[(confirmPost.item.draft || confirmPost.item).action] || "Update"}</div>
                            </div>
                            <p className="text-muted-foreground">Proceed only if this matched existing record is correct.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <button type="button" onClick={() => setConfirmPost(null)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                        <button type="button" onClick={confirmAndPost} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Confirm and publish</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SiteModeCard() {
    const { siteSettings, setSiteSettings } = useApp();
    const [busy, setBusy] = useState(false);
    const [launchAt, setLaunchAt] = useState(siteSettings?.launch_at || "");
    const [teaser, setTeaser] = useState(siteSettings?.teaser || "");
    const comingSoon = !!siteSettings?.coming_soon;

    useEffect(() => {
        setLaunchAt(siteSettings?.launch_at || "");
        setTeaser(siteSettings?.teaser || "");
    }, [siteSettings?.launch_at, siteSettings?.teaser]);

    const patch = async (updates) => {
        setBusy(true);
        try {
            const res = await api.updateSiteSettings(updates);
            setSiteSettings(res);
            toast.success("Site mode updated");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not update site mode");
        } finally {
            setBusy(false);
        }
    };

    const toISOFromLocal = (value) => {
        if (!value) return "";
        try {
            const [datePart, timePart] = value.split("T");
            const [y, m, d] = datePart.split("-").map(Number);
            const [hh, mm] = (timePart || "09:00").split(":").map(Number);
            const iso = new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
            return iso;
        } catch {
            return "";
        }
    };

    // Convert an ISO string to a value the datetime-local input expects.
    const localValue = React.useMemo(() => {
        if (!launchAt) return "";
        try {
            const d = new Date(launchAt);
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
        } catch {
            return "";
        }
    }, [launchAt]);

    return (
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8" data-testid="site-mode-card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display font-black text-2xl">Site mode</h2>
                    <p className="text-sm text-muted-foreground mt-1">Control what the public sees. When Coming Soon is on, guests see the branded launch page; admins and org accounts still see the full site.</p>
                </div>
                <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${comingSoon ? "bg-yellow-400/20 text-yellow-600 dark:text-yellow-300" : "bg-emerald-400/20 text-emerald-700 dark:text-emerald-300"}`}
                >
                    {comingSoon ? "Coming Soon" : "Public / Live"}
                </span>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-3">
                <div className="rounded-3xl border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Current status</div>
                    <div className="mt-1 font-semibold text-sm">{comingSoon ? "Public sees the Coming Soon page." : "Site is live to the public."}</div>
                    <button
                        type="button"
                        data-testid="site-mode-toggle"
                        disabled={busy}
                        onClick={() => patch({ coming_soon: !comingSoon })}
                        className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider disabled:opacity-60 ${comingSoon ? "bg-primary text-primary-foreground" : "border border-border"}`}
                    >
                        {comingSoon ? "Go live now" : "Return to Coming Soon"}
                    </button>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Launch date &amp; time (UK)</div>
                    <input
                        type="datetime-local"
                        data-testid="site-mode-launch-at"
                        value={localValue}
                        onChange={(e) => setLaunchAt(toISOFromLocal(e.target.value))}
                        className="mt-2 w-full px-3 py-2 rounded-2xl border border-border bg-surface text-sm"
                    />
                    <button
                        type="button"
                        disabled={busy || !launchAt}
                        onClick={() => patch({ launch_at: launchAt })}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-60"
                    >
                        Save launch date
                    </button>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Teaser copy</div>
                    <textarea
                        rows={3}
                        data-testid="site-mode-teaser"
                        value={teaser}
                        onChange={(e) => setTeaser(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-2xl border border-border bg-surface text-sm"
                    />
                    <button
                        type="button"
                        disabled={busy || !teaser.trim()}
                        onClick={() => patch({ teaser: teaser.trim() })}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-60"
                    >
                        Save teaser
                    </button>
                </div>
            </div>
        </div>
    );
}


function QuickAddContentCard({ orgs, onCreated }) {
    const [eventOpen, setEventOpen] = useState(false);
    const [feedOpen, setFeedOpen] = useState(false);
    const [volOpen, setVolOpen] = useState(false);
    const [orgOpen, setOrgOpen] = useState(false);
    const [venueOpen, setVenueOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const firstOrgSlug = orgs[0]?.slug || "";
    const [eventForm, setEventForm] = useState({
        title: "", orgSlug: firstOrgSlug, category: "Community",
        date: "", start: "", end: "",
        venue: "", address: "",
        description: "", cost: "Free", age: "All ages",
        accessibility: "", booking: "",
        contactEmail: "", contactPhone: "", image: "",
        status: "approved",
        recurrenceFreq: "none", recurrenceUntil: "", recurrenceInterval: 1, recurrenceExtraDates: [],
    });
    const [feedForm, setFeedForm] = useState({
        orgSlug: firstOrgSlug, type: "update", title: "", body: "", image: "",
    });
    const [volForm, setVolForm] = useState({
        orgSlug: firstOrgSlug, title: "", description: "",
        age: "", time: "", skills: "",
    });
    const [orgForm, setOrgForm] = useState({
        name: "", category: "Community groups", short: "", about: "",
        logo: "✨", cover: "", brandColor: "#0052FF",
        email: "", phone: "", website: "",
        facebook: "", instagram: "", tiktok: "", linkedin: "",
        address: "", meeting: "",
    });
    const [venueForm, setVenueForm] = useState({
        name: "", address: "", facilities: "",
        accessibility: "", capacity: 0, booking: "", image: "",
    });

    useEffect(() => {
        const slug = orgs[0]?.slug || "";
        if (!slug) return;
        setEventForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
        setFeedForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
        setVolForm((prev) => (prev.orgSlug ? prev : { ...prev, orgSlug: slug }));
    }, [orgs]);

    const createEvent = async () => {
        if (!eventForm.title || !eventForm.orgSlug || !eventForm.date) {
            return toast.error("Title, organisation and date are required");
        }
        setBusy(true);
        try {
            const startISO = new Date(`${eventForm.date}T${eventForm.start || "10:00"}`).toISOString();
            const endISO = new Date(`${eventForm.date}T${eventForm.end || eventForm.start || "11:00"}`).toISOString();
            await api.createEvent({
                title: eventForm.title,
                orgSlug: eventForm.orgSlug,
                category: eventForm.category,
                start: startISO,
                end: endISO,
                venue: eventForm.venue,
                address: eventForm.address,
                description: eventForm.description,
                cost: eventForm.cost,
                age: eventForm.age,
                accessibility: eventForm.accessibility,
                booking: eventForm.booking,
                contactEmail: eventForm.contactEmail,
                contactPhone: eventForm.contactPhone,
                image: eventForm.image,
                status: eventForm.status,
                recurrence: buildRecurrencePayload(eventForm.recurrenceFreq, eventForm.recurrenceUntil, {
                    interval: eventForm.recurrenceInterval,
                    extraDates: eventForm.recurrenceExtraDates,
                }),
            });
            toast.success("Event published");
            setEventForm((prev) => ({
                ...prev,
                title: "", date: "", start: "", end: "",
                venue: "", address: "", description: "",
                accessibility: "", booking: "", contactEmail: "",
                contactPhone: "", image: "",
                recurrenceFreq: "none", recurrenceUntil: "", recurrenceInterval: 1, recurrenceExtraDates: [],
            }));
            setEventOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish event");
        } finally {
            setBusy(false);
        }
    };

    const createFeedPost = async () => {
        if (!feedForm.orgSlug || !feedForm.title || !feedForm.body) {
            return toast.error("Pick an organisation, title and message");
        }
        setBusy(true);
        try {
            await api.createFeedPost(feedForm);
            toast.success("Feed post published");
            setFeedForm((prev) => ({ ...prev, title: "", body: "", image: "", type: "update" }));
            setFeedOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish feed post");
        } finally {
            setBusy(false);
        }
    };

    const createVolunteer = async () => {
        if (!volForm.orgSlug || !volForm.title || !volForm.description) {
            return toast.error("Pick an organisation, title and description");
        }
        setBusy(true);
        try {
            const payload = {
                id: `vol-${Date.now()}`,
                ...volForm,
            };
            await api.createVolunteer(payload);
            toast.success("Volunteering opportunity published");
            setVolForm((prev) => ({ ...prev, title: "", description: "", age: "", time: "", skills: "" }));
            setVolOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish volunteering opportunity");
        } finally {
            setBusy(false);
        }
    };

    const createOrgQuick = async () => {
        if (!orgForm.name || !orgForm.short || !orgForm.email.trim()) {
            return toast.error("Name, short description and contact email are required");
        }
        const slug = orgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        setBusy(true);
        try {
            const created = await api.submitOrg({
                slug,
                name: orgForm.name,
                category: orgForm.category,
                short: orgForm.short,
                about: orgForm.about || orgForm.short,
                does: orgForm.about || orgForm.short,
                forWho: "",
                meeting: orgForm.meeting,
                address: orgForm.address,
                location: "Blackrod",
                email: orgForm.email,
                phone: orgForm.phone,
                website: orgForm.website,
                socials: {
                    facebook: orgForm.facebook,
                    instagram: orgForm.instagram,
                    tiktok: orgForm.tiktok,
                    linkedin: orgForm.linkedin,
                },
                brandColor: orgForm.brandColor,
                logo: orgForm.logo || "✨",
                cover: orgForm.cover,
            });
            await api.setOrgStatus(created.slug, "approved");
            toast.success("Organisation published");
            setOrgForm({
                name: "", category: "Community groups", short: "", about: "",
                logo: "✨", cover: "", brandColor: "#0052FF",
                email: "", phone: "", website: "",
                facebook: "", instagram: "", tiktok: "", linkedin: "",
                address: "", meeting: "",
            });
            setOrgOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to create organisation");
        } finally {
            setBusy(false);
        }
    };

    const createVenue = async () => {
        if (!venueForm.name || !venueForm.address) {
            return toast.error("Venue name and address are required");
        }
        setBusy(true);
        try {
            const facilities = venueForm.facilities
                .split(/[,\n]/)
                .map((v) => v.trim())
                .filter(Boolean);
            await api.createVenue({
                id: `ven-${Date.now()}`,
                name: venueForm.name,
                address: venueForm.address,
                facilities,
                accessibility: venueForm.accessibility,
                capacity: Number(venueForm.capacity) || 0,
                booking: venueForm.booking,
                image: venueForm.image || "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=1200&q=80",
            });
            toast.success("Venue published");
            setVenueForm({
                name: "", address: "", facilities: "",
                accessibility: "", capacity: 0, booking: "", image: "",
            });
            setVenueOpen(false);
            onCreated?.();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Failed to publish venue");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-[2rem] border border-border bg-surface p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display font-black text-2xl">Quick add content</h2>
                    <p className="text-sm text-muted-foreground mt-1">Create items across all main categories without leaving the admin dashboard. Fields match each destination page so posts display fully-populated.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">Events · Organisations · Local feed · Volunteering · Venues</span>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {/* Add Event */}
                <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-event">
                            <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><CalendarDays className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add event</div>
                            <p className="text-xs text-muted-foreground mt-1">Publish an event straight into the calendar.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Title">
                                <input data-testid="qc-ev-title" value={eventForm.title} onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Organisation">
                                    <select data-testid="qc-ev-org" value={eventForm.orgSlug} onChange={(e) => setEventForm((p) => ({ ...p, orgSlug: e.target.value }))} className={inp}>
                                        {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Category">
                                    <input value={eventForm.category} onChange={(e) => setEventForm((p) => ({ ...p, category: e.target.value }))} className={inp} placeholder="Community, Sports…" />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <Field label="Date">
                                    <input data-testid="qc-ev-date" type="date" value={eventForm.date} onChange={(e) => setEventForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Start">
                                    <input type="time" value={eventForm.start} onChange={(e) => setEventForm((p) => ({ ...p, start: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="End">
                                    <input type="time" value={eventForm.end} onChange={(e) => setEventForm((p) => ({ ...p, end: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Venue">
                                    <input value={eventForm.venue} onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Address">
                                    <input value={eventForm.address} onChange={(e) => setEventForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Description">
                                <textarea rows={4} value={eventForm.description} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Cost">
                                    <input value={eventForm.cost} onChange={(e) => setEventForm((p) => ({ ...p, cost: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Age suitability">
                                    <input value={eventForm.age} onChange={(e) => setEventForm((p) => ({ ...p, age: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Accessibility">
                                <input value={eventForm.accessibility} onChange={(e) => setEventForm((p) => ({ ...p, accessibility: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Contact email">
                                    <input type="email" value={eventForm.contactEmail} onChange={(e) => setEventForm((p) => ({ ...p, contactEmail: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Contact phone">
                                    <input value={eventForm.contactPhone} onChange={(e) => setEventForm((p) => ({ ...p, contactPhone: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Booking link">
                                <input type="url" value={eventForm.booking} onChange={(e) => setEventForm((p) => ({ ...p, booking: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                            <Field label="Event image">
                                <EventImageInput
                                    value={eventForm.image}
                                    onChange={(url) => setEventForm((p) => ({ ...p, image: url }))}
                                    testIdPrefix="admin-event-image"
                                    inputClassName={inp}
                                />
                            </Field>
                            <Field label="Publish status">
                                <select value={eventForm.status} onChange={(e) => setEventForm((p) => ({ ...p, status: e.target.value }))} className={inp}>
                                    <option value="approved">Publish now (approved)</option>
                                    <option value="pending">Save as pending</option>
                                </select>
                            </Field>
                            <RecurrenceFields
                                freq={eventForm.recurrenceFreq}
                                until={eventForm.recurrenceUntil}
                                interval={eventForm.recurrenceInterval}
                                extraDates={eventForm.recurrenceExtraDates}
                                onFreqChange={(v) => setEventForm((p) => ({ ...p, recurrenceFreq: v }))}
                                onUntilChange={(v) => setEventForm((p) => ({ ...p, recurrenceUntil: v }))}
                                onIntervalChange={(v) => setEventForm((p) => ({ ...p, recurrenceInterval: v }))}
                                onExtraDatesChange={(v) => setEventForm((p) => ({ ...p, recurrenceExtraDates: v }))}
                                startDate={eventForm.date}
                                testIdPrefix="qc-ev-recurrence"
                                inputClassName={inp}
                            />
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setEventOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-ev-submit" disabled={busy} onClick={createEvent} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish event</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Feed post */}
                <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-feed">
                            <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><Newspaper className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add feed update</div>
                            <p className="text-xs text-muted-foreground mt-1">Publish a local feed update immediately.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Create feed post</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Organisation">
                                <select value={feedForm.orgSlug} onChange={(e) => setFeedForm((prev) => ({ ...prev, orgSlug: e.target.value }))} className={inp}>
                                    {orgs.map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Type">
                                <select value={feedForm.type} onChange={(e) => setFeedForm((prev) => ({ ...prev, type: e.target.value }))} className={inp}>
                                    <option value="update">Update</option>
                                    <option value="announcement">Announcement</option>
                                    <option value="news">News</option>
                                </select>
                            </Field>
                            <Field label="Title">
                                <input data-testid="qc-feed-title" value={feedForm.title} onChange={(e) => setFeedForm((prev) => ({ ...prev, title: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Message">
                                <textarea rows={4} value={feedForm.body} onChange={(e) => setFeedForm((prev) => ({ ...prev, body: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Image URL (optional)">
                                <input value={feedForm.image} onChange={(e) => setFeedForm((prev) => ({ ...prev, image: e.target.value }))} className={inp} />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setFeedOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" disabled={busy} onClick={createFeedPost} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish feed post</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Volunteering */}
                <Dialog open={volOpen} onOpenChange={setVolOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-volunteer">
                            <div className="h-9 w-9 rounded-2xl bg-secondary/40 text-secondary-foreground grid place-items-center"><HandHeart className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add volunteering</div>
                            <p className="text-xs text-muted-foreground mt-1">Create a volunteering opportunity from admin.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Create volunteering opportunity</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Organisation">
                                <select value={volForm.orgSlug} onChange={(e) => setVolForm((prev) => ({ ...prev, orgSlug: e.target.value }))} className={inp}>
                                    {orgs.map((org) => <option key={org.slug} value={org.slug}>{org.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Title">
                                <input value={volForm.title} onChange={(e) => setVolForm((prev) => ({ ...prev, title: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Description">
                                <textarea rows={4} value={volForm.description} onChange={(e) => setVolForm((prev) => ({ ...prev, description: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <Field label="Time">
                                    <input value={volForm.time} onChange={(e) => setVolForm((prev) => ({ ...prev, time: e.target.value }))} className={inp} placeholder="e.g. Sat 10-12" />
                                </Field>
                                <Field label="Age">
                                    <input value={volForm.age} onChange={(e) => setVolForm((prev) => ({ ...prev, age: e.target.value }))} className={inp} placeholder="14+, 18+, DofE" />
                                </Field>
                                <Field label="Skills">
                                    <input value={volForm.skills} onChange={(e) => setVolForm((prev) => ({ ...prev, skills: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setVolOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" disabled={busy} onClick={createVolunteer} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish volunteering</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Organisation */}
                <Dialog open={orgOpen} onOpenChange={setOrgOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-org">
                            <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Building2 className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add organisation</div>
                            <p className="text-xs text-muted-foreground mt-1">Create and approve an organisation in one step.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create organisation</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Name">
                                <input data-testid="qc-org-name" value={orgForm.name} onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Category">
                                    <input value={orgForm.category} onChange={(e) => setOrgForm((p) => ({ ...p, category: e.target.value }))} className={inp} placeholder="Community groups, Sports, Faith…" />
                                </Field>
                                <Field label="Brand colour">
                                    <input type="color" value={orgForm.brandColor} onChange={(e) => setOrgForm((p) => ({ ...p, brandColor: e.target.value }))} className="h-10 w-full rounded-2xl border border-border bg-background" />
                                </Field>
                            </div>
                            <Field label="Short description">
                                <input value={orgForm.short} onChange={(e) => setOrgForm((p) => ({ ...p, short: e.target.value }))} className={inp} placeholder="One line summary" />
                            </Field>
                            <Field label="Full description">
                                <textarea rows={4} value={orgForm.about} onChange={(e) => setOrgForm((p) => ({ ...p, about: e.target.value }))} className={inp} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Logo (emoji)">
                                    <input value={orgForm.logo} onChange={(e) => setOrgForm((p) => ({ ...p, logo: e.target.value }))} className={inp} placeholder="⚽" />
                                </Field>
                                <Field label="Cover image URL">
                                    <input value={orgForm.cover} onChange={(e) => setOrgForm((p) => ({ ...p, cover: e.target.value }))} className={inp} placeholder="https://" />
                                </Field>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Email" required>
                                    <input required type="email" value={orgForm.email} onChange={(e) => setOrgForm((p) => ({ ...p, email: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Phone">
                                    <input value={orgForm.phone} onChange={(e) => setOrgForm((p) => ({ ...p, phone: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Website">
                                <input type="url" value={orgForm.website} onChange={(e) => setOrgForm((p) => ({ ...p, website: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Facebook URL">
                                    <input value={orgForm.facebook} onChange={(e) => setOrgForm((p) => ({ ...p, facebook: e.target.value }))} className={inp} placeholder="https://facebook.com/…" />
                                </Field>
                                <Field label="Instagram URL">
                                    <input value={orgForm.instagram} onChange={(e) => setOrgForm((p) => ({ ...p, instagram: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="TikTok URL">
                                    <input value={orgForm.tiktok} onChange={(e) => setOrgForm((p) => ({ ...p, tiktok: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="LinkedIn URL">
                                    <input value={orgForm.linkedin} onChange={(e) => setOrgForm((p) => ({ ...p, linkedin: e.target.value }))} className={inp} />
                                </Field>
                            </div>
                            <Field label="Address">
                                <input value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Meeting / opening times">
                                <input value={orgForm.meeting} onChange={(e) => setOrgForm((p) => ({ ...p, meeting: e.target.value }))} className={inp} placeholder="e.g. Tuesdays 7pm" />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setOrgOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-org-submit" disabled={busy} onClick={createOrgQuick} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish organisation</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Venue */}
                <Dialog open={venueOpen} onOpenChange={setVenueOpen}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-left rounded-3xl border border-border bg-background p-4 hover:border-primary/50 transition-colors" data-testid="admin-quick-add-venue">
                            <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><MapPin className="h-4 w-4" /></div>
                            <div className="font-semibold mt-3">Add venue</div>
                            <p className="text-xs text-muted-foreground mt-1">Add a bookable venue to the Spaces to hire page.</p>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create venue</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                            <Field label="Name">
                                <input data-testid="qc-venue-name" value={venueForm.name} onChange={(e) => setVenueForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Address">
                                <input value={venueForm.address} onChange={(e) => setVenueForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                            </Field>
                            <Field label="Facilities (comma or newline separated)">
                                <textarea rows={2} value={venueForm.facilities} onChange={(e) => setVenueForm((p) => ({ ...p, facilities: e.target.value }))} className={inp} placeholder="Main hall, Kitchen, Outdoor pitches" />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <Field label="Capacity">
                                    <input type="number" min="0" value={venueForm.capacity} onChange={(e) => setVenueForm((p) => ({ ...p, capacity: e.target.value }))} className={inp} />
                                </Field>
                                <Field label="Accessibility">
                                    <input value={venueForm.accessibility} onChange={(e) => setVenueForm((p) => ({ ...p, accessibility: e.target.value }))} className={inp} placeholder="Step-free, hearing loop…" />
                                </Field>
                            </div>
                            <Field label="Booking (URL or mailto:)">
                                <input value={venueForm.booking} onChange={(e) => setVenueForm((p) => ({ ...p, booking: e.target.value }))} className={inp} placeholder="https:// or mailto:" />
                            </Field>
                            <Field label="Image URL">
                                <input value={venueForm.image} onChange={(e) => setVenueForm((p) => ({ ...p, image: e.target.value }))} className={inp} placeholder="https://" />
                            </Field>
                        </div>
                        <DialogFooter>
                            <button type="button" onClick={() => setVenueOpen(false)} className="px-4 py-2 rounded-full border border-border text-sm font-semibold">Cancel</button>
                            <button type="button" data-testid="qc-venue-submit" disabled={busy} onClick={createVenue} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">Publish venue</button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

// ─────────── Broadcast card ───────────
function BroadcastCard() {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);

    const send = async () => {
        if (!subject || !body) return toast.error("Subject and body needed");
        setBusy(true);
        try {
            const res = await api.broadcast({
                subject,
                html: `<div style="font-family:Helvetica,Arial;color:#0F172A;font-size:15px;line-height:1.5">${body.replace(/\n/g, "<br/>")}</div>`,
            });
            toast.success(`Broadcast queued — ${res.sent} sent${res.mocked ? " (mocked, add RESEND_API_KEY)" : ""}`);
            setSubject(""); setBody("");
        } catch {
            toast.error("Broadcast failed");
        } finally { setBusy(false); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-accent/10 text-accent grid place-items-center"><Send className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Ad-hoc broadcast</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Sends an email to every active subscriber. Unsubscribe link added automatically.</p>
            <input data-testid="broadcast-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="broadcast-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Your announcement…" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <button data-testid="broadcast-send" disabled={busy} onClick={send}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-xs disabled:opacity-60">
                <Send className="h-3.5 w-3.5" /> Send to all subscribers
            </button>
        </div>
    );
}

// ─────────── Newsletter card ───────────
function NewsletterCard({ orgs }) {
    const [subject, setSubject] = useState("Your Blackrod Now digest 📬");
    const [intro, setIntro] = useState("");
    const [audience, setAudience] = useState("subscribers");
    const [selectedOrgSlugs, setSelectedOrgSlugs] = useState([]);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    const toggleOrg = (slug) => {
        setSelectedOrgSlugs((current) => (
            current.includes(slug)
                ? current.filter((item) => item !== slug)
                : [...current, slug]
        ));
    };

    const previewIt = async () => {
        try {
            const res = await api.newsletterPreview();
            setPreview(res); setOpen(true);
        } catch { toast.error("Preview failed"); }
    };
    const send = async () => {
        if (audience === "orgs_selected" && !selectedOrgSlugs.length) {
            toast.error("Pick at least one organisation");
            return;
        }
        setBusy(true);
        try {
            const res = await api.sendNewsletter({
                subject,
                body_intro: intro,
                audience,
                org_slugs: audience === "orgs_selected" ? selectedOrgSlugs : [],
            });
            toast.success(`Newsletter sent — ${res.sent} delivered${res.mocked ? " (mocked)" : ""}`);
        } catch { toast.error("Send failed"); }
        finally { setBusy(false); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Mail className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Weekly newsletter</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Choose who to send to: digest subscribers, all organisations, or selected organisations.</p>
            <select
                data-testid="newsletter-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm"
            >
                <option value="subscribers">Subscribers (digest-enabled)</option>
                <option value="orgs_all">All organisations with email</option>
                <option value="orgs_selected">Selected organisations</option>
            </select>
            <input data-testid="newsletter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="newsletter-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder={audience === "subscribers" ? "Optional intro line…" : "Message for organisations…"} className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            {audience === "orgs_selected" && (
                <div className="mb-2 max-h-40 overflow-y-auto rounded-2xl border border-border bg-background p-2">
                    {orgs
                        .filter((org) => org.status !== "rejected")
                        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                        .map((org) => (
                            <label key={org.slug} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-xl hover:bg-muted text-sm">
                                <span className="truncate">{org.name}</span>
                                <input
                                    type="checkbox"
                                    checked={selectedOrgSlugs.includes(org.slug)}
                                    onChange={() => toggleOrg(org.slug)}
                                />
                            </label>
                        ))}
                </div>
            )}
            <div className="flex gap-2">
                <button data-testid="newsletter-preview" onClick={previewIt} className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-foreground font-semibold text-xs">
                    <Eye className="h-3.5 w-3.5" /> Preview
                </button>
                <button data-testid="newsletter-send" disabled={busy} onClick={send} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-60">
                    <Send className="h-3.5 w-3.5" /> Send newsletter
                </button>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Newsletter preview</DialogTitle></DialogHeader>
                    {preview && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-3">
                                Preview shown with no personalisation — real emails will be tailored per subscriber.
                                Matched events: <b>{preview.matched_events}</b>, updates: <b>{preview.matched_updates}</b>
                            </div>
                            <iframe title="preview" srcDoc={preview.html} className="w-full h-[500px] rounded-2xl border border-border" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─────────── Unified email centre ───────────
function AdminEmailCentre({ orgs, onChange }) {
    const [msgs, setMsgs] = useState([]);
    const [tab, setTab] = useState("inbox");
    const [expanded, setExpanded] = useState(null);
    const [reply, setReply] = useState({ id: null, body: "" });
    const [query, setQuery] = useState("");
    const [replyBusy, setReplyBusy] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [senders, setSenders] = useState([]);
    const [composeForm, setComposeForm] = useState({ to: "", subject: "", body: "", from_email: "", reply_to: "" });
    const [composeBusy, setComposeBusy] = useState(false);

    const loadMsgs = async () => { try { setMsgs(await api.adminMessages()); } catch { /* ignore */ } };

    useEffect(() => { loadMsgs(); }, []);
    useEffect(() => {
        api.adminEmailSenders()
            .then((r) => { setSenders(r.senders || []); setComposeForm((f) => ({ ...f, from_email: r.default || (r.senders || [])[0] || "" })); })
            .catch(() => {});
    }, []);

    // Clear selection when switching tabs
    useEffect(() => { setSelected(new Set()); }, [tab]);

    const inbox = msgs.filter((m) => m.direction !== "outbound_admin");
    const sent  = msgs.filter((m) => m.direction === "outbound_admin");
    const unread = inbox.filter((m) => !m.read).length;

    const needle = query.trim().toLowerCase();
    const visible = (tab === "inbox" ? inbox : sent).filter((m) => {
        if (!needle) return true;
        const h = `${m.from_org_slug || ""} ${m.from_name || ""} ${m.from_email || ""} ${m.to_email || ""} ${m.subject || ""} ${m.body || ""}`.toLowerCase();
        return h.includes(needle);
    });

    const toggleSelect = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    const selectAll = () => setSelected(new Set(visible.map((m) => m.id)));
    const clearSelection = () => setSelected(new Set());

    const bulkAction = async (action) => {
        const ids = [...selected];
        if (!ids.length) return;
        setBulkBusy(true);
        try {
            await api.bulkMessageAction(ids, action);
            if (action === "delete") {
                setMsgs((prev) => prev.filter((x) => !selected.has(x.id)));
                if (selected.has(expanded)) setExpanded(null);
            } else {
                setMsgs((prev) => prev.map((x) => selected.has(x.id) ? { ...x, read: true } : x));
            }
            setSelected(new Set());
            toast.success(`${action === "delete" ? "Deleted" : "Archived"} ${ids.length} message${ids.length === 1 ? "" : "s"}`);
            onChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Action failed");
        } finally {
            setBulkBusy(false);
        }
    };

    const markRead = async (id) => {
        await api.markMessageRead(id);
        setMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
        onChange?.();
    };

    const deleteMsg = async (id) => {
        try {
            await api.deleteAdminMessage(id);
            setMsgs((prev) => prev.filter((x) => x.id !== id));
            if (expanded === id) setExpanded(null);
            if (reply.id === id) setReply({ id: null, body: "" });
            onChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Could not delete message");
        }
    };

    const sendReply = async (msg) => {
        if (!reply.body.trim()) { toast.error("Reply is empty"); return; }
        setReplyBusy(true);
        try {
            await api.replyAdminMessage(msg.id, { body: reply.body.trim(), subject: `Re: ${msg.subject || "Message"}` });
            toast.success("Reply sent");
            setReply({ id: null, body: "" });
            await loadMsgs();
            onChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Reply failed");
        } finally {
            setReplyBusy(false);
        }
    };

    const openInCompose = (msg) => {
        setComposeForm((f) => ({
            ...f,
            to: msg.from_email || "",
            subject: `Re: ${msg.subject || "Message"}`,
            body: `\n\n---\nOn ${new Date(msg.created_at).toLocaleString("en-GB")}, ${msg.from_name || msg.from_email || "you"} wrote:\n${msg.body || ""}`,
        }));
        setTab("compose");
    };

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validCount = composeForm.to.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => emailRe.test(s)).length;

    const doComposeSend = async () => {
        if (!validCount) { toast.error("Add at least one valid recipient"); return; }
        if (!composeForm.subject.trim() || !composeForm.body.trim()) { toast.error("Subject and body are required"); return; }
        if (!window.confirm(`Send to ${validCount} recipient${validCount === 1 ? "" : "s"}?`)) return;
        setComposeBusy(true);
        try {
            const fd = new FormData();
            Object.entries(composeForm).forEach(([k, v]) => fd.append(k, v || ""));
            const r = await api.adminEmailSend(fd);
            if (r.ok) {
                toast.success(`Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}`);
                setComposeForm((f) => ({ ...f, to: "", subject: "", body: "" }));
                await loadMsgs();
                setTab("sent");
            } else {
                toast.error(`Sent ${r.sent}, failed ${r.failed}`);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Send failed");
        } finally {
            setComposeBusy(false);
        }
    };

    const cinp = "w-full px-3 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

    return (
        <div className="rounded-3xl border border-border bg-surface overflow-hidden" data-testid="admin-email-centre">
            {/* Tab bar */}
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 flex-wrap border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                        <Mail className="h-4 w-4" />
                    </div>
                    <h3 className="font-display font-bold text-lg">Email</h3>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button type="button" onClick={() => setTab("inbox")} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tab === "inbox" ? "bg-foreground text-background" : "bg-muted"}`}>
                        <Inbox className="h-3 w-3" /> Inbox
                        {unread > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{unread}</span>}
                    </button>
                    <button type="button" onClick={() => setTab("sent")} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tab === "sent" ? "bg-foreground text-background" : "bg-muted"}`}>
                        <Send className="h-3 w-3" /> Sent ({sent.length})
                    </button>
                    <button type="button" onClick={() => setTab("compose")} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tab === "compose" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}>
                        <Edit3 className="h-3 w-3" /> Compose
                    </button>
                    <button type="button" onClick={loadMsgs} title="Refresh" className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                    </button>
                </div>
            </div>

            <div className="p-5">
                {tab !== "compose" && (
                    <>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${tab}…`}
                            className="w-full mb-3 px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                        />
                        {visible.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">
                                {needle ? "No messages match your search." : tab === "inbox" ? "Inbox is empty." : "Nothing sent yet."}
                            </p>
                        ) : (
                            <>
                                {/* Bulk action toolbar */}
                                <div className="flex items-center gap-2 mb-2 min-h-[32px]">
                                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={selected.size > 0 && selected.size === visible.length}
                                            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < visible.length; }}
                                            onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                                            className="h-3.5 w-3.5 accent-primary"
                                        />
                                        {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                                    </label>
                                    {selected.size > 0 && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("archive")} className="px-3 py-1 rounded-full bg-muted text-xs font-semibold disabled:opacity-60 flex items-center gap-1">
                                                <Archive className="h-3 w-3" /> Archive
                                            </button>
                                            <button type="button" disabled={bulkBusy} onClick={() => bulkAction("delete")} className="px-3 py-1 rounded-full text-destructive border border-destructive/30 text-xs font-semibold disabled:opacity-60 flex items-center gap-1">
                                                <Trash2 className="h-3 w-3" /> Delete
                                            </button>
                                            <button type="button" onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground">
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-0.5">
                                    {visible.map((m) => {
                                        const isUnread = !m.read && m.direction !== "outbound_admin";
                                        const isOpen = expanded === m.id;
                                        const isSelected = selected.has(m.id);
                                        return (
                                            <div key={m.id} data-testid={`msg-${m.id}`} className={`rounded-2xl border transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : isUnread ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                                                <div className="px-4 py-3 flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(m.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-3.5 w-3.5 shrink-0 accent-primary"
                                                    />
                                                    <button type="button" onClick={() => setExpanded(isOpen ? null : m.id)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                                                        <span className={`h-2 w-2 rounded-full shrink-0 ${isUnread ? "bg-primary" : "bg-transparent"}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-semibold text-sm truncate">
                                                                    {m.direction === "outbound_admin"
                                                                        ? `To: ${m.to_email || m.to_org_slug || "—"}`
                                                                        : (m.from_name || m.from_org_slug || m.from_email || "Unknown")}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground shrink-0">
                                                                    {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-0.5 truncate">{m.subject || "(no subject)"}</div>
                                                        </div>
                                                    </button>
                                                </div>

                                            {isOpen && (
                                                <div className="border-t border-border px-4 pb-4 pt-3">
                                                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                                                        {m.from_email && <div>From: {m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email}</div>}
                                                        {m.to_email && <div>To: {m.to_email}</div>}
                                                        {m.in_reply_to && <div className="text-primary">↩ In reply to a notification</div>}
                                                        {m.delivery?.ok === false && <div className="text-destructive">Delivery failed: {m.delivery.error || "unknown"}</div>}
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>

                                                    <div className="flex flex-wrap items-center gap-2 mt-4">
                                                        {m.direction !== "outbound_admin" && m.from_email && (
                                                            <>
                                                                <button type="button" onClick={() => setReply((r) => (r.id === m.id ? { id: null, body: "" } : { id: m.id, body: "" }))} className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                                                    Reply
                                                                </button>
                                                                <button type="button" onClick={() => openInCompose(m)} className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold">
                                                                    Open in compose
                                                                </button>
                                                            </>
                                                        )}
                                                        {isUnread && (
                                                            <button type="button" onClick={() => markRead(m.id)} className="px-3 py-1.5 rounded-full bg-muted text-xs font-semibold">
                                                                Mark read
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={() => deleteMsg(m.id)} className="ml-auto px-3 py-1.5 rounded-full text-destructive border border-destructive/30 text-xs font-semibold flex items-center gap-1">
                                                            <Trash2 className="h-3 w-3" /> Delete
                                                        </button>
                                                    </div>

                                                    {reply.id === m.id && (
                                                        <div className="mt-3 space-y-2">
                                                            <textarea
                                                                rows={4}
                                                                value={reply.body}
                                                                onChange={(e) => setReply((r) => ({ ...r, body: e.target.value }))}
                                                                placeholder="Write your reply…"
                                                                className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button type="button" onClick={() => sendReply(m)} disabled={replyBusy} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60">
                                                                    {replyBusy ? "Sending…" : "Send reply"}
                                                                </button>
                                                                <button type="button" onClick={() => setReply({ id: null, body: "" })} className="px-4 py-2 rounded-full border border-border text-xs font-semibold">
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            </>
                        )}
                    </>
                )}

                {tab === "compose" && (
                    <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                                <select value={composeForm.from_email} onChange={(e) => setComposeForm((f) => ({ ...f, from_email: e.target.value }))} className={cinp}>
                                    {senders.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reply-to (optional)</span>
                                <input type="email" value={composeForm.reply_to} onChange={(e) => setComposeForm((f) => ({ ...f, reply_to: e.target.value }))} className={cinp} placeholder="admin@example.com" />
                            </label>
                        </div>

                        {/* Quick-add an org's contact email to the To field */}
                        {orgs?.some((o) => o.email) && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Quick add org</span>
                                <select
                                    onChange={(e) => {
                                        const o = orgs.find((x) => x.slug === e.target.value);
                                        if (o?.email) setComposeForm((f) => ({ ...f, to: f.to ? `${f.to}, ${o.email}` : o.email }));
                                        e.target.value = "";
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-2xl border border-border bg-background text-xs"
                                >
                                    <option value="">Select an organisation…</option>
                                    {[...orgs].filter((o) => o.email).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((o) => (
                                        <option key={o.slug} value={o.slug}>{o.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                To — comma-separated · <b>{validCount}</b> valid
                            </span>
                            <textarea rows={2} value={composeForm.to} onChange={(e) => setComposeForm((f) => ({ ...f, to: e.target.value }))} className={cinp} placeholder="email@example.com, another@example.com" />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</span>
                            <input value={composeForm.subject} onChange={(e) => setComposeForm((f) => ({ ...f, subject: e.target.value }))} className={cinp} />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message</span>
                            <textarea rows={9} value={composeForm.body} onChange={(e) => setComposeForm((f) => ({ ...f, body: e.target.value }))} className={cinp} placeholder="Write your message…" />
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={doComposeSend} disabled={composeBusy} className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
                                <Send className="h-4 w-4" /> {composeBusy ? "Sending…" : `Send${validCount ? ` to ${validCount}` : ""}`}
                            </button>
                            <button type="button" onClick={() => setComposeForm((f) => ({ ...f, to: "", subject: "", body: "" }))} className="px-5 py-2.5 rounded-full border border-border text-sm font-semibold">
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SubscribersCard() {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");
    const [includeUnsubscribed, setIncludeUnsubscribed] = useState(false);
    const [digestOnly, setDigestOnly] = useState(false);
    const [summary, setSummary] = useState({ total_active: 0, total_digest: 0 });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setBusy(true);
        try {
            const result = await api.adminSubscribers({
                q: query,
                include_unsubscribed: includeUnsubscribed,
                digest_only: digestOnly,
                limit: 300,
            });
            setItems(result.items || []);
            setSummary({ total_active: result.total_active || 0, total_digest: result.total_digest || 0 });
        } catch {
            toast.error("Could not load subscribers");
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-accent/15 text-accent-foreground grid place-items-center"><Users className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Subscribers</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">View newsletter subscribers and their follow profile.</p>
            <div className="text-xs text-muted-foreground mb-2">
                Active: <b className="text-foreground">{summary.total_active}</b> · Digest enabled: <b className="text-foreground">{summary.total_digest}</b>
            </div>
            <div className="grid gap-2 mb-3">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by email..."
                    className="w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                />
                <div className="flex items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={digestOnly} onChange={(e) => setDigestOnly(e.target.checked)} />
                        Digest only
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={includeUnsubscribed} onChange={(e) => setIncludeUnsubscribed(e.target.checked)} />
                        Include unsubscribed
                    </label>
                    <button
                        type="button"
                        onClick={load}
                        disabled={busy}
                        className="ml-auto px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
                    >
                        {busy ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
                {items.length === 0 && <p className="text-sm text-muted-foreground">No subscribers found.</p>}
                {items.map((sub) => (
                    <div key={sub.id} className="rounded-2xl border border-border bg-background p-3">
                        <div className="text-sm font-semibold truncate">{sub.email}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>Digest: {sub.digest ? "Yes" : "No"}</span>
                            <span>Status: {sub.unsubscribed ? "Unsubscribed" : "Active"}</span>
                            <span>Followed orgs: {sub.followed_orgs_count || 0}</span>
                            <span>Categories: {sub.followed_categories_count || 0}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────── Notify specific org ───────────
function NotifyOrgCard({ orgs }) {
    const [slug, setSlug] = useState(orgs[0]?.slug || "");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");

    useEffect(() => { if (!slug && orgs.length) setSlug(orgs[0].slug); }, [orgs, slug]);

    const send = async () => {
        if (!slug || !title) return toast.error("Pick an organisation and give it a title");
        try {
            const result = await api.sendNotification({ org_slug: slug, title, body, send_email: true });
            if (result?.email_delivery?.ok) {
                toast.success("Notification and email sent");
            } else if (result?.email_delivery && !result?.email_delivery?.ok) {
                toast.error("In-app notification sent, but email failed");
            } else {
                toast.success("Notification sent (no org email on record)");
            }
            setTitle(""); setBody("");
        } catch { toast.error("Failed"); }
    };

    return (
        <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Bell className="h-4 w-4" /></div>
                <h3 className="font-display font-bold">Notify an organisation</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Appears in their dashboard bell and also emails the organisation when an email address is on file.</p>
            <select data-testid="notify-org" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm">
                {orgs.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
            </select>
            <input data-testid="notify-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <textarea data-testid="notify-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message…" className="w-full mb-2 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
            <button data-testid="notify-send" onClick={send} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                <Send className="h-3.5 w-3.5" /> Send notification
            </button>
        </div>
    );
}

function ScheduledBroadcastsCard() {
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
    const [previewBusy, setPreviewBusy] = useState(false);
    const [form, setForm] = useState({ to: "", subject: "", body: "", scheduled_for: "" });
    const [previewTo, setPreviewTo] = useState(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem("blackrod_preview_to") || "";
    });

    const load = async () => {
        try {
            setItems(await api.listScheduledBroadcasts());
        } catch { /* noop */ }
    };

    useEffect(() => { load(); }, []);

    const submit = async () => {
        if (!form.to || !form.subject || !form.body || !form.scheduled_for) {
            return toast.error("Recipients, subject, body and send time are required");
        }
        setBusy(true);
        try {
            // Convert `datetime-local` (naive) → ISO UTC (backend expects timezone-aware ISO)
            const isoLocal = form.scheduled_for.length === 16 ? `${form.scheduled_for}:00` : form.scheduled_for;
            const iso = new Date(isoLocal).toISOString();
            await api.scheduleBroadcast({ ...form, scheduled_for: iso });
            toast.success("Broadcast scheduled");
            setForm({ to: "", subject: "", body: "", scheduled_for: "" });
            await load();
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not schedule broadcast");
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (id) => {
        try {
            await api.cancelScheduledBroadcast(id);
            toast.success("Cancelled");
            await load();
        } catch (error) {
            toast.error("Could not cancel");
        }
    };

    const sendPreview = async () => {
        if (!form.subject.trim() || !form.body.trim()) {
            return toast.error("Add a subject and body before previewing");
        }
        if (!previewTo.trim()) {
            return toast.error("Enter your email address to receive the preview");
        }
        setPreviewBusy(true);
        try {
            const res = await api.previewBroadcast({
                subject: form.subject,
                body: form.body,
                preview_to: previewTo.trim(),
            });
            localStorage.setItem("blackrod_preview_to", previewTo.trim());
            toast.success(
                res.mocked
                    ? `Preview simulated to ${previewTo} (add RESEND_API_KEY to actually send)`
                    : `Preview sent to ${previewTo}`,
                { description: "Check your inbox before scheduling the real send." }
            );
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not send preview");
        } finally {
            setPreviewBusy(false);
        }
    };

    return (
        <div data-testid="scheduled-broadcasts-card" className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display font-black text-xl">Scheduled broadcasts</h2>
                    <p className="text-sm text-muted-foreground mt-1">Write on Tuesday, send Friday 8am. Time is local.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">{items.filter((i) => i.status === "scheduled").length} pending</span>
            </div>

            <div className="mt-4 grid gap-2">
                <input data-testid="sched-to" value={form.to} onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))} placeholder="Recipients (comma-separated emails)" className="px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                <input data-testid="sched-subject" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject" className="px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                <textarea data-testid="sched-body" rows={3} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} placeholder="Message body" className="px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                <div className="flex gap-2">
                    <input data-testid="sched-when" type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm((p) => ({ ...p, scheduled_for: e.target.value }))} className="flex-1 px-3 py-2 rounded-2xl border border-border bg-background text-sm" />
                    <button type="button" data-testid="sched-submit" disabled={busy} onClick={submit} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider disabled:opacity-60">
                        Schedule
                    </button>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-primary">
                        Send preview to just me first
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Get a copy in your own inbox before it goes to the full list — catches typos, broken links, and rogue merge fields.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <input
                            type="email"
                            data-testid="sched-preview-to"
                            value={previewTo}
                            onChange={(e) => setPreviewTo(e.target.value)}
                            placeholder="your.email@blackrodnow.co.uk"
                            className="flex-1 min-w-[220px] px-3 py-2 rounded-2xl border border-border bg-background text-sm"
                        />
                        <button
                            type="button"
                            data-testid="sched-preview-send"
                            onClick={sendPreview}
                            disabled={previewBusy}
                            className="px-4 py-2 rounded-full border-2 border-primary text-primary text-xs font-black uppercase tracking-wider hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
                        >
                            {previewBusy ? "Sending…" : "Send preview to me"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">No broadcasts scheduled.</p>}
                {items.map((b) => (
                    <div key={b.id} data-testid={`sched-item-${b.id}`} className="rounded-2xl border border-border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{b.subject}</div>
                                <div className="text-xs text-muted-foreground truncate">To: {b.to}</div>
                                <div className="text-[11px] uppercase tracking-wider mt-1">
                                    <span className={`px-2 py-0.5 rounded-full ${b.status === "scheduled" ? "bg-blue-500/10 text-blue-600" : b.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : b.status === "cancelled" ? "bg-slate-500/10 text-slate-600" : "bg-red-500/10 text-red-600"}`}>{b.status}</span>
                                    <span className="ml-2 text-muted-foreground">{new Date(b.scheduled_for).toLocaleString("en-GB")}</span>
                                </div>
                            </div>
                            {b.status === "scheduled" && (
                                <button type="button" data-testid={`sched-cancel-${b.id}`} onClick={() => cancel(b.id)} className="text-[11px] uppercase tracking-wider font-semibold text-red-600 hover:underline">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ModerationQueueCard() {
    const [items, setItems] = useState([]);
    const [statusFilter, setStatusFilter] = useState("open");
    const [loading, setLoading] = useState(false);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            setItems(await api.listReports(statusFilter));
        } catch { /* noop */ } finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    const resolve = async (id, action) => {
        try {
            await api.resolveReport(id, { status: action, resolution: null });
            toast.success(action === "actioned" ? "Marked as actioned" : "Report dismissed");
            await load();
        } catch (error) {
            toast.error("Could not resolve report");
        }
    };

    return (
        <div data-testid="moderation-card" className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-display font-black text-xl">Moderation queue</h2>
                    <p className="text-sm text-muted-foreground mt-1">Reports from residents about listings that need attention.</p>
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-full border border-border bg-background text-xs">
                    <option value="open">Open ({items.filter((i) => i.status === "open").length})</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="actioned">Actioned</option>
                    <option value="all">All</option>
                </select>
            </div>

            <div className="mt-4 space-y-2">
                {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
                {!loading && items.length === 0 && <p className="text-xs text-muted-foreground">No reports.</p>}
                {items.map((r) => (
                    <div key={r.id} data-testid={`moderation-item-${r.id}`} className="rounded-2xl border border-border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider font-black text-[10px]">{r.kind}</span>
                                    <span className="text-muted-foreground truncate">{r.target_id}</span>
                                </div>
                                <div className="text-sm font-semibold mt-1">Reason: {r.reason}</div>
                                {r.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.notes}</div>}
                                <div className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("en-GB")}</div>
                            </div>
                            {r.status === "open" && (
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button type="button" data-testid={`moderation-actioned-${r.id}`} onClick={() => resolve(r.id, "actioned")} className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">Actioned</button>
                                    <button type="button" data-testid={`moderation-dismiss-${r.id}`} onClick={() => resolve(r.id, "dismissed")} className="px-3 py-1 rounded-full border border-border text-[11px] font-semibold">Dismiss</button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

