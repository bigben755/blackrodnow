export function normalizeTitle(value) {
    return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseDateSafe(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function buildDerivedEvents(events, nowRef = new Date()) {
    const rows = events || [];
    const duplicateKeyCounts = new Map();

    rows.forEach((ev) => {
        const key = `${normalizeTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
        if (!normalizeTitle(ev.title) || !(ev.start || "").slice(0, 10)) return;
        duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) || 0) + 1);
    });

    return rows.map((ev) => {
        const start = parseDateSafe(ev.start);
        const end = parseDateSafe(ev.end) || start;
        const hasVenue = Boolean((ev.venue || "").trim());
        const hasImage = Boolean((ev.image || "").trim());
        const hasTime = Boolean(start && !(start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0));
        const duplicateKey = `${normalizeTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
        const isDuplicate = (duplicateKeyCounts.get(duplicateKey) || 0) > 1;
        const isPast = Boolean(end && end < nowRef);
        const isUpcoming = Boolean(end && end >= nowRef);
        const status = ev.status || "pending";
        const stillPublishedPast = status === "approved" && isPast;

        return {
            ...ev,
            _start: start,
            _end: end,
            _hasVenue: hasVenue,
            _hasImage: hasImage,
            _hasTime: hasTime,
            _isDuplicate: isDuplicate,
            _isPast: isPast,
            _isUpcoming: isUpcoming,
            _stillPublishedPast: stillPublishedPast,
        };
    });
}

export function computeAttentionCounts(derivedRows) {
    const counts = {
        missingVenue: 0,
        missingTime: 0,
        missingImage: 0,
        duplicates: 0,
        pastPublished: 0,
    };
    const duplicateSeen = new Set();

    (derivedRows || []).forEach((ev) => {
        if (!ev._hasVenue) counts.missingVenue += 1;
        if (!ev._hasTime) counts.missingTime += 1;
        if (!ev._hasImage) counts.missingImage += 1;
        if (ev._isDuplicate) {
            const key = `${normalizeTitle(ev.title)}|${(ev.start || "").slice(0, 10)}`;
            if (!duplicateSeen.has(key)) {
                duplicateSeen.add(key);
                counts.duplicates += 1;
            }
        }
        if (ev._stillPublishedPast) counts.pastPublished += 1;
    });

    return counts;
}

export function filterDerivedEvents(derivedRows, filters, orgNameBySlug = {}) {
    const {
        statusFilter = "all",
        orgFilter = "all",
        categoryFilter = "all",
        venueFilter = "all",
        dateFilter = "",
        needsFilter = "all",
        search = "",
    } = filters || {};

    const needle = (search || "").trim().toLowerCase();

    return (derivedRows || []).filter((ev) => {
        if (statusFilter !== "all") {
            if (statusFilter === "upcoming" && !ev._isUpcoming) return false;
            else if (statusFilter === "past" && !ev._isPast) return false;
            else if (!["upcoming", "past"].includes(statusFilter) && (ev.status || "pending") !== statusFilter) return false;
        }
        if (orgFilter !== "all" && ev.orgSlug !== orgFilter) return false;
        if (categoryFilter !== "all" && (ev.category || "") !== categoryFilter) return false;
        if (venueFilter !== "all" && (ev.venue || "") !== venueFilter) return false;
        if (dateFilter && (ev.start || "").slice(0, 10) !== dateFilter) return false;
        if (needsFilter !== "all") {
            if (needsFilter === "missing_venue" && ev._hasVenue) return false;
            if (needsFilter === "missing_time" && ev._hasTime) return false;
            if (needsFilter === "missing_image" && ev._hasImage) return false;
            if (needsFilter === "duplicates" && !ev._isDuplicate) return false;
            if (needsFilter === "past_published" && !ev._stillPublishedPast) return false;
        }
        if (needle) {
            const hay = [
                ev.title,
                ev.description,
                ev.venue,
                ev.address,
                ev.orgSlug,
                orgNameBySlug[ev.orgSlug] || "",
                ev.category,
            ].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(needle)) return false;
        }
        return true;
    }).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

function csvCell(value) {
    const raw = value == null ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
}

export function eventsToCsv(rows, orgNameBySlug = {}) {
    const header = [
        "id",
        "title",
        "organisation",
        "org_slug",
        "status",
        "category",
        "start",
        "end",
        "venue",
        "address",
        "missing_venue",
        "missing_time",
        "missing_image",
        "possible_duplicate",
        "past_but_published",
    ];
    const body = (rows || []).map((ev) => [
        ev.id || "",
        ev.title || "",
        orgNameBySlug[ev.orgSlug] || ev.orgSlug || "",
        ev.orgSlug || "",
        ev.status || "pending",
        ev.category || "",
        ev.start || "",
        ev.end || "",
        ev.venue || "",
        ev.address || "",
        !ev._hasVenue ? "yes" : "no",
        !ev._hasTime ? "yes" : "no",
        !ev._hasImage ? "yes" : "no",
        ev._isDuplicate ? "yes" : "no",
        ev._stillPublishedPast ? "yes" : "no",
    ]);

    return [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
}
