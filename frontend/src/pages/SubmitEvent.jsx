import React, {
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Link,
    useNavigate,
} from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/mockData";
import NewsletterSection from "@/components/NewsletterSection";
import {
    CheckCircle2,
    Calendar,
    ArrowRight,
    ArrowLeft,
    Building2,
    MapPin,
    Clock,
    Eye,
    Save,
    Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import RecurrenceFields, {
    buildRecurrencePayload,
} from "@/components/RecurrenceFields";
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
    recurrenceInterval: 1,
    recurrenceExtraDates: [],

    consent: false,
};

const DRAFT_KEY = "rn-submit-event-draft";

const STEPS = [
    {
        number: 1,
        label: "Event",
    },
    {
        number: 2,
        label: "Details",
    },
    {
        number: 3,
        label: "Review",
    },
];

const COST_PRESETS = [
    "Free",
    "Donation",
    "Booking required",
];

const AGE_PRESETS = [
    "All ages",
    "Families",
    "Children",
    "Young people",
    "Adults",
    "18+",
];

export default function SubmitEvent() {
    const {
        addEvent,
        events,
        orgs,
        role,
        activeOrgSlug,
    } = useApp();

    const navigate = useNavigate();

    const [form, setForm] =
        useState(initial);

    const [step, setStep] =
        useState(1);

    const [submitted, setSubmitted] =
        useState(false);

    const [busy, setBusy] =
        useState(false);

    const [hydrated, setHydrated] =
        useState(false);

    /*
     * Load saved draft once.
     */
    useEffect(() => {
        try {
            const raw =
                localStorage.getItem(
                    DRAFT_KEY
                );

            if (raw) {
                const saved =
                    JSON.parse(raw);

                setForm((current) => ({
                    ...current,
                    ...saved,
                    consent: false,
                }));
            }
        } catch {
            // Ignore corrupt/local storage errors.
        } finally {
            setHydrated(true);
        }
    }, []);

    /*
     * If an organisation user is logged in,
     * pre-select their organisation unless
     * the draft already contains one.
     */
    useEffect(() => {
        if (
            role !== "org" ||
            !activeOrgSlug ||
            form.orgName
        ) {
            return;
        }

        const activeOrg =
            orgs.find(
                (org) =>
                    org.slug ===
                    activeOrgSlug
            );

        if (activeOrg) {
            setForm((current) => ({
                ...current,
                orgName:
                    activeOrg.name,
            }));
        }
    }, [
        role,
        activeOrgSlug,
        orgs,
        form.orgName,
    ]);

    /*
     * Autosave after initial draft hydration.
     */
    useEffect(() => {
        if (!hydrated) return;

        try {
            const draft = {
                ...form,
            };

            delete draft.consent;

            localStorage.setItem(
                DRAFT_KEY,
                JSON.stringify(draft)
            );
        } catch {
            // Ignore local storage errors.
        }
    }, [form, hydrated]);

    const set =
        (key) => (event) => {
            setForm((current) => ({
                ...current,
                [key]:
                    event.target.type ===
                    "checkbox"
                        ? event.target
                              .checked
                        : event.target
                              .value,
            }));
        };

    /*
     * Existing venues become suggestions.
     * Their most recently-known address can
     * also be reused.
     */
    const knownVenues =
        useMemo(() => {
            const map = new Map();

            events.forEach((event) => {
                if (!event.venue) {
                    return;
                }

                const key =
                    event.venue
                        .trim()
                        .toLowerCase();

                if (!map.has(key)) {
                    map.set(key, {
                        name:
                            event.venue.trim(),
                        address:
                            event.address ||
                            "",
                    });
                } else if (
                    !map.get(key)
                        .address &&
                    event.address
                ) {
                    map.set(key, {
                        name:
                            event.venue.trim(),
                        address:
                            event.address,
                    });
                }
            });

            return Array.from(
                map.values()
            ).sort((a, b) =>
                a.name.localeCompare(
                    b.name
                )
            );
        }, [events]);

    const matchingOrg =
        useMemo(() => {
            const requested =
                form.orgName
                    .trim()
                    .toLowerCase();

            if (!requested) {
                return null;
            }

            return (
                orgs.find(
                    (org) =>
                        org.name
                            .trim()
                            .toLowerCase() ===
                        requested
                ) || null
            );
        }, [form.orgName, orgs]);

    const onVenueChange = (
        event
    ) => {
        const value =
            event.target.value;

        const match =
            knownVenues.find(
                (venue) =>
                    venue.name.toLowerCase() ===
                    value
                        .trim()
                        .toLowerCase()
            );

        setForm((current) => ({
            ...current,
            venue: value,
            address:
                match?.address ||
                current.address,
        }));
    };

    const validateStepOne = () => {
        if (!form.title.trim()) {
            toast.error(
                "Add an event title"
            );
            return false;
        }

        if (!form.orgName.trim()) {
            toast.error(
                "Choose the organisation running the event"
            );
            return false;
        }

        if (!matchingOrg) {
            toast.error(
                "Choose an organisation from the Blackrod Now directory"
            );
            return false;
        }

        if (!form.date) {
            toast.error(
                "Choose the event date"
            );
            return false;
        }

        if (!form.start) {
            toast.error(
                "Add the event start time"
            );
            return false;
        }

        if (
            form.end &&
            form.start &&
            form.end <= form.start
        ) {
            toast.error(
                "The end time must be later than the start time"
            );
            return false;
        }

        return true;
    };

    const nextStep = () => {
        if (
            step === 1 &&
            !validateStepOne()
        ) {
            return;
        }

        setStep((current) =>
            Math.min(
                current + 1,
                3
            )
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const previousStep = () => {
        setStep((current) =>
            Math.max(
                current - 1,
                1
            )
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const editSection = (
        targetStep
    ) => {
        setStep(targetStep);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const submit = async (
        event
    ) => {
        event.preventDefault();

        if (!validateStepOne()) {
            setStep(1);
            return;
        }

        if (!matchingOrg) {
            toast.error(
                "Please select a listed organisation"
            );
            setStep(1);
            return;
        }

        if (!form.consent) {
            toast.error(
                "Please confirm the publishing permission"
            );
            return;
        }

        setBusy(true);

        const startDate = new Date(
            `${form.date}T${form.start}`
        );

        let endDate;

        if (form.end) {
            endDate = new Date(
                `${form.date}T${form.end}`
            );
        } else {
            endDate = new Date(
                startDate.getTime() +
                    60 * 60 * 1000
            );
        }

        try {
            await addEvent({
                title:
                    form.title.trim(),

                orgSlug:
                    matchingOrg.slug,

                category:
                    form.category,

                start:
                    startDate.toISOString(),

                end:
                    endDate.toISOString(),

                venue:
                    form.venue.trim(),

                address:
                    form.address.trim(),

                description:
                    form.description.trim(),

                cost:
                    form.cost.trim(),

                age:
                    form.age.trim(),

                accessibility:
                    form.accessibility.trim(),

                booking:
                    form.booking.trim(),

                contactEmail:
                    form.contactEmail.trim(),

                contactPhone:
                    form.contactPhone.trim(),

                image:
                    form.image,

                recurrence:
                    buildRecurrencePayload(
                        form.recurrenceFreq,
                        form.recurrenceUntil,
                        {
                            interval:
                                form.recurrenceInterval,

                            extraDates:
                                form.recurrenceExtraDates,
                        }
                    ),
            });

            localStorage.removeItem(
                DRAFT_KEY
            );

            setSubmitted(true);

            toast.success(
                "Event submitted for approval",
                {
                    description:
                        "We'll check the details and publish it to the Blackrod Now calendar once approved.",
                }
            );
        } catch {
            toast.error(
                "Couldn't submit the event — please try again"
            );
        } finally {
            setBusy(false);
        }
    };

    if (submitted) {
        return (
            <div
                data-testid="submit-event-success"
                className="max-w-2xl mx-auto px-6 py-20 sm:py-24 text-center"
            >
                <div className="h-16 w-16 mx-auto rounded-full bg-secondary text-secondary-foreground grid place-items-center">
                    <CheckCircle2 className="h-8 w-8" />
                </div>

                <h1 className="font-display font-black text-3xl sm:text-4xl mt-6">
                    Thanks — it's been
                    submitted
                </h1>

                <p className="mt-3 text-muted-foreground">
                    We'll review the
                    details and add the
                    event to Blackrod Now
                    once it's approved.
                </p>

                <div className="mt-7 flex gap-2 justify-center flex-wrap">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                "/events"
                            )
                        }
                        className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center gap-1"
                    >
                        Browse What's On
                        <ArrowRight className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setForm(
                                initial
                            );

                            setStep(1);

                            setSubmitted(
                                false
                            );
                        }}
                        className="px-5 py-2.5 rounded-full border border-border font-semibold text-sm"
                    >
                        Add another event
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="submit-event-page"
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
        >
            {/* HEADER */}
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    Add an event
                </span>

                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">
                    Tell Blackrod what's
                    happening
                </h1>

                <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-2xl">
                    Add your event to
                    Blackrod Now. Your
                    progress is saved on
                    this device while you
                    complete the form.
                </p>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        Draft automatically
                        saved
                    </span>

                    <span>
                        Event listings are
                        free
                    </span>

                    <span>
                        Reviewed before
                        publication
                    </span>
                </div>

                <p className="mt-5 text-sm">
                    Got several events?{" "}
                    <Link
                        to="/submit-events-list"
                        data-testid="link-submit-events-list"
                        className="font-semibold text-primary underline underline-offset-2"
                    >
                        Upload your events
                        list in one go →
                    </Link>
                </p>
            </div>

            {/* STEPS */}
            <div className="mb-7">
                <div className="grid grid-cols-3 gap-2">
                    {STEPS.map(
                        (item) => {
                            const active =
                                step ===
                                item.number;

                            const complete =
                                step >
                                item.number;

                            return (
                                <button
                                    key={
                                        item.number
                                    }
                                    type="button"
                                    onClick={() => {
                                        if (
                                            complete
                                        ) {
                                            setStep(
                                                item.number
                                            );
                                        }
                                    }}
                                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                                        active
                                            ? "border-primary bg-primary/5"
                                            : complete
                                            ? "border-border bg-surface cursor-pointer"
                                            : "border-border bg-surface opacity-60 cursor-default"
                                    }`}
                                >
                                    <div
                                        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${
                                            active
                                                ? "bg-primary text-primary-foreground"
                                                : complete
                                                ? "bg-foreground text-background"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {complete ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            item.number
                                        )}
                                    </div>

                                    <div className="mt-2 text-xs sm:text-sm font-semibold">
                                        {
                                            item.label
                                        }
                                    </div>
                                </button>
                            );
                        }
                    )}
                </div>
            </div>

            <form
                onSubmit={submit}
                data-testid="submit-event-form"
            >
                {/* STEP 1 */}
                {step === 1 && (
                    <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                        <div className="mb-6">
                            <h2 className="font-display font-black text-2xl">
                                Event basics
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Tell us what
                                the event is,
                                who's running
                                it and when
                                it's happening.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <Field
                                label="Event title"
                                required
                                hint="Use the name people will recognise."
                            >
                                <input
                                    data-testid="se-title"
                                    required
                                    value={
                                        form.title
                                    }
                                    onChange={set(
                                        "title"
                                    )}
                                    className={
                                        inp
                                    }
                                    placeholder="e.g. Blackrod Summer Fair"
                                />
                            </Field>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field
                                    label="Organisation"
                                    required
                                    hint={
                                        role ===
                                            "org" &&
                                        activeOrgSlug
                                            ? "Your logged-in organisation."
                                            : "Choose who is running the event."
                                    }
                                >
                                    <select
                                        data-testid="se-org"
                                        required
                                        value={
                                            form.orgName
                                        }
                                        disabled={
                                            role ===
                                                "org" &&
                                            Boolean(
                                                activeOrgSlug
                                            )
                                        }
                                        onChange={set(
                                            "orgName"
                                        )}
                                        className={`${inp} disabled:opacity-70`}
                                    >
                                        <option value="">
                                            Select
                                            organisation
                                        </option>

                                        {orgs.map(
                                            (
                                                org
                                            ) => (
                                                <option
                                                    key={
                                                        org.slug
                                                    }
                                                    value={
                                                        org.name
                                                    }
                                                >
                                                    {
                                                        org.name
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>

                                    {!(
                                        role ===
                                            "org" &&
                                        activeOrgSlug
                                    ) && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Can't
                                            find
                                            the
                                            organisation?{" "}
                                            <Link
                                                to="/add-organisation"
                                                className="font-semibold text-primary hover:underline"
                                            >
                                                Add
                                                it
                                                to
                                                Blackrod
                                                Now
                                                first
                                                →
                                            </Link>
                                        </p>
                                    )}
                                </Field>

                                <Field
                                    label="Category"
                                    required
                                >
                                    <select
                                        data-testid="se-category"
                                        value={
                                            form.category
                                        }
                                        onChange={set(
                                            "category"
                                        )}
                                        className={
                                            inp
                                        }
                                    >
                                        {CATEGORIES.map(
                                            (
                                                category
                                            ) => (
                                                <option
                                                    key={
                                                        category
                                                    }
                                                >
                                                    {
                                                        category
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </Field>
                            </div>

                            <div className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="h-4 w-4 text-primary" />

                                    <h3 className="font-display font-bold">
                                        Date & time
                                    </h3>
                                </div>

                                <div className="grid sm:grid-cols-3 gap-4">
                                    <Field
                                        label="Date"
                                        required
                                    >
                                        <input
                                            data-testid="se-date"
                                            type="date"
                                            required
                                            value={
                                                form.date
                                            }
                                            onChange={set(
                                                "date"
                                            )}
                                            className={
                                                inp
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Starts"
                                        required
                                    >
                                        <input
                                            data-testid="se-start"
                                            type="time"
                                            required
                                            value={
                                                form.start
                                            }
                                            onChange={set(
                                                "start"
                                            )}
                                            className={
                                                inp
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Ends"
                                        hint="Optional. We'll assume one hour if left blank."
                                    >
                                        <input
                                            data-testid="se-end"
                                            type="time"
                                            value={
                                                form.end
                                            }
                                            onChange={set(
                                                "end"
                                            )}
                                            className={
                                                inp
                                            }
                                        />
                                    </Field>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="h-4 w-4 text-primary" />

                                    <h3 className="font-display font-bold">
                                        Does it
                                        repeat?
                                    </h3>
                                </div>

                                <p className="text-xs text-muted-foreground mb-4">
                                    Use this
                                    for weekly
                                    clubs,
                                    monthly
                                    meetings
                                    and other
                                    recurring
                                    activities.
                                </p>

                                <RecurrenceFields
                                    freq={
                                        form.recurrenceFreq
                                    }
                                    until={
                                        form.recurrenceUntil
                                    }
                                    interval={
                                        form.recurrenceInterval
                                    }
                                    extraDates={
                                        form.recurrenceExtraDates
                                    }
                                    onFreqChange={(
                                        value
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,
                                                recurrenceFreq:
                                                    value,
                                            })
                                        )
                                    }
                                    onUntilChange={(
                                        value
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,
                                                recurrenceUntil:
                                                    value,
                                            })
                                        )
                                    }
                                    onIntervalChange={(
                                        value
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,
                                                recurrenceInterval:
                                                    value,
                                            })
                                        )
                                    }
                                    onExtraDatesChange={(
                                        value
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,
                                                recurrenceExtraDates:
                                                    value,
                                            })
                                        )
                                    }
                                    startDate={
                                        form.date
                                    }
                                    testIdPrefix="se-recurrence"
                                    inputClassName={
                                        inp
                                    }
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={
                                        nextStep
                                    }
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
                                >
                                    Event details
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                        <div className="mb-6">
                            <h2 className="font-display font-black text-2xl">
                                Event details
                            </h2>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Add the
                                information
                                residents will
                                need before
                                deciding to
                                attend.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="h-4 w-4 text-primary" />

                                    <h3 className="font-display font-bold">
                                        Location
                                    </h3>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <Field
                                        label="Venue"
                                        hint="Start typing to reuse a venue already on Blackrod Now."
                                    >
                                        <input
                                            data-testid="se-venue"
                                            value={
                                                form.venue
                                            }
                                            onChange={
                                                onVenueChange
                                            }
                                            className={
                                                inp
                                            }
                                            list="known-venues"
                                            placeholder="e.g. Blackrod Community Centre"
                                        />

                                        <datalist id="known-venues">
                                            {knownVenues.map(
                                                (
                                                    venue
                                                ) => (
                                                    <option
                                                        key={
                                                            venue.name
                                                        }
                                                        value={
                                                            venue.name
                                                        }
                                                    />
                                                )
                                            )}
                                        </datalist>
                                    </Field>

                                    <Field label="Address">
                                        <input
                                            data-testid="se-address"
                                            value={
                                                form.address
                                            }
                                            onChange={set(
                                                "address"
                                            )}
                                            className={
                                                inp
                                            }
                                            placeholder="Street / postcode"
                                        />
                                    </Field>
                                </div>
                            </div>

                            <Field
                                label="Description"
                                hint="What is happening, what should people expect and is there anything they need to bring or know?"
                            >
                                <textarea
                                    data-testid="se-desc"
                                    rows={6}
                                    value={
                                        form.description
                                    }
                                    onChange={set(
                                        "description"
                                    )}
                                    className={
                                        inp
                                    }
                                    placeholder="Tell residents what the event is about…"
                                />
                            </Field>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field
                                    label="Cost"
                                    hint="Be specific where possible."
                                >
                                    <input
                                        data-testid="se-cost"
                                        value={
                                            form.cost
                                        }
                                        onChange={set(
                                            "cost"
                                        )}
                                        className={
                                            inp
                                        }
                                        placeholder="Free, £5, donation…"
                                    />

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {COST_PRESETS.map(
                                            (
                                                value
                                            ) => (
                                                <button
                                                    key={
                                                        value
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        setForm(
                                                            (
                                                                current
                                                            ) => ({
                                                                ...current,
                                                                cost: value,
                                                            })
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-full border border-border bg-background text-[11px] font-semibold hover:bg-muted"
                                                >
                                                    {
                                                        value
                                                    }
                                                </button>
                                            )
                                        )}
                                    </div>
                                </Field>

                                <Field label="Age suitability">
                                    <input
                                        data-testid="se-age"
                                        value={
                                            form.age
                                        }
                                        onChange={set(
                                            "age"
                                        )}
                                        className={
                                            inp
                                        }
                                        list="age-options"
                                        placeholder="e.g. All ages"
                                    />

                                    <datalist id="age-options">
                                        {AGE_PRESETS.map(
                                            (
                                                value
                                            ) => (
                                                <option
                                                    key={
                                                        value
                                                    }
                                                    value={
                                                        value
                                                    }
                                                />
                                            )
                                        )}
                                    </datalist>
                                </Field>
                            </div>

                            <Field
                                label="Accessibility"
                                hint="Include useful information such as step-free access, wheelchair access, hearing loops or quiet spaces."
                            >
                                <input
                                    data-testid="se-access"
                                    value={
                                        form.accessibility
                                    }
                                    onChange={set(
                                        "accessibility"
                                    )}
                                    className={
                                        inp
                                    }
                                    placeholder="e.g. Step-free entrance and accessible toilet"
                                />
                            </Field>

                            <Field
                                label="Booking link"
                                hint="Leave blank if no booking is required."
                            >
                                <input
                                    data-testid="se-booking"
                                    type="url"
                                    value={
                                        form.booking
                                    }
                                    onChange={set(
                                        "booking"
                                    )}
                                    className={
                                        inp
                                    }
                                    placeholder="https://"
                                />
                            </Field>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label="Contact email">
                                    <input
                                        data-testid="se-email"
                                        type="email"
                                        value={
                                            form.contactEmail
                                        }
                                        onChange={set(
                                            "contactEmail"
                                        )}
                                        className={
                                            inp
                                        }
                                        placeholder="Optional"
                                    />
                                </Field>

                                <Field label="Contact phone">
                                    <input
                                        data-testid="se-phone"
                                        type="tel"
                                        value={
                                            form.contactPhone
                                        }
                                        onChange={set(
                                            "contactPhone"
                                        )}
                                        className={
                                            inp
                                        }
                                        placeholder="Optional"
                                    />
                                </Field>
                            </div>

                            <div className="rounded-3xl border border-border bg-background p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <ImageIcon className="h-4 w-4 text-primary" />

                                    <div>
                                        <h3 className="font-display font-bold">
                                            Event
                                            image
                                        </h3>

                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            A
                                            poster
                                            or
                                            photo
                                            makes
                                            the
                                            listing
                                            easier
                                            to
                                            spot.
                                        </p>
                                    </div>
                                </div>

                                <EventImageInput
                                    value={
                                        form.image
                                    }
                                    onChange={(
                                        url
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,
                                                image: url,
                                            })
                                        )
                                    }
                                    testIdPrefix="se-image"
                                    inputClassName={
                                        inp
                                    }
                                />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={
                                        previousStep
                                    }
                                    className="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-full border border-border font-semibold text-sm"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        nextStep
                                    }
                                    className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
                                >
                                    Review event
                                    <Eye className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                    <section className="space-y-5">
                        <div className="rounded-3xl border border-border bg-surface overflow-hidden">
                            {form.image && (
                                <div className="relative aspect-[16/7] bg-muted overflow-hidden">
                                    <img
                                        src={
                                            form.image
                                        }
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="p-6 sm:p-8">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <span className="inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold">
                                            {
                                                form.category
                                            }
                                        </span>

                                        <h2 className="font-display font-black text-3xl mt-3">
                                            {
                                                form.title
                                            }
                                        </h2>

                                        <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                                            <Building2 className="h-4 w-4" />
                                            {
                                                form.orgName
                                            }
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            editSection(
                                                1
                                            )
                                        }
                                        className="text-sm font-semibold text-primary hover:underline"
                                    >
                                        Edit basics
                                    </button>
                                </div>

                                <div className="mt-7 grid sm:grid-cols-2 gap-5 text-sm">
                                    <ReviewItem
                                        label="When"
                                        value={`${new Date(
                                            `${form.date}T12:00`
                                        ).toLocaleDateString(
                                            "en-GB",
                                            {
                                                weekday:
                                                    "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            }
                                        )} · ${
                                            form.start
                                        }${
                                            form.end
                                                ? ` – ${form.end}`
                                                : ""
                                        }`}
                                    />

                                    <ReviewItem
                                        label="Where"
                                        value={
                                            [
                                                form.venue,
                                                form.address,
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    ", "
                                                ) ||
                                            "Not specified"
                                        }
                                    />

                                    <ReviewItem
                                        label="Cost"
                                        value={
                                            form.cost ||
                                            "Not specified"
                                        }
                                    />

                                    <ReviewItem
                                        label="Suitable for"
                                        value={
                                            form.age ||
                                            "Not specified"
                                        }
                                    />

                                    <ReviewItem
                                        label="Accessibility"
                                        value={
                                            form.accessibility ||
                                            "Not specified"
                                        }
                                    />

                                    <ReviewItem
                                        label="Repeats"
                                        value={
                                            form.recurrenceFreq ===
                                            "none"
                                                ? "No"
                                                : `${
                                                      form.recurrenceFreq
                                                  }${
                                                      form.recurrenceUntil
                                                          ? ` until ${new Date(
                                                                `${form.recurrenceUntil}T12:00`
                                                            ).toLocaleDateString(
                                                                "en-GB",
                                                                {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                }
                                                            )}`
                                                          : ""
                                                  }`
                                        }
                                    />
                                </div>

                                {form.description && (
                                    <div className="mt-7">
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                            About
                                        </div>

                                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                                            {
                                                form.description
                                            }
                                        </p>
                                    </div>
                                )}

                                <div className="mt-6">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            editSection(
                                                2
                                            )
                                        }
                                        className="text-sm font-semibold text-primary hover:underline"
                                    >
                                        Edit event
                                        details
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
                            <h2 className="font-display font-bold text-xl">
                                Ready to submit?
                            </h2>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Blackrod Now
                                will review the
                                event before it
                                appears publicly.
                                This helps us
                                catch duplicate,
                                inaccurate or
                                incomplete
                                listings.
                            </p>

                            <label className="mt-5 flex items-start gap-3 text-sm">
                                <input
                                    type="checkbox"
                                    data-testid="se-consent"
                                    checked={
                                        form.consent
                                    }
                                    onChange={set(
                                        "consent"
                                    )}
                                    className="mt-1 h-4 w-4 rounded border-border accent-primary shrink-0"
                                />

                                <span className="text-muted-foreground leading-relaxed">
                                    I confirm I
                                    have the
                                    right to
                                    publish this
                                    event
                                    information
                                    and consent
                                    to it being
                                    displayed and
                                    shared through
                                    Blackrod Now.
                                </span>
                            </label>

                            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={
                                        previousStep
                                    }
                                    disabled={
                                        busy
                                    }
                                    className="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-full border border-border font-semibold text-sm disabled:opacity-50"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>

                                <button
                                    type="submit"
                                    data-testid="se-submit"
                                    disabled={
                                        busy
                                    }
                                    className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
                                >
                                    <Calendar className="h-4 w-4" />

                                    {busy
                                        ? "Submitting…"
                                        : "Submit event"}
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </form>

            <NewsletterSection />
        </div>
    );
}

const inp =
    "w-full px-4 py-2.5 rounded-2xl border border-border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const Field = ({
    label,
    required,
    hint,
    children,
}) => (
    <label className="block">
        <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            {label}{" "}
            {required && (
                <span className="text-primary">
                    *
                </span>
            )}
        </span>

        {hint && (
            <span className="block mt-1 text-xs text-muted-foreground normal-case tracking-normal">
                {hint}
            </span>
        )}

        <div className="mt-1.5">
            {children}
        </div>
    </label>
);

const ReviewItem = ({
    label,
    value,
}) => (
    <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {label}
        </div>

        <div className="mt-1 font-medium leading-relaxed">
            {value}
        </div>
    </div>
);