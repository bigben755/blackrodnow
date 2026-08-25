import React, { useState } from "react";
import { Plus, X } from "lucide-react";

const INTERVAL_FREQS = ["daily", "weekly", "monthly", "monthly_weekday"];
const INTERVAL_UNIT = { daily: "day(s)", weekly: "week(s)", monthly: "month(s)", monthly_weekday: "month(s)" };

const nthLabel = (dateStr) => {
    if (!dateStr) return "";
    try {
        const d = new Date(`${dateStr}T12:00:00`);
        const nth = Math.floor((d.getDate() - 1) / 7) + 1;
        const suffix = ["1st", "2nd", "3rd", "4th", "5th"][nth - 1] || `${nth}th`;
        const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
        return `${suffix} ${weekday} of the month`;
    } catch {
        return "";
    }
};

/**
 * Reusable "Repeat this event" recurrence fields.
 *
 * Props:
 *   freq / onFreqChange           – "none"|"daily"|"weekly"|"biweekly"|"monthly"|"monthly_weekday"|"annually"
 *   until / onUntilChange         – optional end date (YYYY-MM-DD)
 *   interval / onIntervalChange   – optional "every N" (1-12); shown for daily/weekly/monthly modes
 *   extraDates / onExtraDatesChange – optional array of extra one-off YYYY-MM-DD dates
 *   startDate                     – event's start date (YYYY-MM-DD), used to describe the monthly-weekday option
 *   testIdPrefix / inputClassName / compact
 */
export default function RecurrenceFields({
    freq = "none",
    until = "",
    interval = 1,
    extraDates = [],
    exceptionDates = [],
    termTimeOnly = false,
    onFreqChange,
    onUntilChange,
    onIntervalChange,
    onExtraDatesChange,
    onExceptionDatesChange,
    onTermTimeOnlyChange,
    startDate = "",
    testIdPrefix = "recurrence",
    inputClassName = "w-full px-3 py-2 rounded-2xl border border-border bg-background text-sm",
    compact = false,
}) {
    const [newDate, setNewDate] = useState("");
    const [newSkipDate, setNewSkipDate] = useState("");
    const showInterval = !!onIntervalChange && INTERVAL_FREQS.includes(freq);
    const showExtras = !!onExtraDatesChange;
    const monthlyWeekdayHint = nthLabel(startDate);

    const addDate = () => {
        if (!newDate || extraDates.includes(newDate)) return;
        onExtraDatesChange([...extraDates, newDate].sort());
        setNewDate("");
    };

    return (
        <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-xs font-black uppercase tracking-wider text-primary">
                Repeat this event
            </div>
            {!compact && (
                <p className="text-xs text-muted-foreground mt-1">
                    Repeat daily, weekly, every few weeks, monthly on the same weekday, or yearly —
                    and add extra one-off dates below.
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
                        <option value="monthly">Every month (same date, approx.)</option>
                        <option value="monthly_weekday">
                            Monthly on the same weekday{monthlyWeekdayHint ? ` (${monthlyWeekdayHint})` : " (e.g. 3rd Wednesday)"}
                        </option>
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
            {showInterval && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Every</span>
                    <input
                        data-testid={`${testIdPrefix}-interval`}
                        type="number"
                        min={1}
                        max={12}
                        value={interval}
                        onChange={(e) => onIntervalChange?.(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
                        className={`${inputClassName} w-20 text-center`}
                    />
                    <span className="text-xs text-muted-foreground">{INTERVAL_UNIT[freq]} — e.g. 3 = every 3rd {INTERVAL_UNIT[freq].replace("(s)", "")}</span>
                </label>
            )}
            {!!onExceptionDatesChange && freq !== "none" && (
                <div className="mt-4 border-t border-border pt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Skips these dates (closures / holidays)
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            data-testid={`${testIdPrefix}-skip-date-input`}
                            type="date"
                            value={newSkipDate}
                            onChange={(e) => setNewSkipDate(e.target.value)}
                            className={`${inputClassName} max-w-[200px]`}
                        />
                        <button
                            type="button"
                            data-testid={`${testIdPrefix}-skip-date-add`}
                            onClick={() => {
                                if (!newSkipDate || exceptionDates.includes(newSkipDate)) return;
                                onExceptionDatesChange([...exceptionDates, newSkipDate].sort());
                                setNewSkipDate("");
                            }}
                            disabled={!newSkipDate}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-muted text-xs font-semibold disabled:opacity-50 hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" /> Skip date
                        </button>
                    </div>
                    {exceptionDates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2" data-testid={`${testIdPrefix}-skip-dates-list`}>
                            {exceptionDates.map((d) => (
                                <span key={d} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                                    ✕ {new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    <button type="button" onClick={() => onExceptionDatesChange(exceptionDates.filter((x) => x !== d))} title="Remove">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    {!!onTermTimeOnlyChange && (
                        <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                data-testid={`${testIdPrefix}-term-time`}
                                checked={termTimeOnly}
                                onChange={(e) => onTermTimeOnlyChange(e.target.checked)}
                            />
                            <span>Term-time only (shows a badge so visitors know it pauses in school holidays)</span>
                        </label>
                    )}
                </div>
            )}
            {showExtras && (
                <div className="mt-4 border-t border-border pt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Also happens on these one-off dates (optional)
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            data-testid={`${testIdPrefix}-extra-date-input`}
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className={`${inputClassName} max-w-[200px]`}
                        />
                        <button
                            type="button"
                            data-testid={`${testIdPrefix}-extra-date-add`}
                            onClick={addDate}
                            disabled={!newDate}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-muted text-xs font-semibold disabled:opacity-50 hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add date
                        </button>
                    </div>
                    {extraDates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2" data-testid={`${testIdPrefix}-extra-dates-list`}>
                            {extraDates.map((d) => (
                                <span key={d} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                    {new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    <button
                                        type="button"
                                        data-testid={`${testIdPrefix}-extra-date-remove-${d}`}
                                        onClick={() => onExtraDatesChange(extraDates.filter((x) => x !== d))}
                                        className="hover:text-accent"
                                        title="Remove date"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Build the API payload sub-object from the field values.
 * Returns an EventRecurrence object, or `null` when there's nothing to repeat.
 * Third arg is optional: { interval, extraDates }.
 */
export function buildRecurrencePayload(freq, untilYyyyMmDd, opts = {}) {
    const extraDates = opts.extraDates || [];
    const exceptionDates = opts.exceptionDates || [];
    const hasFreq = freq && freq !== "none";
    if (!hasFreq && !extraDates.length) return null;
    const payload = { freq: hasFreq ? freq : "none" };
    if (hasFreq && untilYyyyMmDd) {
        // Turn a bare YYYY-MM-DD into an end-of-day ISO string so the last day is inclusive.
        payload.until = `${untilYyyyMmDd}T23:59:59`;
    }
    if (hasFreq && opts.interval && Number(opts.interval) > 1) {
        payload.interval = Number(opts.interval);
    }
    if (extraDates.length) payload.extra_dates = extraDates;
    if (hasFreq && exceptionDates.length) payload.exception_dates = exceptionDates;
    if (hasFreq && opts.termTimeOnly) payload.term_time_only = true;
    return payload;
}
