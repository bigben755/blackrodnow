import React, { useState } from "react";
import { Printer, Download, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

// A5 at 96 dpi ≈ 559 × 794 px — used for both screen preview and @media print
const A5_W = 559;
const A5_H = 794;

const BRAND_BLUE = "#0052FF";
const BRAND_LIME = "#D2FF00";
const BRAND_DARK = "#020B2A";
const BRAND_MID  = "#0A1A3A";

// Free QR code via goqr.me API — no key required
const qrSrc = (url) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&color=020B2A&bgcolor=D2FF00`;

// ─── Flyer 1: Community / public (magazine + festival leaflet) ───────────────

function FlyerCommunity({ url = "blackrodnow.com", launchDate = "12 September 2026" }) {
    return (
        <div
            className="flyer-print-target"
            style={{
                width: A5_W,
                height: A5_H,
                background: `radial-gradient(ellipse 120% 60% at 10% -5%, rgba(0,82,255,0.65), transparent 55%),
                             radial-gradient(ellipse 80% 50% at 95% 105%, rgba(0,82,255,0.35), transparent 50%),
                             linear-gradient(175deg, ${BRAND_DARK} 0%, ${BRAND_MID} 100%)`,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                color: "#fff",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                padding: "36px 40px 32px",
                boxSizing: "border-box",
            }}
        >
            {/* Subtle grid overlay */}
            <div
                aria-hidden
                style={{
                    position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05,
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            />

            {/* Top: Brand + badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: BRAND_BLUE, boxShadow: `0 0 0 3px rgba(0,82,255,0.35)` }} />
                        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
                            Blackrod · Bolton
                        </span>
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: "#fff" }}>
                        BLACKROD
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: BRAND_LIME }}>
                        NOW
                    </div>
                </div>
                <div style={{
                    background: BRAND_LIME, color: BRAND_DARK, borderRadius: 100,
                    padding: "6px 14px", fontSize: 10, fontWeight: 900,
                    letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap",
                    alignSelf: "flex-start", marginTop: 4,
                }}>
                    Free · No sign-up
                </div>
            </div>

            {/* Main headline */}
            <div style={{ marginTop: 30, flex: 0 }}>
                <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                    Everything
                    <br />
                    <span style={{ color: BRAND_BLUE }}>happening</span> in
                    <br />
                    Blackrod —
                    <br />
                    <span style={{ color: BRAND_LIME }}>one place.</span>
                </div>
                <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.75)", maxWidth: 320 }}>
                    Blackrod Now is a free community hub where you can find local events,
                    clubs, volunteering and spaces to hire. No account needed. Just visit.
                </p>
            </div>

            {/* Feature pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
                {["📅 Events", "🏢 Organisations", "🙌 Volunteering", "🏟 Venues to hire"].map((label) => (
                    <div key={label} style={{
                        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)",
                    }}>
                        {label}
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "22px 0" }} />

            {/* Bottom: QR + URL + launch */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: "auto" }}>
                <div style={{ flexShrink: 0 }}>
                    {/* QR code with lime background */}
                    <div style={{ background: BRAND_LIME, borderRadius: 12, padding: 8, display: "inline-flex" }}>
                        <img
                            src={qrSrc(`https://${url}`)}
                            alt={`QR code for ${url}`}
                            width={100}
                            height={100}
                            style={{ display: "block", borderRadius: 4 }}
                        />
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 5, textAlign: "center" }}>
                        Scan to visit
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                        Visit us at
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", color: BRAND_LIME, lineHeight: 1 }}>
                        {url}
                    </div>
                    <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, padding: "4px 12px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND_LIME }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                            Launching {launchDate}
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer credit */}
            <div style={{ marginTop: 14, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em", textAlign: "center" }}>
                Made possible by the Community Alliance Fund · Free to use · No advertising
            </div>
        </div>
    );
}

// ─── Flyer 2: Organisation outreach ──────────────────────────────────────────

function FlyerOrgs({ url = "blackrodnow.com", launchDate = "12 September 2026" }) {
    return (
        <div
            className="flyer-print-target"
            style={{
                width: A5_W,
                height: A5_H,
                background: "#fff",
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                color: BRAND_DARK,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                padding: "0",
                boxSizing: "border-box",
            }}
        >
            {/* Blue top band */}
            <div style={{ background: BRAND_BLUE, padding: "28px 36px 24px", color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>BLACKROD</div>
                        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: BRAND_LIME }}>NOW</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Launching</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: BRAND_LIME }}>{launchDate}</div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div style={{ padding: "30px 36px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND_BLUE, marginBottom: 10 }}>
                    Is your organisation ready to be found?
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", color: BRAND_DARK }}>
                    Get listed on
                    <br />
                    Blackrod&apos;s free
                    <br />
                    <span style={{ color: BRAND_BLUE }}>community hub</span>
                    <br />
                    before we launch.
                </div>

                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                        { icon: "📅", head: "You run events", body: "Clubs, sports groups, societies — get your events in front of everyone in Blackrod automatically." },
                        { icon: "🏢", head: "You hire out a venue", body: "Halls, facilities, outdoor spaces — let local organisers find and book you." },
                        { icon: "🙌", head: "You need volunteers", body: "Post opportunities and connect with residents who want to give back." },
                    ].map(({ icon, head, body }) => (
                        <div key={head} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND_DARK, marginBottom: 2 }}>{head}</div>
                                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{body}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: "auto", paddingTop: 20 }}>
                    <div style={{ height: 1, background: "#e2e8f0", marginBottom: 18 }} />
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
                        <div style={{ background: BRAND_LIME, borderRadius: 10, padding: 7, display: "inline-flex" }}>
                            <img src={qrSrc(`https://${url}`)} alt={`QR code for ${url}`} width={88} height={88} style={{ display: "block" }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 3 }}>Register free at</div>
                            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em", color: BRAND_BLUE, lineHeight: 1 }}>{url}</div>
                            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>It&apos;s free. No contract. No catch.</div>
                        </div>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 9, color: "#94a3b8", letterSpacing: "0.04em" }}>
                        Made possible by the Community Alliance Fund · Free for all local organisations
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Social square (1:1, 1080×1080 concept at 540px screen preview) ──────────

function FlyerSocial({ url = "blackrodnow.com", launchDate = "12 September 2026" }) {
    const S = 480;
    return (
        <div
            className="flyer-print-target"
            style={{
                width: S, height: S,
                background: `radial-gradient(ellipse 130% 70% at 5% -5%, rgba(0,82,255,0.7), transparent 55%),
                             linear-gradient(160deg, ${BRAND_DARK} 0%, ${BRAND_MID} 100%)`,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 36,
                boxSizing: "border-box",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05,
                backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                backgroundSize: "30px 30px",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>BLACKROD</div>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: BRAND_LIME }}>NOW</div>
                </div>
                <div style={{ background: BRAND_LIME, color: BRAND_DARK, borderRadius: 100, padding: "5px 12px", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Free
                </div>
            </div>

            <div>
                <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                    Everything<br />happening in<br />
                    <span style={{ color: BRAND_LIME }}>Blackrod.</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                    {["Events", "Clubs", "Volunteering", "Venues"].map((t) => (
                        <span key={t} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 100, padding: "3px 12px", fontSize: 11, fontWeight: 600 }}>{t}</span>
                    ))}
                </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: BRAND_LIME, letterSpacing: "-0.01em" }}>{url}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>Launching {launchDate}</div>
                </div>
                <div style={{ background: BRAND_LIME, borderRadius: 8, padding: 6 }}>
                    <img src={qrSrc(`https://${url}`)} alt="" width={72} height={72} style={{ display: "block" }} />
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const VARIANTS = [
    { id: "community", label: "Community flyer", sub: "A5 · magazine & festival leaflet", Component: FlyerCommunity },
    { id: "orgs", label: "Organisation flyer", sub: "A5 · org outreach", Component: FlyerOrgs },
    { id: "social", label: "Social share", sub: "Square 1:1 · Instagram / Facebook", Component: FlyerSocial },
];

export default function Flyers() {
    const [active, setActive] = useState("community");
    const [url, setUrl] = useState("blackrodnow.com");
    const [launchDate, setLaunchDate] = useState("12 September 2026");

    const { Component } = VARIANTS.find((v) => v.id === active);
    const isSocial = active === "social";
    const previewW = isSocial ? 480 : A5_W;

    const handlePrint = () => {
        // Mark which variant is active so @media print targets the right size
        document.body.dataset.flyerVariant = active;
        window.print();
        delete document.body.dataset.flyerVariant;
    };

    return (
        <>
            {/* Print stylesheet injected once into <head> */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .flyer-print-target,
                    .flyer-print-target * { visibility: visible !important; }
                    .flyer-print-target {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                    }
                    @page { size: A5 portrait; margin: 0; }
                }
            `}</style>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Admin
                    </Link>
                    <div>
                        <h1 className="font-display font-black text-3xl tracking-tight">Flyer generator</h1>
                        <p className="text-sm text-muted-foreground mt-1">Print-ready A5 and social media flyers. Use browser print → Save as PDF for best quality.</p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-[280px_1fr] gap-8 items-start">
                    {/* Controls */}
                    <div className="space-y-6">
                        {/* Variant picker */}
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Format</div>
                            <div className="space-y-2">
                                {VARIANTS.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setActive(v.id)}
                                        className={`w-full text-left px-4 py-3 rounded-2xl border transition text-sm ${
                                            active === v.id
                                                ? "border-primary bg-primary/5 font-semibold"
                                                : "border-border hover:bg-muted"
                                        }`}
                                    >
                                        <div className="font-semibold">{v.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{v.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Customise */}
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Customise</div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Website URL</label>
                                    <input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                                        placeholder="blackrodnow.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Launch date text</label>
                                    <input
                                        value={launchDate}
                                        onChange={(e) => setLaunchDate(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                            >
                                <Printer className="h-4 w-4" /> Print / Save as PDF
                            </button>
                            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                                In print dialog: select <strong>Save as PDF</strong>, set paper size to <strong>A5</strong>, margins <strong>None</strong>.
                            </p>
                        </div>

                        {/* Tips */}
                        <div className="rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-1.5">
                            <div className="font-semibold text-foreground">Print tips</div>
                            <div>• For magazine submission: export as PDF at A5, 300dpi</div>
                            <div>• For social: screenshot the preview at 2× zoom</div>
                            <div>• QR code links to the URL above — update before printing</div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Preview — {VARIANTS.find((v) => v.id === active)?.label}
                            </div>
                            <div className="text-xs text-muted-foreground">{isSocial ? "480 × 480 px" : `${A5_W} × ${A5_H} px (A5)`}</div>
                        </div>

                        {/* Centred preview with shadow */}
                        <div
                            className="overflow-auto rounded-2xl border border-border bg-slate-100 dark:bg-slate-800 p-6 flex justify-center"
                            style={{ minHeight: isSocial ? 540 : 860 }}
                        >
                            <div style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.25)", borderRadius: 8, overflow: "hidden", flexShrink: 0, width: previewW }}>
                                <Component url={url} launchDate={launchDate} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
