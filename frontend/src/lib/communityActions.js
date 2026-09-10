import axios from "axios";
import { API } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

let feedLikeStatesPromise = null;

const adminHeaders = () => {
    if (typeof window === "undefined") return {};

    const jwt = localStorage.getItem("rn-admin-jwt") || "";
    const adminCode = localStorage.getItem("rn-admin-code") || "";
    const headers = {};

    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    if (adminCode) headers["X-Admin-Code"] = adminCode;

    return headers;
};

export const getFeedLikeStates = async ({ force = false } = {}) => {
    if (!force && feedLikeStatesPromise) return feedLikeStatesPromise;

    const deviceId = getDeviceId();

    feedLikeStatesPromise = axios
        .get(`${API}/feed/like-states/${encodeURIComponent(deviceId)}`)
        .then((response) => response.data?.states || {})
        .catch((error) => {
            feedLikeStatesPromise = null;
            throw error;
        });

    return feedLikeStatesPromise;
};

export const getFeedLikeState = async (postId) => {
    const states = await getFeedLikeStates();

    return states?.[postId] || {
        liked: false,
        likes: 0,
    };
};

export const toggleFeedLike = async (postId, action) => {
    const response = await axios.post(
        `${API}/feed/${encodeURIComponent(postId)}/like`,
        {
            device_id: getDeviceId(),
            action,
        },
    );

    feedLikeStatesPromise = null;

    return response.data;
};

export const sendVolunteerDashboardEnquiry = async (
    volunteerId,
    payload,
) => {
    const response = await axios.post(
        `${API}/volunteers/${encodeURIComponent(volunteerId)}/contact`,
        payload,
    );

    return response.data;
};

export const deleteVenueAdmin = async (venueId) => {
    const response = await axios.delete(
        `${API}/admin/venues/${encodeURIComponent(venueId)}`,
        {
            headers: adminHeaders(),
        },
    );

    return response.data;
};

export const deleteVolunteerAdmin = async (volunteerId) => {
    const response = await axios.delete(
        `${API}/admin/volunteers/${encodeURIComponent(volunteerId)}`,
        {
            headers: adminHeaders(),
        },
    );

    return response.data;
};

export const deleteOrganisationCascadeAdmin = async (slug) => {
    const response = await axios.delete(
        `${API}/admin/community/organisations/${encodeURIComponent(slug)}`,
        {
            headers: adminHeaders(),
        },
    );

    return response.data;
};

export const archiveEventAdmin = async (eventId) => {
    const response = await axios.post(
        `${API}/admin/community/events/${encodeURIComponent(eventId)}/archive`,
        {},
        { headers: adminHeaders() },
    );

    return response.data;
};

export const restoreEventAdmin = async (eventId) => {
    const response = await axios.post(
        `${API}/admin/community/events/${encodeURIComponent(eventId)}/restore`,
        {},
        { headers: adminHeaders() },
    );

    return response.data;
};

export const getAdminOrganisationContacts = async () => {
    const response = await axios.get(
        `${API}/admin/community/org-contacts`,
        { headers: adminHeaders() },
    );

    return response.data?.organisations || [];
};


export const getAdminMessageAttachments = async (messageId) => {
    const response = await axios.get(
        `${API}/admin/community/messages/${encodeURIComponent(messageId)}/attachments`,
        { headers: adminHeaders() },
    );

    return response.data?.attachments || [];
};

export const sendAdminCommunityMessage = async (formData) => {
    const response = await axios.post(
        `${API}/admin/community/messages/send`,
        formData,
        {
            headers: adminHeaders(),
            timeout: 180000,
        },
    );

    return response.data;
};

export const getClaimVerifications = async () => {
    const response = await axios.get(
        `${API}/admin/claim-verifications`,
        { headers: adminHeaders() },
    );

    return response.data?.verifications || [];
};

export const sendClaimRelationshipVerification = async (requestId) => {
    const response = await axios.post(
        `${API}/admin/claim-verifications/${encodeURIComponent(requestId)}/send`,
        {},
        { headers: adminHeaders() },
    );

    return response.data;
};

export const recordManualClaimVerification = async (requestId, payload) => {
    const response = await axios.post(
        `${API}/admin/claim-verifications/${encodeURIComponent(requestId)}/manual`,
        payload,
        { headers: adminHeaders() },
    );

    return response.data;
};