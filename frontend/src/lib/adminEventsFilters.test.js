import {
    buildDerivedEvents,
    computeAttentionCounts,
    filterDerivedEvents,
    eventsToCsv,
} from "./adminEventsFilters";

describe("adminEventsFilters", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const base = [
        {
            id: "a1",
            title: "Community Picnic",
            start: "2026-08-20T10:00:00.000Z",
            end: "2026-08-20T12:00:00.000Z",
            status: "approved",
            venue: "Village Green",
            image: "https://example.com/a.jpg",
            orgSlug: "org-a",
            category: "Community",
        },
        {
            id: "a2",
            title: "Community Picnic",
            start: "2026-08-20T10:00:00.000Z",
            end: "2026-08-20T12:00:00.000Z",
            status: "pending",
            venue: "",
            image: "",
            orgSlug: "org-b",
            category: "Community",
        },
        {
            id: "a3",
            title: "Old Music Night",
            start: "2026-07-01T00:00:00.000Z",
            end: "2026-07-01T00:00:00.000Z",
            status: "approved",
            venue: "Town Hall",
            image: "https://example.com/c.jpg",
            orgSlug: "org-c",
            category: "Music",
        },
    ];

    it("derives quality flags and attention counts", () => {
        const derived = buildDerivedEvents(base, now);
        const counts = computeAttentionCounts(derived);

        expect(derived.find((r) => r.id === "a2")._isDuplicate).toBe(true);
        expect(derived.find((r) => r.id === "a2")._hasVenue).toBe(false);
        expect(derived.find((r) => r.id === "a2")._hasImage).toBe(false);
        expect(derived.find((r) => r.id === "a3")._stillPublishedPast).toBe(true);

        expect(counts.duplicates).toBe(1);
        expect(counts.missingVenue).toBe(1);
        expect(counts.missingImage).toBe(1);
        expect(counts.pastPublished).toBe(1);
    });

    it("filters by status, issue and search", () => {
        const derived = buildDerivedEvents(base, now);
        const orgNameBySlug = { "org-a": "Alpha Org", "org-b": "Beta Org", "org-c": "Gamma Org" };

        const upcoming = filterDerivedEvents(derived, { statusFilter: "upcoming" }, orgNameBySlug);
        expect(upcoming.map((r) => r.id)).toEqual(["a1", "a2"]);

        const missingVenue = filterDerivedEvents(derived, { needsFilter: "missing_venue" }, orgNameBySlug);
        expect(missingVenue.map((r) => r.id)).toEqual(["a2"]);

        const searched = filterDerivedEvents(derived, { search: "gamma" }, orgNameBySlug);
        expect(searched.map((r) => r.id)).toEqual(["a3"]);
    });

    it("exports CSV with expected headers and rows", () => {
        const derived = buildDerivedEvents(base, now);
        const csv = eventsToCsv(derived, { "org-a": "Alpha Org", "org-b": "Beta Org", "org-c": "Gamma Org" });
        const lines = csv.split("\n");

        expect(lines[0]).toContain("\"title\"");
        expect(lines[0]).toContain("\"missing_venue\"");
        expect(lines.length).toBe(4);
        expect(csv).toContain("\"Community Picnic\"");
        expect(csv).toContain("\"yes\"");
    });
});
