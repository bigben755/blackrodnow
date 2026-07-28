// Thin axios-based API client for Blackrod Now.
import axios from "axios";
import { getDeviceId } from "./device";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export { API };

const ORG_TOKEN_KEY = "rn-org-tokens";
const ADMIN_CODE_KEY = "rn-admin-code";
const ADMIN_JWT_KEY = "rn-admin-jwt";

const readOrgTokens = () => {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem(ORG_TOKEN_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const readAdminJwt = () => (typeof window !== "undefined" ? (localStorage.getItem(ADMIN_JWT_KEY) || "") : "");

const orgAuthHeaders = (slug) => {
    const token = readOrgTokens()[slug];
    const adminCode = typeof window !== "undefined" ? (localStorage.getItem(ADMIN_CODE_KEY) || "") : "";
    const adminJwt = readAdminJwt();
    const headers = {};
    if (adminJwt) headers["X-Org-Auth"] = `Bearer ${adminJwt}`;
    else if (token) headers["X-Org-Auth"] = token;
    if (adminCode) headers["X-Admin-Code"] = adminCode;
    return headers;
};

const adminCodeHeaders = () => {
    const adminCode = typeof window !== "undefined" ? (localStorage.getItem(ADMIN_CODE_KEY) || "") : "";
    return adminCode ? { "X-Admin-Code": adminCode } : {};
};

const client = axios.create({ baseURL: API, timeout: 30000 });

// Attach admin JWT to every request when present (backend routes that don't
// need it will simply ignore it). This lets us move to JWT-first auth without
// touching every method.
client.interceptors.request.use((config) => {
    const jwt = readAdminJwt();
    if (jwt) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${jwt}`;
        }
    }
    return config;
});

export const api = {
    // Auth (JWT)
    authLoginAdmin: (email, password) =>
        client.post("/auth/admin/login", { email, password }).then((r) => r.data),
    authMe: () => client.get("/auth/me").then((r) => r.data),

    // Site settings (coming-soon gate)
    getSiteSettings: () => client.get("/site/settings").then((r) => r.data),
    updateSiteSettings: (patch) =>
        client.post("/admin/site/settings", patch).then((r) => r.data),

    // Impact dashboard (funder)
    impactSummary: (days = 90) =>
        client.get("/admin/impact/summary", { params: { days } }).then((r) => r.data),
    setGrantConfig: (patch) =>
        client.post("/admin/impact/grant-config", patch).then((r) => r.data),
    impactPdfUrl: (days = 90, variant = "full") => {
        const jwt = typeof window !== "undefined" ? (localStorage.getItem("rn-admin-jwt") || "") : "";
        return `${API}/admin/impact/pdf?days=${days}&variant=${variant}${jwt ? `&token=${encodeURIComponent(jwt)}` : ""}`;
    },

    // Batch C: Org power tools
    duplicateEvent: (eventId) =>
        client.post(`/events/${eventId}/duplicate`).then((r) => r.data),
    eventPosterPngUrl: (eventId) => `${API}/events/${eventId}/poster.png`,
    eventPosterPdfUrl: (eventId) => `${API}/events/${eventId}/poster.pdf`,
    eventSocialBundle: (eventId, { tone = "friendly", ai = false } = {}) =>
        client
            .get(`/events/${eventId}/social-bundle`, { params: { tone, ai } })
            .then((r) => r.data),
    orgAnalyticsSeries: (slug, days = 30) =>
        client.get(`/orgs/${slug}/analytics`, { params: { days } }).then((r) => r.data),

    // Batch D: Scheduled broadcasts + moderation
    scheduleBroadcast: (payload) =>
        client.post("/admin/broadcasts/schedule", payload).then((r) => r.data),
    listScheduledBroadcasts: () =>
        client.get("/admin/broadcasts/scheduled").then((r) => r.data),
    cancelScheduledBroadcast: (id) =>
        client.delete(`/admin/broadcasts/scheduled/${id}`).then((r) => r.data),
    previewBroadcast: (payload) =>
        client.post("/admin/broadcasts/preview", payload).then((r) => r.data),
    submitReport: (payload) =>
        client.post("/reports", payload).then((r) => r.data),
    listReports: (status = "open") =>
        client.get("/admin/reports", { params: { status } }).then((r) => r.data),
    resolveReport: (id, payload) =>
        client.post(`/admin/reports/${id}/resolve`, payload).then((r) => r.data),

    // Meta
    stats: () => client.get("/admin/stats").then((r) => r.data),
    isSeeded: () => client.get("/admin/seeded").then((r) => r.data),
    seed: (payload, force = false) =>
        client.post("/admin/seed", payload, { params: { force } }).then((r) => r.data),

    // Organisations
    orgs: (opts = {}) => client.get("/organisations", { params: opts }).then((r) => r.data),
    org: (slug) => client.get(`/organisations/${slug}`).then((r) => r.data),
    loginOrgAccess: (slug, payload) =>
        client.post(`/organisations/${slug}/auth/login`, payload).then((r) => r.data),
    verifyOrgPassword: (slug, password) =>
        client.post(`/organisations/${slug}/password/verify`, { password }).then((r) => r.data),
    changeOrgPassword: (slug, data) =>
        client.post(`/organisations/${slug}/password/change`, data, { headers: adminCodeHeaders() }).then((r) => r.data),
    adminResetOrgPassword: (slug, data) =>
        client.post(`/admin/organisations/${slug}/password/reset`, data).then((r) => r.data),
    adminImpersonateOrg: (slug) =>
        client.post(`/admin/organisations/${slug}/impersonate`, {
            // Fallback body param — the axios interceptor also adds Authorization Bearer <admin-jwt>.
            admin_code: (typeof window !== "undefined" ? (localStorage.getItem(ADMIN_CODE_KEY) || "") : ""),
        }).then((r) => r.data),
    submitOrg: (data) => client.post("/organisations", data).then((r) => r.data),
    patchOrg: (slug, patch) => client.patch(`/organisations/${slug}`, patch, { headers: orgAuthHeaders(slug) }).then((r) => r.data),
    claimOrg: (slug, data) => client.post(`/organisations/${slug}/claim`, data).then((r) => r.data),
    suggestOrgEdits: (slug, data) => client.post(`/organisations/${slug}/suggest-edits`, data).then((r) => r.data),
    setOrgStatus: (slug, status) =>
        client.post(`/admin/organisations/${slug}/status`, { status }).then((r) => r.data),
    deleteOrg: (slug) => client.delete(`/admin/organisations/${slug}`).then((r) => r.data),

    // Events
    events: (opts = {}) => client.get("/events", { params: opts }).then((r) => r.data),
    event: (id) => client.get(`/events/${id}`).then((r) => r.data),
    createEvent: (data) => client.post("/events", data, { headers: orgAuthHeaders(data.orgSlug) }).then((r) => r.data),
    updateEvent: (id, patch, orgSlugForAuth) => client.patch(`/events/${id}`, patch, { headers: orgAuthHeaders(orgSlugForAuth || patch?.orgSlug) }).then((r) => r.data),
    setEventStatus: (id, status) =>
        client.post(`/admin/events/${id}/status`, { status }).then((r) => r.data),
    featureEvent: (id) => client.post(`/admin/events/${id}/feature`).then((r) => r.data),
    deleteEvent: (id) => client.delete(`/admin/events/${id}`).then((r) => r.data),

    // Feed
    feed: () => client.get("/feed").then((r) => r.data),
    createFeedPost: (data) => client.post("/feed", data, { headers: orgAuthHeaders(data.orgSlug) }).then((r) => r.data),

    // Venues & volunteers
    venues: () => client.get("/venues").then((r) => r.data),
    createVenue: (data) => client.post("/venues", data).then((r) => r.data),
    updateVenue: (id, patch) => client.patch(`/venues/${id}`, patch).then((r) => r.data),
    volunteers: () => client.get("/volunteers").then((r) => r.data),
    createVolunteer: (data) => client.post("/volunteers", data).then((r) => r.data),
    updateVolunteer: (id, patch) => client.patch(`/volunteers/${id}`, patch).then((r) => r.data),

    // Follows (device-based)
    follows: () => client.get(`/follows/${getDeviceId()}`).then((r) => r.data),
    toggleFollow: (kind, value, action = "add") =>
        client.post("/follows", { device_id: getDeviceId(), kind, value, action }).then((r) => r.data),

    // Subscribers
    subscribe: (email, prefs = {}) => {
        // Auto-attach locally-saved event ids so reminder emails "just work"
        // once the visitor gives us an email.
        let saved_events;
        try {
            const raw = typeof window !== "undefined" ? localStorage.getItem("rn-saved-events") : null;
            saved_events = raw ? JSON.parse(raw) : undefined;
            if (!Array.isArray(saved_events)) saved_events = undefined;
        } catch { saved_events = undefined; }
        if (typeof window !== "undefined") localStorage.setItem("rn-subscriber-email", email);
        return client.post("/subscribe", { email, device_id: getDeviceId(), saved_events, ...prefs }).then((r) => r.data);
    },
    syncSavedEvents: (payload) =>
        client.post("/subscribers/saved-events", payload).then((r) => r.data),
    unsubscribe: (token) => client.post(`/unsubscribe/${token}`).then((r) => r.data),
    preferences: (token) => client.get(`/preferences/${token}`).then((r) => r.data),
    updatePreferences: (token, patch) =>
        client.patch(`/preferences/${token}`, patch).then((r) => r.data),

    // Notifications (admin → org)
    orgNotifications: (slug) =>
        client.get(`/organisations/${slug}/notifications`).then((r) => r.data),
    sendNotification: (data) => client.post("/admin/notifications", data).then((r) => r.data),
    markNotificationRead: (id) => client.patch(`/notifications/${id}/read`).then((r) => r.data),

    // Contact admin
    contactAdmin: (data) => client.post("/contact-admin", data).then((r) => r.data),
    webWizardEnquiry: (data) => client.post("/web-wizard/enquiry", data).then((r) => r.data),
    notificationThread: (nid) => client.get(`/notifications/${nid}/thread`).then((r) => r.data),
    adminMessages: () => client.get("/admin/messages").then((r) => r.data),
    markMessageRead: (id) => client.patch(`/admin/messages/${id}/read`).then((r) => r.data),
    orgEditRequests: (status = "") => client.get("/admin/org-edit-requests", { params: status ? { status } : {} }).then((r) => r.data),
    reviewOrgEditRequest: (id, data) => client.post(`/admin/org-edit-requests/${id}/status`, data).then((r) => r.data),

    // Documents
    listDocs: (slug) => client.get(`/organisations/${slug}/documents`).then((r) => r.data),
    uploadDoc: (slug, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post(`/organisations/${slug}/documents`, fd, {
                headers: { "Content-Type": "multipart/form-data", ...orgAuthHeaders(slug) },
                timeout: 120000,
            })
            .then((r) => r.data);
    },
    adminParseDocuments: (files, sourceOrgSlug = "", options = {}) => {
        const fd = new FormData();
        files.forEach((file) => fd.append("files", file));
        if (sourceOrgSlug) fd.append("source_org_slug", sourceOrgSlug);
        if (options.links?.length) fd.append("urls_json", JSON.stringify(options.links));
        if (options.textBlocks?.length) fd.append("texts_json", JSON.stringify(options.textBlocks));
        return client
            .post("/admin/documents/parse", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 120000,
            })
            .then((r) => r.data);
    },
    createParseJob: (files, sourceOrgSlug = "", options = {}) => {
        const fd = new FormData();
        files.forEach((file) => fd.append("files", file));
        if (sourceOrgSlug) fd.append("source_org_slug", sourceOrgSlug);
        if (options.links?.length) fd.append("urls_json", JSON.stringify(options.links));
        if (options.textBlocks?.length) fd.append("texts_json", JSON.stringify(options.textBlocks));
        return client
            .post("/admin/documents/parse-jobs", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 120000,
            })
            .then((r) => r.data);
    },
    getParseJob: (jobId) => client.get(`/admin/documents/parse-jobs/${jobId}`).then((r) => r.data),
    uploadEventImage: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post("/uploads/event-image", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 60000,
            })
            .then((r) => ({ ...r.data, absoluteUrl: `${process.env.REACT_APP_BACKEND_URL}${r.data.url}` }));
    },
    deleteDoc: (slug, id) =>
        client.delete(`/organisations/${slug}/documents/${id}`, { headers: orgAuthHeaders(slug) }).then((r) => r.data),
    docDownloadUrl: (id) => `${API}/documents/${id}/download`,

    // Org logo & cover images
    uploadOrgLogo: (slug, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post(`/organisations/${slug}/logo`, fd, {
                headers: { "Content-Type": "multipart/form-data", ...orgAuthHeaders(slug) },
                timeout: 60000,
            })
            .then((r) => r.data);
    },
    uploadOrgCover: (slug, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post(`/organisations/${slug}/cover`, fd, {
                headers: { "Content-Type": "multipart/form-data", ...orgAuthHeaders(slug) },
                timeout: 60000,
            })
            .then((r) => r.data);
    },
    deleteOrgLogo: (slug) => client.delete(`/organisations/${slug}/logo`, { headers: orgAuthHeaders(slug) }).then((r) => r.data),
    deleteOrgCover: (slug) => client.delete(`/organisations/${slug}/cover`, { headers: orgAuthHeaders(slug) }).then((r) => r.data),
    orgLogoUrl: (slug, thumb = false, v = "") =>
        `${API}/organisations/${slug}/logo${thumb ? "/thumb" : ""}${v ? `?v=${v}` : ""}`,
    orgCoverUrl: (slug, v = "") => `${API}/organisations/${slug}/cover${v ? `?v=${v}` : ""}`,

    // AI parse (multi-item)
    parseContent: (text) => client.post("/parse-content", { text }).then((r) => r.data),

    // Newsletter & broadcast
    newsletterPreview: (email) =>
        client.get("/admin/newsletter/preview", { params: email ? { email } : {} }).then((r) => r.data),
    sendNewsletter: (data) => client.post("/admin/newsletter/send", data).then((r) => r.data),
    broadcast: (data) => client.post("/admin/broadcast", data).then((r) => r.data),

    // Analytics
    trackAnalytics: (payload) =>
        client.post("/analytics/track", { ...payload, device_id: getDeviceId() }).then((r) => r.data),
    orgAnalytics: (slug) => client.get(`/organisations/${slug}/analytics`).then((r) => r.data),

    // Admin free-form email compose
    adminEmailSenders: () => client.get("/admin/email/senders").then((r) => r.data),
    adminEmailPreview: (data) => client.post("/admin/email/preview", data, { timeout: 120000 }).then((r) => r.data),
    adminEmailSend: (data) => client.post("/admin/email/send", data, { timeout: 120000 }).then((r) => r.data),

    // Share pack
    getSharePack: (slug) => client.get(`/organisations/${slug}/share-pack`).then((r) => r.data),
    emailSharePack: (slug, to) =>
        client.post(`/organisations/${slug}/share-pack/email`, to ? { to } : {}, { headers: orgAuthHeaders(slug) }).then((r) => r.data),
};
