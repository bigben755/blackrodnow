// Thin axios-based API client for Blackrod Now.
import axios from "axios";
import { getDeviceId } from "./device";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, timeout: 30000 });

export const api = {
    // Meta
    stats: () => client.get("/admin/stats").then((r) => r.data),
    isSeeded: () => client.get("/admin/seeded").then((r) => r.data),
    seed: (payload, force = false) =>
        client.post("/admin/seed", payload, { params: { force } }).then((r) => r.data),

    // Organisations
    orgs: (opts = {}) => client.get("/organisations", { params: opts }).then((r) => r.data),
    org: (slug) => client.get(`/organisations/${slug}`).then((r) => r.data),
    submitOrg: (data) => client.post("/organisations", data).then((r) => r.data),
    patchOrg: (slug, patch) => client.patch(`/organisations/${slug}`, patch).then((r) => r.data),
    setOrgStatus: (slug, status) =>
        client.post(`/admin/organisations/${slug}/status`, { status }).then((r) => r.data),
    deleteOrg: (slug) => client.delete(`/admin/organisations/${slug}`).then((r) => r.data),

    // Events
    events: (opts = {}) => client.get("/events", { params: opts }).then((r) => r.data),
    event: (id) => client.get(`/events/${id}`).then((r) => r.data),
    createEvent: (data) => client.post("/events", data).then((r) => r.data),
    setEventStatus: (id, status) =>
        client.post(`/admin/events/${id}/status`, { status }).then((r) => r.data),
    featureEvent: (id) => client.post(`/admin/events/${id}/feature`).then((r) => r.data),
    deleteEvent: (id) => client.delete(`/admin/events/${id}`).then((r) => r.data),

    // Feed
    feed: () => client.get("/feed").then((r) => r.data),
    createFeedPost: (data) => client.post("/feed", data).then((r) => r.data),

    // Venues & volunteers
    venues: () => client.get("/venues").then((r) => r.data),
    volunteers: () => client.get("/volunteers").then((r) => r.data),

    // Follows (device-based)
    follows: () => client.get(`/follows/${getDeviceId()}`).then((r) => r.data),
    toggleFollow: (kind, value, action = "add") =>
        client.post("/follows", { device_id: getDeviceId(), kind, value, action }).then((r) => r.data),

    // Subscribers
    subscribe: (email, prefs = {}) =>
        client.post("/subscribe", { email, device_id: getDeviceId(), ...prefs }).then((r) => r.data),
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
    adminMessages: () => client.get("/admin/messages").then((r) => r.data),
    markMessageRead: (id) => client.patch(`/admin/messages/${id}/read`).then((r) => r.data),

    // Documents
    listDocs: (slug) => client.get(`/organisations/${slug}/documents`).then((r) => r.data),
    uploadDoc: (slug, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post(`/organisations/${slug}/documents`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 120000,
            })
            .then((r) => r.data);
    },
    deleteDoc: (slug, id) =>
        client.delete(`/organisations/${slug}/documents/${id}`).then((r) => r.data),
    docDownloadUrl: (id) => `${API}/documents/${id}/download`,

    // AI parse (multi-item)
    parseContent: (text) => client.post("/parse-content", { text }).then((r) => r.data),

    // Newsletter & broadcast
    newsletterPreview: (email) =>
        client.get("/admin/newsletter/preview", { params: email ? { email } : {} }).then((r) => r.data),
    sendNewsletter: (data) => client.post("/admin/newsletter/send", data).then((r) => r.data),
    broadcast: (data) => client.post("/admin/broadcast", data).then((r) => r.data),

    // Facebook (mocked)
    fbConnect: (slug, data) =>
        client.post(`/organisations/${slug}/facebook/connect`, data).then((r) => r.data),
    fbDisconnect: (slug) =>
        client.post(`/organisations/${slug}/facebook/disconnect`).then((r) => r.data),
    fbPublish: (slug, data) =>
        client.post(`/organisations/${slug}/facebook/publish`, data).then((r) => r.data),
};
