// Thin axios-based API client for Blackrod Now.
import axios from "axios";
import { getDeviceId } from "./device";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export { API };

const ORG_TOKEN_KEY = "rn-org-tokens";
const ADMIN_CODE_KEY = "rn-admin-code";
const ADMIN_JWT_KEY = "rn-admin-jwt";

// ─────────────────────────────────────────────────────────────
// Bulk parser reliability settings
// ─────────────────────────────────────────────────────────────

// Creating a parse job includes uploading files to the backend.
// Give slower connections plenty of time to complete the upload.
// The backend should still return the job ID quickly after upload.
const PARSE_JOB_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Polling a job should normally return very quickly, but a longer timeout
// prevents temporary backend/database delays from breaking the importer.
const PARSE_JOB_STATUS_TIMEOUT_MS = 60 * 1000; // 60 seconds

// A temporary network failure while checking progress should not kill
// an otherwise healthy bulk import.
const PARSE_JOB_STATUS_RETRIES = 3;

// Small delay between status-request retries.
const PARSE_JOB_RETRY_DELAY_MS = 1500;

const sleep = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

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

const readAdminJwt = () =>
    typeof window !== "undefined"
        ? localStorage.getItem(ADMIN_JWT_KEY) || ""
        : "";

const orgAuthHeaders = (slug) => {
    const token = readOrgTokens()[slug];

    const adminCode =
        typeof window !== "undefined"
            ? localStorage.getItem(ADMIN_CODE_KEY) || ""
            : "";

    const adminJwt = readAdminJwt();

    const headers = {};

    if (adminJwt) {
        headers["X-Org-Auth"] = `Bearer ${adminJwt}`;
    } else if (token) {
        headers["X-Org-Auth"] = token;
    }

    if (adminCode) {
        headers["X-Admin-Code"] = adminCode;
    }

    return headers;
};

const adminCodeHeaders = () => {
    const adminCode =
        typeof window !== "undefined"
            ? localStorage.getItem(ADMIN_CODE_KEY) || ""
            : "";

    return adminCode
        ? {
              "X-Admin-Code": adminCode,
          }
        : {};
};

// Standard API client.
//
// Normal requests should still fail reasonably quickly.
// Long-running document operations override this where appropriate.
const client = axios.create({
    baseURL: API,
    timeout: 30000,
});

// Attach admin JWT to every request when present.
//
// Backend routes that do not require it simply ignore it.
// This allows JWT-first admin authentication without having to manually
// add the Authorization header to every individual API method.
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

// ─────────────────────────────────────────────────────────────
// Bulk parser helpers
// ─────────────────────────────────────────────────────────────

const normaliseFileArray = (files) => {
    if (!files) return [];

    if (Array.isArray(files)) {
        return files.filter(Boolean);
    }

    try {
        return Array.from(files).filter(Boolean);
    } catch {
        return [];
    }
};

const normaliseStringArray = (values) => {
    if (!Array.isArray(values)) return [];

    return values
        .map((value) => String(value || "").trim())
        .filter(Boolean);
};

const buildParseFormData = (
    files,
    sourceOrgSlug = "",
    options = {}
) => {
    const cleanFiles = normaliseFileArray(files);
    const links = normaliseStringArray(options.links);
    const textBlocks = normaliseStringArray(options.textBlocks);

    if (
        cleanFiles.length === 0 &&
        links.length === 0 &&
        textBlocks.length === 0
    ) {
        throw new Error(
            "Please add at least one document, link or block of pasted text."
        );
    }

    const fd = new FormData();

    cleanFiles.forEach((file) => {
        fd.append("files", file);
    });

    const cleanOrgSlug = String(sourceOrgSlug || "").trim();

    if (cleanOrgSlug) {
        fd.append("source_org_slug", cleanOrgSlug);
    }

    if (links.length > 0) {
        fd.append("urls_json", JSON.stringify(links));
    }

    if (textBlocks.length > 0) {
        fd.append("texts_json", JSON.stringify(textBlocks));
    }

    return {
        formData: fd,
        total:
            cleanFiles.length +
            links.length +
            textBlocks.length,
    };
};

const isTransientParserError = (error) => {
    if (!error) return false;

    // Axios did not receive an HTTP response.
    // This generally means timeout, temporary network failure,
    // dropped connection, DNS issue, reverse proxy interruption, etc.
    if (!error.response) {
        return true;
    }

    const status = Number(error.response?.status || 0);

    // Retry temporary server/gateway/rate-limit failures.
    if (status === 408) return true;
    if (status === 425) return true;
    if (status === 429) return true;

    if (status >= 500 && status <= 599) {
        return true;
    }

    return false;
};

const getAxiosErrorMessage = (
    error,
    fallback = "Something went wrong"
) => {
    const backendDetail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error;

    if (backendDetail) {
        return String(backendDetail);
    }

    if (error?.code === "ECONNABORTED") {
        return "The request took too long to respond.";
    }

    if (error?.message) {
        return String(error.message);
    }

    return fallback;
};

export const api = {
    // ─────────────────────────────────────────────────────────
    // Auth (JWT)
    // ─────────────────────────────────────────────────────────

    authLoginAdmin: (email, password) =>
        client
            .post("/auth/admin/login", {
                email,
                password,
            })
            .then((r) => r.data),

    authMe: () =>
        client
            .get("/auth/me")
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Site settings
    // ─────────────────────────────────────────────────────────

    getSiteSettings: () =>
        client
            .get("/site/settings")
            .then((r) => r.data),

    updateSiteSettings: (patch) =>
        client
            .post("/admin/site/settings", patch)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Impact dashboard
    // ─────────────────────────────────────────────────────────

    impactSummary: (days = 90) =>
        client
            .get("/admin/impact/summary", {
                params: {
                    days,
                },
            })
            .then((r) => r.data),

    setGrantConfig: (patch) =>
        client
            .post("/admin/impact/grant-config", patch)
            .then((r) => r.data),

    impactPdfUrl: (days = 90, variant = "full") => {
        const jwt =
            typeof window !== "undefined"
                ? localStorage.getItem("rn-admin-jwt") || ""
                : "";

        return `${API}/admin/impact/pdf?days=${days}&variant=${variant}${
            jwt
                ? `&token=${encodeURIComponent(jwt)}`
                : ""
        }`;
    },

    // ─────────────────────────────────────────────────────────
    // Batch C: organisation power tools
    // ─────────────────────────────────────────────────────────

    duplicateEvent: (eventId) =>
        client
            .post(`/events/${eventId}/duplicate`)
            .then((r) => r.data),

    eventPosterPngUrl: (eventId) =>
        `${API}/events/${eventId}/poster.png`,

    eventPosterPdfUrl: (eventId) =>
        `${API}/events/${eventId}/poster.pdf`,

    eventSocialBundle: (
        eventId,
        {
            tone = "friendly",
            ai = false,
        } = {}
    ) =>
        client
            .get(`/events/${eventId}/social-bundle`, {
                params: {
                    tone,
                    ai,
                },
            })
            .then((r) => r.data),

    orgAnalyticsSeries: (slug, days = 30) =>
        client
            .get(`/orgs/${slug}/analytics`, {
                params: {
                    days,
                },
            })
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Batch D: scheduled broadcasts + moderation
    // ─────────────────────────────────────────────────────────

    scheduleBroadcast: (payload) =>
        client
            .post("/admin/broadcasts/schedule", payload)
            .then((r) => r.data),

    listScheduledBroadcasts: () =>
        client
            .get("/admin/broadcasts/scheduled")
            .then((r) => r.data),

    cancelScheduledBroadcast: (id) =>
        client
            .delete(`/admin/broadcasts/scheduled/${id}`)
            .then((r) => r.data),

    previewBroadcast: (payload) =>
        client
            .post("/admin/broadcasts/preview", payload)
            .then((r) => r.data),

    submitReport: (payload) =>
        client
            .post("/reports", payload)
            .then((r) => r.data),

    listReports: (status = "open") =>
        client
            .get("/admin/reports", {
                params: {
                    status,
                },
            })
            .then((r) => r.data),

    resolveReport: (id, payload) =>
        client
            .post(`/admin/reports/${id}/resolve`, payload)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Meta
    // ─────────────────────────────────────────────────────────

    stats: () =>
        client
            .get("/admin/stats")
            .then((r) => r.data),

    isSeeded: () =>
        client
            .get("/admin/seeded")
            .then((r) => r.data),

    seed: (payload, force = false) =>
        client
            .post("/admin/seed", payload, {
                params: {
                    force,
                },
            })
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Organisations
    // ─────────────────────────────────────────────────────────

    orgs: (opts = {}) =>
        client
            .get("/organisations", {
                params: opts,
            })
            .then((r) => r.data),

    org: (slug) =>
        client
            .get(`/organisations/${slug}`)
            .then((r) => r.data),

    loginOrgAccess: (slug, payload) =>
        client
            .post(
                `/organisations/${slug}/auth/login`,
                payload
            )
            .then((r) => r.data),

    verifyOrgPassword: (slug, password) =>
        client
            .post(
                `/organisations/${slug}/password/verify`,
                {
                    password,
                }
            )
            .then((r) => r.data),

    changeOrgPassword: (slug, data) =>
        client
            .post(
                `/organisations/${slug}/password/change`,
                data,
                {
                    headers: adminCodeHeaders(),
                }
            )
            .then((r) => r.data),

    adminResetOrgPassword: (slug, data) =>
        client
            .post(
                `/admin/organisations/${slug}/password/reset`,
                data
            )
            .then((r) => r.data),

    adminImpersonateOrg: (slug) =>
        client
            .post(
                `/admin/organisations/${slug}/impersonate`,
                {
                    admin_code:
                        typeof window !== "undefined"
                            ? localStorage.getItem(
                                  ADMIN_CODE_KEY
                              ) || ""
                            : "",
                }
            )
            .then((r) => r.data),

    submitOrg: (data) =>
        client
            .post("/organisations", data)
            .then((r) => r.data),

    patchOrg: (slug, patch) =>
        client
            .patch(
                `/organisations/${slug}`,
                patch,
                {
                    headers: orgAuthHeaders(slug),
                }
            )
            .then((r) => r.data),

    claimOrg: (slug, data) =>
        client
            .post(`/organisations/${slug}/claim`, data)
            .then((r) => r.data),

    suggestOrgEdits: (slug, data) =>
        client
            .post(
                `/organisations/${slug}/suggest-edits`,
                data
            )
            .then((r) => r.data),

    setOrgStatus: (slug, status) =>
        client
            .post(
                `/admin/organisations/${slug}/status`,
                {
                    status,
                }
            )
            .then((r) => r.data),

    adminCreateOrg: (data) =>
        client
            .post("/admin/organisations", data)
            .then((r) => r.data),

    adminOrgLifecycle: (slug, payload) =>
        client
            .post(
                `/admin/organisations/${slug}/lifecycle`,
                payload
            )
            .then((r) => r.data),

    adminAssignOrgAdmins: (slug, payload) =>
        client
            .post(
                `/admin/organisations/${slug}/assign-admins`,
                payload
            )
            .then((r) => r.data),

    adminTransferOrgOwnership: (slug, payload) =>
        client
            .post(
                `/admin/organisations/${slug}/transfer-ownership`,
                payload
            )
            .then((r) => r.data),

    adminInviteOrgClaim: (slug, payload) =>
        client
            .post(
                `/admin/organisations/${slug}/invite-claim`,
                payload
            )
            .then((r) => r.data),

    adminOrgClaimInvites: (status = "") =>
        client
            .get("/admin/org-claim-invites", {
                params: status
                    ? {
                          status,
                      }
                    : {},
            })
            .then((r) => r.data),

    adminOrgMembers: (slug) =>
        client
            .get(
                `/admin/organisations/${slug}/members`
            )
            .then((r) => r.data),

    adminInviteOrgMember: (slug, payload) =>
        client
            .post(
                `/admin/organisations/${slug}/members/invite`,
                payload
            )
            .then((r) => r.data),

    adminResendMemberInvite: (inviteId) =>
        client
            .post(
                `/admin/member-invites/${inviteId}/resend`
            )
            .then((r) => r.data),

    adminResetMemberInvite: (inviteId) =>
        client
            .post(
                `/admin/member-invites/${inviteId}/reset`
            )
            .then((r) => r.data),

    adminMemberInvites: (status = "") =>
        client
            .get("/admin/member-invites", {
                params: status
                    ? {
                          status,
                      }
                    : {},
            })
            .then((r) => r.data),

    adminSetOrgMemberRole: (
        slug,
        memberId,
        payload
    ) =>
        client
            .post(
                `/admin/organisations/${slug}/members/${memberId}/role`,
                payload
            )
            .then((r) => r.data),

    adminSuspendOrgMember: (
        slug,
        memberId,
        payload
    ) =>
        client
            .post(
                `/admin/organisations/${slug}/members/${memberId}/suspend`,
                payload
            )
            .then((r) => r.data),

    adminRemoveOrgMember: (slug, memberId) =>
        client
            .delete(
                `/admin/organisations/${slug}/members/${memberId}`
            )
            .then((r) => r.data),

    adminOrgsWithoutAdmins: () =>
        client
            .get("/admin/organisations/without-admins")
            .then((r) => r.data),

    adminMergeOrgs: (payload) =>
        client
            .post("/admin/organisations/merge", payload)
            .then((r) => r.data),

    deleteOrg: (slug) =>
        client
            .delete(`/admin/organisations/${slug}`)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    events: (opts = {}) =>
        client
            .get("/events", {
                params: opts,
            })
            .then((r) => r.data),

    event: (id) =>
        client
            .get(`/events/${id}`)
            .then((r) => r.data),

    createEvent: (data) =>
        client
            .post("/events", data, {
                headers: orgAuthHeaders(data.orgSlug),
            })
            .then((r) => r.data),

    updateEvent: (
        id,
        patch,
        orgSlugForAuth
    ) =>
        client
            .patch(`/events/${id}`, patch, {
                headers: orgAuthHeaders(
                    orgSlugForAuth ||
                        patch?.orgSlug
                ),
            })
            .then((r) => r.data),

    setEventStatus: (id, status) =>
        client
            .post(
                `/admin/events/${id}/status`,
                {
                    status,
                }
            )
            .then((r) => r.data),

    featureEvent: (id) =>
        client
            .post(`/admin/events/${id}/feature`)
            .then((r) => r.data),

    deleteEvent: (id) =>
        client
            .delete(`/admin/events/${id}`)
            .then((r) => r.data),

    adminEventsAttention: () =>
        client
            .get("/admin/events/attention")
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Site admin management
    // ─────────────────────────────────────────────────────────

    taxonomy: () =>
        client
            .get("/taxonomy")
            .then((r) => r.data),

    updateTaxonomy: (patch) =>
        client
            .post("/admin/taxonomy", patch)
            .then((r) => r.data),

    adminUsersOverview: (q = "") =>
        client
            .get("/admin/users", {
                params: q
                    ? {
                          q,
                      }
                    : {},
            })
            .then((r) => r.data),

    adminAuditLog: (limit = 200) =>
        client
            .get("/admin/audit-log", {
                params: {
                    limit,
                },
            })
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Feed
    // ─────────────────────────────────────────────────────────

    feed: () =>
        client
            .get("/feed")
            .then((r) => r.data),

    createFeedPost: (data) =>
        client
            .post("/feed", data, {
                headers: orgAuthHeaders(data.orgSlug),
            })
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Venues & volunteers
    // ─────────────────────────────────────────────────────────

    venues: () =>
        client
            .get("/venues")
            .then((r) => r.data),

    createVenue: (data) =>
        client
            .post("/venues", data)
            .then((r) => r.data),

    updateVenue: (id, patch) =>
        client
            .patch(`/venues/${id}`, patch)
            .then((r) => r.data),

    volunteers: () =>
        client
            .get("/volunteers")
            .then((r) => r.data),

    createVolunteer: (data) =>
        client
            .post("/volunteers", data)
            .then((r) => r.data),

    updateVolunteer: (id, patch) =>
        client
            .patch(`/volunteers/${id}`, patch)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Follows
    // ─────────────────────────────────────────────────────────

    follows: () =>
        client
            .get(`/follows/${getDeviceId()}`)
            .then((r) => r.data),

    toggleFollow: (
        kind,
        value,
        action = "add"
    ) =>
        client
            .post("/follows", {
                device_id: getDeviceId(),
                kind,
                value,
                action,
            })
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Subscribers
    // ─────────────────────────────────────────────────────────

    subscribe: (email, prefs = {}) => {
        let saved_events;

        try {
            const raw =
                typeof window !== "undefined"
                    ? localStorage.getItem(
                          "rn-saved-events"
                      )
                    : null;

            saved_events = raw
                ? JSON.parse(raw)
                : undefined;

            if (!Array.isArray(saved_events)) {
                saved_events = undefined;
            }
        } catch {
            saved_events = undefined;
        }

        if (typeof window !== "undefined") {
            localStorage.setItem(
                "rn-subscriber-email",
                email
            );
        }

        return client
            .post("/subscribe", {
                email,
                device_id: getDeviceId(),
                saved_events,
                ...prefs,
            })
            .then((r) => r.data);
    },

    syncSavedEvents: (payload) =>
        client
            .post(
                "/subscribers/saved-events",
                payload
            )
            .then((r) => r.data),

    unsubscribe: (token) =>
        client
            .post(`/unsubscribe/${token}`)
            .then((r) => r.data),

    preferences: (token) =>
        client
            .get(`/preferences/${token}`)
            .then((r) => r.data),

    updatePreferences: (token, patch) =>
        client
            .patch(
                `/preferences/${token}`,
                patch
            )
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Notifications
    // ─────────────────────────────────────────────────────────

    orgNotifications: (slug) =>
        client
            .get(
                `/organisations/${slug}/notifications`
            )
            .then((r) => r.data),

    sendNotification: (data) =>
        client
            .post("/admin/notifications", data)
            .then((r) => r.data),

    markNotificationRead: (id) =>
        client
            .patch(`/notifications/${id}/read`)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Contact / messages
    // ─────────────────────────────────────────────────────────

    contactAdmin: (data) =>
        client
            .post("/contact-admin", data)
            .then((r) => r.data),

    redeemOrgMemberInvite: (payload) =>
        client
            .post(
                "/organisations/member-invites/redeem",
                payload
            )
            .then((r) => r.data),

    loginOrgMember: (payload) =>
        client
            .post(
                "/organisations/member/login",
                payload
            )
            .then((r) => r.data),

    webWizardEnquiry: (data) =>
        client
            .post("/web-wizard/enquiry", data)
            .then((r) => r.data),

    notificationThread: (nid) =>
        client
            .get(`/notifications/${nid}/thread`)
            .then((r) => r.data),

    adminMessages: () =>
        client
            .get("/admin/messages")
            .then((r) => r.data),

    markMessageRead: (id) =>
        client
            .patch(`/admin/messages/${id}/read`)
            .then((r) => r.data),

    deleteAdminMessage: (id) =>
        client
            .delete(`/admin/messages/${id}`)
            .then((r) => r.data),

    bulkMessageAction: (ids, action) =>
        client
            .post("/admin/messages/bulk", {
                ids,
                action,
            })
            .then((r) => r.data),

    replyAdminMessage: (id, data) =>
        client
            .post(
                `/admin/messages/${id}/reply`,
                data
            )
            .then((r) => r.data),

    adminSubscribers: (params = {}) =>
        client
            .get("/admin/subscribers", {
                params,
            })
            .then((r) => r.data),

    orgEditRequests: (status = "") =>
        client
            .get("/admin/org-edit-requests", {
                params: status
                    ? {
                          status,
                      }
                    : {},
            })
            .then((r) => r.data),

    reviewOrgEditRequest: (id, data) =>
        client
            .post(
                `/admin/org-edit-requests/${id}/status`,
                data
            )
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Documents
    // ─────────────────────────────────────────────────────────

    listDocs: (slug) =>
        client
            .get(
                `/organisations/${slug}/documents`
            )
            .then((r) => r.data),

    uploadDoc: (slug, file) => {
        const fd = new FormData();

        fd.append("file", file);

        return client
            .post(
                `/organisations/${slug}/documents`,
                fd,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                        ...orgAuthHeaders(slug),
                    },

                    timeout: 120000,
                }
            )
            .then((r) => r.data);
    },

    // Legacy direct parser endpoint.
    //
    // Retained for backward compatibility, but the Blackrod Now bulk
    // uploader should prefer createParseJob() + getParseJob().
    adminParseDocuments: (
        files,
        sourceOrgSlug = "",
        options = {}
    ) => {
        const {
            formData,
        } = buildParseFormData(
            files,
            sourceOrgSlug,
            options
        );

        return client
            .post(
                "/admin/documents/parse",
                formData,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                    },

                    // Direct parsing can legitimately take longer,
                    // although the queued parser should be preferred.
                    timeout: PARSE_JOB_UPLOAD_TIMEOUT_MS,
                }
            )
            .then((r) => r.data);
    },

    // ─────────────────────────────────────────────────────────
    // Durable bulk parser
    // ─────────────────────────────────────────────────────────

    createParseJob: async (
        files,
        sourceOrgSlug = "",
        options = {}
    ) => {
        const {
            formData,
            total,
        } = buildParseFormData(
            files,
            sourceOrgSlug,
            options
        );

        try {
            /*
             * IMPORTANT:
             *
             * Do NOT automatically retry this POST request.
             *
             * If the backend successfully created the job but the
             * HTTP response was lost, retrying could create the same
             * bulk import twice.
             *
             * The future Admin page upgrade will persist the returned
             * job ID and reconnect to existing jobs safely.
             */
            const response = await client.post(
                "/admin/documents/parse-jobs",
                formData,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                    },

                    timeout: PARSE_JOB_UPLOAD_TIMEOUT_MS,
                }
            );

            const data = response.data || {};

            if (!data.job_id) {
                throw new Error(
                    "The parser accepted the upload but did not return a job ID."
                );
            }

            return {
                ...data,

                // Provide a sensible total if an older backend does
                // not return one.
                total:
                    data.total ??
                    data.total_sources ??
                    total,
            };
        } catch (error) {
            if (
                error?.message ===
                "The parser accepted the upload but did not return a job ID."
            ) {
                throw error;
            }

            const message = getAxiosErrorMessage(
                error,
                "Could not create the bulk import job."
            );

            const wrapped = new Error(message);

            wrapped.originalError = error;

            throw wrapped;
        }
    },

    getParseJob: async (jobId) => {
        const cleanJobId = String(
            jobId || ""
        ).trim();

        if (!cleanJobId) {
            throw new Error(
                "No parser job ID was supplied."
            );
        }

        const safeJobId =
            encodeURIComponent(cleanJobId);

        let lastError = null;

        for (
            let attempt = 0;
            attempt <=
            PARSE_JOB_STATUS_RETRIES;
            attempt += 1
        ) {
            try {
                const response =
                    await client.get(
                        `/admin/documents/parse-jobs/${safeJobId}`,
                        {
                            timeout:
                                PARSE_JOB_STATUS_TIMEOUT_MS,
                        }
                    );

                return response.data;
            } catch (error) {
                lastError = error;

                const canRetry =
                    isTransientParserError(error);

                const hasRetriesLeft =
                    attempt <
                    PARSE_JOB_STATUS_RETRIES;

                if (
                    !canRetry ||
                    !hasRetriesLeft
                ) {
                    break;
                }

                // Slight progressive delay:
                // 1.5s → 3s → 4.5s
                await sleep(
                    PARSE_JOB_RETRY_DELAY_MS *
                        (attempt + 1)
                );
            }
        }

        const message = getAxiosErrorMessage(
            lastError,
            "Could not check the parser job."
        );

        const wrapped = new Error(message);

        wrapped.originalError = lastError;

        throw wrapped;
    },

    // ─────────────────────────────────────────────────────────
    // Public "Submit your events list" (deterministic parse only)
    // ─────────────────────────────────────────────────────────

    publicParseEventList: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return client
            .post("/public/event-list/parse", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 60000,
            })
            .then((r) => r.data);
    },

    publicSubmitEventList: (payload) =>
        client.post("/public/event-list/submit", payload).then((r) => r.data),

    adminCheckEntity: (kind, id) =>
        client.post("/admin/check", { kind, id }, { timeout: 160000 }).then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Event image upload
    // ─────────────────────────────────────────────────────────

    uploadEventImage: (file) => {
        const fd = new FormData();

        fd.append("file", file);

        return client
            .post(
                "/uploads/event-image",
                fd,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                    },

                    timeout: 60000,
                }
            )
            .then((r) => ({
                ...r.data,

                absoluteUrl:
                    `${process.env.REACT_APP_BACKEND_URL}${r.data.url}`,
            }));
    },

    deleteDoc: (slug, id) =>
        client
            .delete(
                `/organisations/${slug}/documents/${id}`,
                {
                    headers:
                        orgAuthHeaders(slug),
                }
            )
            .then((r) => r.data),

    docDownloadUrl: (id) =>
        `${API}/documents/${id}/download`,

    // ─────────────────────────────────────────────────────────
    // Organisation logo & cover images
    // ─────────────────────────────────────────────────────────

    uploadOrgLogo: (slug, file) => {
        const fd = new FormData();

        fd.append("file", file);

        return client
            .post(
                `/organisations/${slug}/logo`,
                fd,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                        ...orgAuthHeaders(slug),
                    },

                    timeout: 60000,
                }
            )
            .then((r) => r.data);
    },

    uploadOrgCover: (slug, file) => {
        const fd = new FormData();

        fd.append("file", file);

        return client
            .post(
                `/organisations/${slug}/cover`,
                fd,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                        ...orgAuthHeaders(slug),
                    },

                    timeout: 60000,
                }
            )
            .then((r) => r.data);
    },

    deleteOrgLogo: (slug) =>
        client
            .delete(
                `/organisations/${slug}/logo`,
                {
                    headers:
                        orgAuthHeaders(slug),
                }
            )
            .then((r) => r.data),

    deleteOrgCover: (slug) =>
        client
            .delete(
                `/organisations/${slug}/cover`,
                {
                    headers:
                        orgAuthHeaders(slug),
                }
            )
            .then((r) => r.data),

    orgLogoUrl: (
        slug,
        thumb = false,
        v = ""
    ) =>
        `${API}/organisations/${slug}/logo${
            thumb
                ? "/thumb"
                : ""
        }${
            v
                ? `?v=${v}`
                : ""
        }`,

    orgCoverUrl: (slug, v = "") =>
        `${API}/organisations/${slug}/cover${
            v
                ? `?v=${v}`
                : ""
        }`,

    // ─────────────────────────────────────────────────────────
    // AI parse — standalone text parser
    // ─────────────────────────────────────────────────────────

    parseContent: (text) =>
        client
            .post(
                "/parse-content",
                {
                    text,
                },
                {
                    timeout: 120000,
                }
            )
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Newsletter & broadcast
    // ─────────────────────────────────────────────────────────

    newsletterPreview: (email) =>
        client
            .get(
                "/admin/newsletter/preview",
                {
                    params: email
                        ? {
                              email,
                          }
                        : {},
                }
            )
            .then((r) => r.data),

    sendNewsletter: (data) =>
        client
            .post(
                "/admin/newsletter/send",
                data
            )
            .then((r) => r.data),

    broadcast: (data) =>
        client
            .post("/admin/broadcast", data)
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Analytics
    // ─────────────────────────────────────────────────────────

    trackAnalytics: (payload) =>
        client
            .post("/analytics/track", {
                ...payload,
                device_id: getDeviceId(),
            })
            .then((r) => r.data),

    orgAnalytics: (slug) =>
        client
            .get(
                `/organisations/${slug}/analytics`
            )
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Admin free-form email
    // ─────────────────────────────────────────────────────────

    adminEmailSenders: () =>
        client
            .get("/admin/email/senders")
            .then((r) => r.data),

    adminEmailPreview: (data) =>
        client
            .post(
                "/admin/email/preview",
                data,
                {
                    timeout: 120000,
                }
            )
            .then((r) => r.data),

    adminEmailSend: (data) =>
        client
            .post(
                "/admin/email/send",
                data,
                {
                    timeout: 120000,
                }
            )
            .then((r) => r.data),

    // ─────────────────────────────────────────────────────────
    // Share pack
    // ─────────────────────────────────────────────────────────

    getSharePack: (slug) =>
        client
            .get(
                `/organisations/${slug}/share-pack`
            )
            .then((r) => r.data),

    emailSharePack: (slug, to) =>
        client
            .post(
                `/organisations/${slug}/share-pack/email`,
                to
                    ? {
                          to,
                      }
                    : {},
                {
                    headers:
                        orgAuthHeaders(slug),
                }
            )
            .then((r) => r.data),
};