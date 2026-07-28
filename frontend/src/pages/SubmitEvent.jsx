import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import NewsletterSection from "@/components/NewsletterSection";
import { CheckCircle2, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import RecurrenceFields, { buildRecurrencePayload } from "@/components/RecurrenceFields";
import EventImageInput from "@/components/EventImageInput";

const initial = {
    title: "",
    orgName: "",
    category: "Community",
    date: "",
    start: "",
    end: "",
    venue: "",
    address: "",
    description: "",
    cost: "Free",
    booking: "",
    contactEmail: "",
    contactPhone: "",
    age: "All ages",
    accessibility: "",
    image: "",
    recurrenceFreq: "none",
    recurrenceUntil: "",
    consent: false,
};

const DRAFT_KEY = "rn-submit-event-draft";

export default function SubmitEvent() {
    const { addEvent, orgs } = useApp();
    const [form, setForm] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) setForm((current) => ({ ...current, ...JSON.parse(raw) }));
        } catch {
            /* ignore draft load errors */
        }
    }, []);

    useEffect(() => {
        try {
            const draft = { ...form };
            delete draft.consent;
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* ignore draft save errors */
        }
    }, [form]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.consent) {
            toast.error("Please consent before submitting");
            return;
        }
        setBusy(true);
        const start = new Date(`${form.date}T${form.start || "10:00"}`).toISOString();
        const end = new Date(`${form.date}T${form.end || form.start || "11:00"}`).toISOString();
        const orgSlug =
            orgs.find((o) => o.name.toLowerCase() === form.orgName.toLowerCase())?.slug ||
            "blackrod-sports-community-centre";

        try {
            await addEvent({
                title: form.title,
                orgSlug,
                category: form.category,
                start,
                end,
                venue: form.venue,
                address: form.address,
                description: form.description,
                cost: form.cost,
                age: form.age,
                accessibility: form.accessibility,
                booking: form.booking,
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                image: form.image || "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
                recurrence: buildRecurrencePayload(form.recurrenceFreq, form.recurrenceUntil),
            });
            localStorage.removeItem(DRAFT_KEY);
            setSubmitted(true);
            toast.success("Event submitted for approval", {
                description: "Admins will check the details, tidy up duplicates if needed, and publish it once approved.",
            });
        } catch (err) {
            toast.error("Couldn't submit — please try again");
        } finally {
            setBusy(false);
        }
    };

    if (submitted) {
        return (
            <div data-testid="submit-event-success" className="max-w-2xl mx-auto px-6 py-24 text-center">
                <div className="h-14 w-14 mx-auto rounded-full bg-secondary text-secondary-foreground grid place-items-center">
                    <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="font-display font-black text-3xl sm:text-4xl mt-6">Thanks — submitted!</h1>
                <p className="mt-3 text-muted-foreground">
                    Your event has been sent to our admins. You'll see it on Blackrod Now as soon as it's
                    approved.
                </p>
                <div className="mt-6 flex gap-2 justify-center">
                    <button
                        onClick={() => navigate("/events")}
                        className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-1"
                    >
                        Browse events <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => {
                            setForm(initial);
                            setSubmitted(false);
                        }}
                        className="px-5 py-2.5 rounded-full border-2 border-foreground font-semibold text-sm"
                    >
                        Submit another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div data-testid="submit-event-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Submit</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Tell us what's on
                </h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Submit an event — we'll save your draft as you go, then review it before it goes live.
                </p>
                <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground">What happens next</div>
                    <p className="mt-1">1. Your draft is autosaved locally. 2. Admins review it for duplicates or missing details. 3. Approved events go straight into the calendar.</p>
                </div>
            </div>

            <form onSubmit={submit} data-testid="submit-event-form" className="rounded-3xl border border-border bg-surface p-6 sm:p-8 space-y-6">
                <Field label="Event title" required>
                    <input data-testid="se-title" required value={form.title} onChange={set("title")} className={inp} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Organisation name" required>
                        <input data-testid="se-org" required value={form.orgName} onChange={set("orgName")} className={inp} list="orgs-list" />
                        <datalist id="orgs-list">
                            {orgs.map((o) => <option key={o.slug} value={o.name} />)}
                        </datalist>
                    </Field>
                    <Field label="Category" required>
                        <select data-testid="se-category" value={form.category} onChange={set("category")} className={inp}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Date" required>
                        <input data-testid="se-date" type="date" required value={form.date} onChange={set("date")} className={inp} />
                    </Field>
                    <Field label="Start time">
                        <input data-testid="se-start" type="time" value={form.start} onChange={set("start")} className={inp} />
                    </Field>
                    <Field label="End time">
                        <input data-testid="se-end" type="time" value={form.end} onChange={set("end")} className={inp} />
                    </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Venue">
                        <input data-testid="se-venue" value={form.venue} onChange={set("venue")} className={inp} />
                    </Field>
                    <Field label="Address">
                        <input data-testid="se-address" value={form.address} onChange={set("address")} className={inp} />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea data-testid="se-desc" rows={5} value={form.description} onChange={set("description")} className={inp} placeholder="A short summary helps admins publish this faster" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Cost">
                        <input data-testid="se-cost" value={form.cost} onChange={set("cost")} className={inp} />
                    </Field>
                    <Field label="Age suitability">
                        <input data-testid="se-age" value={form.age} onChange={set("age")} className={inp} />
                    </Field>
                </div>
                <Field label="Accessibility notes">
                    <input data-testid="se-access" value={form.accessibility} onChange={set("accessibility")} className={inp} />
                </Field>
                <Field label="Booking link">
                    <input data-testid="se-booking" type="url" value={form.booking} onChange={set("booking")} className={inp} placeholder="https://" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Contact email">
                        <input data-testid="se-email" type="email" value={form.contactEmail} onChange={set("contactEmail")} className={inp} />
                    </Field>
                    <Field label="Contact phone">
                        <input data-testid="se-phone" value={form.contactPhone} onChange={set("contactPhone")} className={inp} />
                    </Field>
                </div>
                <Field label="Event image (flyer)">
                    <EventImageInput
                        value={form.image}
                        onChange={(url) => setForm((f) => ({ ...f, image: url }))}
                        testIdPrefix="se-image"
                        inputClassName={inp}
                    />
                </Field>

                <RecurrenceFields
                    freq={form.recurrenceFreq}
                    until={form.recurrenceUntil}
                    onFreqChange={(v) => setForm((f) => ({ ...f, recurrenceFreq: v }))}
                    onUntilChange={(v) => setForm((f) => ({ ...f, recurrenceUntil: v }))}
                    testIdPrefix="se-recurrence"
                    inputClassName={inp}
                />

                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        data-testid="se-consent"
                        checked={form.consent}
                        onChange={set("consent")}
                        className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-muted-foreground">
                        I confirm I have the right to publish this event and consent to it being shared on
                        Blackrod Now.
                    </span>
                </label>

                <button
                    type="submit"
                    data-testid="se-submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform"
                >
                    <Calendar className="h-4 w-4" /> Submit event
                </button>
            </form>

            {/* NEWSLETTER */}
            <NewsletterSection />
        </div>
    );
}

const inp =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({ label, required, children }) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label} {required && <span className="text-accent">*</span>}
        </span>
        <div className="mt-1.5">{children}</div>
    </label>
);
