import React from "react";
import {
    Activity,
    Building2,
    Database,
    Mail,
    Settings2,
    ShieldCheck,
    Users,
} from "lucide-react";
import Admin from "@/pages/Admin";
import AdminControlCentre from "@/components/AdminControlCentre";
import AdminContentManager from "@/components/AdminContentManager";
import AdminAccuracyCentre from "@/components/AdminAccuracyCentre";
import AdminCommunications from "@/components/AdminCommunications";
import AdminClaimsCentre from "@/components/AdminClaimsCentre";
import AdminOrganisationOverview from "@/components/AdminOrganisationOverview";

const TABS = [
    { key: "control", label: "Control centre", icon: Activity },
    { key: "content", label: "Content", icon: Database },
    { key: "organisations", label: "Organisations", icon: Users },
    { key: "accuracy", label: "Accuracy", icon: ShieldCheck },
    { key: "messages", label: "Messages", icon: Mail },
    { key: "claims", label: "Claims", icon: Building2 },
    { key: "advanced", label: "Advanced", icon: Settings2 },
];

export default function AdminWorkspace({
    version = 0,
    pendingEventCount = 0,
    pendingClaimCount = 0,
    unreadMessageCount = 0,
}) {
    const [activeTab, setActiveTab] = React.useState(
        () => localStorage.getItem("bn-admin-workspace-tab") || "control"
    );
    const [contentStatus, setContentStatus] = React.useState("");
    const [organisationFilter, setOrganisationFilter] = React.useState("");
    const [messageOrgSlug, setMessageOrgSlug] = React.useState("");
    const [messageMode, setMessageMode] = React.useState("");
    const [accuracyEventId, setAccuracyEventId] = React.useState("");

    React.useEffect(() => {
        localStorage.setItem("bn-admin-workspace-tab", activeTab);
    }, [activeTab]);

    const openContent = (status = "") => {
        setContentStatus(status);
        setActiveTab("content");
    };

    const openOrganisations = (filter = "all") => {
        setOrganisationFilter(filter || "all");
        setActiveTab("organisations");
    };

    const openMessages = (mode = "single", slug = "") => {
        setMessageMode(mode);
        setMessageOrgSlug(slug);
        setActiveTab("messages");
    };

    const openMessagesForOrg = (slug) => openMessages("single", slug || "");

    const openAccuracyForEvent = (eventId) => {
        setAccuracyEventId(eventId || "");
        setActiveTab("accuracy");
    };

    return (
        <div className="pb-16">
            <section className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                        <div>
                            <div className="text-[10px] uppercase font-black tracking-[0.22em] text-primary">
                                Blackrod Now · Site administration
                            </div>
                            <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight mt-1">
                                Admin workspace
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                Manage content, credibility, communications and organisation access from one place.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                            {pendingEventCount > 0 && (
                                <button type="button" onClick={() => openContent("pending")} className="px-3 py-1.5 rounded-full border border-blue-300 bg-blue-50 text-blue-950 font-semibold">
                                    {pendingEventCount} event{pendingEventCount === 1 ? "" : "s"} awaiting review
                                </button>
                            )}
                            {pendingClaimCount > 0 && (
                                <button type="button" onClick={() => setActiveTab("claims")} className="px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-950 font-semibold">
                                    {pendingClaimCount} claim{pendingClaimCount === 1 ? "" : "s"} awaiting review
                                </button>
                            )}
                            {unreadMessageCount > 0 && (
                                <button type="button" onClick={() => openMessages("inbox")} className="px-3 py-1.5 rounded-full border border-border bg-muted font-semibold">
                                    {unreadMessageCount} unread message{unreadMessageCount === 1 ? "" : "s"}
                                </button>
                            )}
                        </div>
                    </div>

                    <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Admin sections">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const badge = tab.key === "content"
                                ? pendingEventCount
                                : tab.key === "claims"
                                    ? pendingClaimCount
                                    : tab.key === "messages"
                                        ? unreadMessageCount
                                        : 0;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold border transition ${
                                        activeTab === tab.key
                                            ? "bg-foreground text-background border-foreground"
                                            : "bg-surface border-border hover:bg-muted"
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                    {badge > 0 && (
                                        <span className={`min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[10px] ${
                                            activeTab === tab.key ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
                                        }`}>
                                            {badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </section>

            {activeTab === "control" && (
                <AdminControlCentre
                    pendingEventCount={pendingEventCount}
                    pendingClaimCount={pendingClaimCount}
                    unreadMessageCount={unreadMessageCount}
                    onOpenContent={openContent}
                    onOpenAccuracy={() => setActiveTab("accuracy")}
                    onOpenMessages={(mode) => openMessages(mode)}
                    onOpenClaims={() => setActiveTab("claims")}
                    onOpenOrganisations={openOrganisations}
                    onOpenAdvanced={() => setActiveTab("advanced")}
                />
            )}
            {activeTab === "content" && (
                <AdminContentManager
                    initialStatus={contentStatus}
                    onInitialStatusHandled={() => setContentStatus("")}
                    onMessageOrg={openMessagesForOrg}
                    onCheckEvent={openAccuracyForEvent}
                />
            )}
            {activeTab === "organisations" && (
                <AdminOrganisationOverview
                    onMessageOrg={openMessagesForOrg}
                    initialFilter={organisationFilter}
                    onInitialFilterHandled={() => setOrganisationFilter("")}
                />
            )}
            {activeTab === "accuracy" && (
                <AdminAccuracyCentre
                    focusEventId={accuracyEventId}
                    onFocusHandled={() => setAccuracyEventId("")}
                />
            )}
            {activeTab === "messages" && (
                <AdminCommunications
                    initialOrgSlug={messageOrgSlug}
                    initialMode={messageMode}
                    onInitialOrgHandled={() => { setMessageOrgSlug(""); setMessageMode(""); }}
                />
            )}
            {activeTab === "claims" && <AdminClaimsCentre />}
            {activeTab === "advanced" && (
                <div>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                            <strong>Advanced tools.</strong> This is the existing full admin screen, retained intact for quick-create, broadcasts, subscribers, users, taxonomy, audit history and specialist controls. Day-to-day content, messaging, accuracy and claims are tidier in the tabs above.
                        </div>
                    </div>
                    <Admin key={version} />
                </div>
            )}
        </div>
    );
}
