// Minimal RFC-5545 ICS builder for Blackrod Now events.
// Produces a single VCALENDAR string usable as a downloadable .ics file
// (imports into Google Calendar, Apple Calendar, Outlook, Fantastical, etc.)

const escapeICS = (s = "") =>
    String(s)
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");

const pad = (n) => String(n).padStart(2, "0");

const fmtDate = (iso) => {
    const d = new Date(iso);
    return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        "T" +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        "Z"
    );
};

// Fold long lines to 75 octets per RFC 5545 (simple char-based approximation).
const fold = (line) => {
    if (line.length <= 75) return line;
    const out = [];
    for (let i = 0; i < line.length; i += 73) {
        out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    }
    return out.join("\r\n");
};

export function buildICS(events, { name = "Blackrod Now", description = "Everything happening in Blackrod" } = {}) {
    const now = fmtDate(new Date().toISOString());
    const vevents = events.map((e) =>
        [
            "BEGIN:VEVENT",
            `UID:${e.id}@blackrodnow.uk`,
            `DTSTAMP:${now}`,
            `DTSTART:${fmtDate(e.start)}`,
            `DTEND:${fmtDate(e.end || e.start)}`,
            fold(`SUMMARY:${escapeICS(e.title)}`),
            fold(`LOCATION:${escapeICS([e.venue, e.address].filter(Boolean).join(", "))}`),
            fold(`DESCRIPTION:${escapeICS(e.description)}`),
            "END:VEVENT",
        ].join("\r\n"),
    );
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Blackrod Now//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        fold(`X-WR-CALNAME:${escapeICS(name)}`),
        fold(`X-WR-CALDESC:${escapeICS(description)}`),
        ...vevents,
        "END:VCALENDAR",
    ].join("\r\n");
}

export function downloadICS(events, filename = "blackrod-now.ics") {
    const ics = buildICS(events);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
