import React from "react";

/**
 * Reusable "Repeat this event" recurrence fields.
 *
 * Two controlled inputs — a frequency dropdown and an optional "until" date.
 * Emits changes via callbacks so it slots into any form state shape.
 *
 * Props:
 *   freq           – current freq value ("none"|"daily"|"weekly"|"biweekly"|"monthly"|"annually")
 *   until          – current until date value (YYYY-MM-DD string, or "")
 *   onFreqChange   – (nextValue) => void
 *   onUntilChange  – (nextValue) => void
 *   testIdPrefix   – prefix for data-testid attributes (e.g. "quickcreate-event")
 *   inputClassName – optional Tailwind classes for the inputs (matches host form styling)
 *   compact        – if true, hides the descriptive helper text
 */
export default function RecurrenceFields({
    freq = "none",
    until = "",
    onFreqChange,
    onUntilChange,
    testIdPrefix = "recurrence",
    inputClassName = "w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm",
    compact = false,
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-black uppercase tracking-wider text-primary">
                Repeat this event
            </div>
            {!compact && (
                <p className="text-xs text-muted-foreground mt-1">
                    Set once, appears every day / week / month / year in the calendar.
                    Great for weekly clubs, bingo, prayer, birthdays or annual festivals.
                </p>
            )}
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Frequency
                    </span>
                    <select
                        data-testid={`${testIdPrefix}-freq`}
                        value={freq}
                        onChange={(e) => onFreqChange?.(e.target.value)}
                        className={`mt-1 ${inputClassName}`}
                    >
                        <option value="none">Doesn&apos;t repeat</option>
                        <option value="daily">Every day</option>
                        <option value="weekly">Every week</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Every month (approx.)</option>
                        <option value="annually">Every year</option>
                    </select>
                </label>
                <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Repeat until (optional)
                    </span>
                    <input
                        data-testid={`${testIdPrefix}-until`}
                        type="date"
                        value={until}
                        onChange={(e) => onUntilChange?.(e.target.value)}
                        disabled={freq === "none"}
                        className={`mt-1 ${inputClassName} disabled:opacity-60`}
                    />
                </label>
            </div>
        </div>
    );
}

/**
 * Build the API payload sub-object from the two field values.
 * Returns either an EventRecurrence object or `null` (when freq === "none").
 */
export function buildRecurrencePayload(freq, untilYyyyMmDd) {
    if (!freq || freq === "none") return null;
    const payload = { freq };
    if (untilYyyyMmDd) {
        // Turn a bare YYYY-MM-DD into an end-of-day ISO string so the last day is inclusive.
        payload.until = new Date(`${untilYyyyMmDd}T23:59:59`).toISOString();
    }
    return payload;
}
