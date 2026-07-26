import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, Pause, Play, Music2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

const STEP_DURATION_MS = 20000;
const JOURNEY_STAGES = [
  { key: "discover", label: "Discover", start: 0, end: 3 },
  { key: "evaluate", label: "Evaluate", start: 4, end: 7 },
  { key: "act", label: "Act", start: 8, end: 9 },
  { key: "publish", label: "Publish", start: 10, end: 12 },
  { key: "amplify", label: "Amplify", start: 13, end: 14 },
];

const DEMO_STEPS = [
  {
    key: "home-welcome",
    route: "/",
    selector: "[data-testid=home-page]",
    audience: "Everyone",
    journey: "Start",
    title: "Platform walkthrough starts here",
    description: "This five-minute loop shows the full resident and organisation journey from discovery to measurable community reach.",
    value: "One platform for visibility, engagement, updates and local action.",
  },
  {
    key: "home-events-cta",
    route: "/",
    selector: "[data-testid=hero-explore-events]",
    audience: "Residents",
    journey: "Discover",
    title: "Residents discover events in one click",
    description: "The homepage call-to-action takes visitors directly to events, reducing drop-off and improving first-session engagement.",
    value: "Organisations gain visibility faster from homepage traffic.",
  },
  {
    key: "events-search",
    route: "/events",
    selector: "[data-testid=events-search]",
    audience: "Residents",
    journey: "Discover",
    title: "Targeted event search",
    description: "Visitors narrow listings by keyword, category, organisation and tag to find relevant events in seconds.",
    value: "Better discoverability means more qualified attendance for organisers.",
  },
  {
    key: "events-calendar-view",
    route: "/events",
    selector: "[data-testid=view-month]",
    audience: "Residents",
    journey: "Discover",
    title: "List and calendar browsing",
    description: "Users can scan quickly in list mode or plan ahead in month view, covering both spontaneous and planned attendance.",
    value: "More browsing styles means wider audience reach.",
  },
  {
    key: "org-directory",
    route: "/organisations",
    selector: "[data-testid=orgs-search]",
    audience: "Residents",
    journey: "Evaluate",
    title: "Organisation trust and discovery",
    description: "Residents can verify organisers and explore profiles before deciding to attend, follow or engage.",
    value: "Profile pages improve trust and conversion from interest to action.",
  },
  {
    key: "feed-updates",
    route: "/local-feed",
    selector: "[data-testid=feed-source-info]",
    audience: "Residents + Organisations",
    journey: "Evaluate",
    title: "Local feed keeps momentum",
    description: "Short updates keep campaigns and community activity visible between big event dates.",
    value: "Organisations stay top-of-mind, increasing repeat engagement.",
  },
  {
    key: "volunteer-hub",
    route: "/volunteering",
    selector: "[data-testid=volunteer-hero]",
    audience: "Residents + Organisations",
    journey: "Evaluate",
    title: "Volunteer recruitment funnel",
    description: "Dedicated volunteering pages turn community intent into practical support for local causes.",
    value: "Faster volunteer fill rates and clearer calls-to-action.",
  },
  {
    key: "venues-catalog",
    route: "/venues",
    selector: "[data-testid=venues-page]",
    audience: "Residents + Organisations",
    journey: "Evaluate",
    title: "Venue discovery and planning",
    description: "Venues are showcased as reusable local assets for events, clubs and public activity.",
    value: "Helps organisations plan faster and publish with better location context.",
  },
  {
    key: "submit-event-flow",
    route: "/submit-event",
    selector: "[data-testid=submit-event-form]",
    audience: "Community contributors",
    journey: "Act",
    title: "Frictionless event submission",
    description: "The guided form reduces content bottlenecks so events can be submitted and reviewed quickly.",
    value: "More submissions means stronger local coverage and freshness.",
  },
  {
    key: "add-org-flow",
    route: "/add-organisation",
    selector: "[data-testid=add-org-form]",
    audience: "Organisations",
    journey: "Act",
    title: "Organisation onboarding flow",
    description: "New groups join with structured profile, contact and social details to become discoverable immediately.",
    value: "Faster onboarding expands the network and total community reach.",
  },
  {
    key: "org-dashboard-ai",
    route: "/organisation-dashboard",
    selector: "[data-testid=upload-once-section]",
    audience: "Organisations",
    journey: "Publish",
    title: "Create once, publish everywhere",
    description: "Organisations paste a flyer or text once and generate drafts for events, updates and messaging outputs.",
    value: "Less admin time, more consistent publishing cadence.",
  },
  {
    key: "org-notification-bell",
    route: "/organisation-dashboard",
    selector: "[data-testid=notification-bell]",
    audience: "Organisations",
    journey: "Publish",
    title: "Built-in communications loop",
    description: "Notification threads and admin contact features keep publishing, feedback and support in one workflow.",
    value: "Better response times and clearer ownership of updates.",
  },
  {
    key: "admin-overview",
    route: "/admin",
    selector: "[data-testid=admin-page]",
    audience: "Admins",
    journey: "Publish",
    title: "Admin command centre",
    description: "Moderation, approvals and communication controls are centralised so the platform stays accurate and trusted.",
    value: "Governance at scale with clear operational visibility.",
  },
  {
    key: "admin-bulk-parser",
    route: "/admin",
    selector: "[data-testid=admin-bulk-import-section]",
    audience: "Admins",
    journey: "Amplify",
    title: "Bulk parser and publishing streams",
    description: "Upload documents in bulk, classify content and route outputs to events, organisations, local feed, volunteering and venues.",
    value: "Scales content operations without adding manual workload.",
  },
  {
    key: "admin-quick-add",
    route: "/admin",
    selector: "[data-testid=admin-quick-add-event]",
    audience: "Admins + Organisations",
    journey: "Amplify",
    title: "Fast-track publishing and reach",
    description: "Quick-add tools shorten time-to-publish, helping organisations stay visible and audiences informed.",
    value: "Higher publishing frequency drives broader local reach over time.",
  },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function startLoopMusic(onError) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    onError?.();
    return null;
  }

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.055;
  master.connect(ctx.destination);

  const bpm = 102;
  const beatDuration = 60 / bpm;
  const progression = [
    [220.0, 277.18, 329.63],
    [246.94, 311.13, 369.99],
    [261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66],
  ];
  let beat = 0;
  let phase = 0;

  const shimmerBus = ctx.createGain();
  shimmerBus.gain.value = 0.18;
  shimmerBus.connect(master);

  const padBus = ctx.createGain();
  padBus.gain.value = 0.16;
  padBus.connect(master);

  const rhythmBus = ctx.createGain();
  rhythmBus.gain.value = 0.16;
  rhythmBus.connect(master);

  const playTone = (freq, start, duration, wave = "sine", level = 0.16, bus = master) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const playPad = (chord, start) => {
    chord.forEach((f, idx) => {
      playTone(f, start, beatDuration * 7.5, "sine", 0.055 - idx * 0.008, padBus);
      playTone(f * 2, start + 0.02, beatDuration * 4, "triangle", 0.02, padBus);
    });
  };

  const playKick = (start) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.09);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    osc.connect(gain);
    gain.connect(rhythmBus);
    osc.start(start);
    osc.stop(start + 0.13);
  };

  const playHat = (start) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 7000;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
    osc.connect(gain);
    gain.connect(rhythmBus);
    osc.start(start);
    osc.stop(start + 0.05);
  };

  const timer = window.setInterval(() => {
    const now = ctx.currentTime + 0.02;
    const chord = progression[Math.floor((beat % 32) / 8)];
    const pulse = beat % 8;

    if (pulse === 0) {
      playPad(chord, now);
    }

    const arp = [chord[0], chord[1], chord[2], chord[1], chord[0] * 2, chord[2] * 2, chord[1] * 2, chord[2] * 2];
    playTone(arp[pulse], now, beatDuration * 0.8, "triangle", 0.07, shimmerBus);

    if (pulse % 2 === 0) {
      playTone(chord[0] / 2, now, beatDuration * 1.65, "sawtooth", 0.055, padBus);
      playKick(now + 0.005);
    }

    if (pulse === 2 || pulse === 6) {
      playHat(now + 0.004);
    }

    if (pulse === 7) {
      playTone(chord[2] * 2.5, now, beatDuration * 0.28, "square", 0.03, shimmerBus);
    }

    phase = (phase + 1) % 64;
    if (phase === 0) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.06, now + beatDuration * 4);
    }

    beat = (beat + 1) % 32;
  }, beatDuration * 1000);

  const startPromise = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();

  return {
    startPromise,
    stop: () => {
      window.clearInterval(timer);
      master.disconnect();
      ctx.close().catch(() => {});
    },
  };
}

export default function DemoTour() {
  const {
    stats,
    events,
    orgs,
    demoActive,
    demoRole,
    demoStepIndex,
    nextDemoStep,
    prevDemoStep,
    stopDemo,
  } = useApp();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState(null);
  const [paused, setPaused] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicReady, setMusicReady] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const musicControllerRef = useRef(null);

  const steps = useMemo(() => DEMO_STEPS, []);
  const step = steps[demoStepIndex];
  const cycleMs = steps.length * STEP_DURATION_MS;
  const stageIndex = JOURNEY_STAGES.findIndex((stage) => demoStepIndex >= stage.start && demoStepIndex <= stage.end);
  const safeStageIndex = stageIndex < 0 ? 0 : stageIndex;
  const activeStage = JOURNEY_STAGES[safeStageIndex];
  const reachStats = {
    listedEvents: events?.filter((e) => e.status === "approved").length || 0,
    organisations: orgs?.length || 0,
    subscribers: stats?.subscribers || 0,
  };

  useEffect(() => {
    if (!demoActive || !musicEnabled) return;
    if (musicControllerRef.current) return;

    const controller = startLoopMusic(() => setMusicBlocked(true));
    if (!controller) {
      setMusicBlocked(true);
      return;
    }
    musicControllerRef.current = controller;
    controller.startPromise
      .then(() => {
        setMusicReady(true);
        setMusicBlocked(false);
      })
      .catch(() => {
        setMusicBlocked(true);
      });

    return () => {
      controller.stop();
      musicControllerRef.current = null;
      setMusicReady(false);
    };
  }, [demoActive, musicEnabled]);

  useEffect(() => {
    if (!demoActive) {
      musicControllerRef.current?.stop();
      musicControllerRef.current = null;
      setMusicReady(false);
    }
  }, [demoActive]);

  useEffect(() => {
    if (!demoActive || !step) return;
    if (location.pathname !== step.route) {
      setTargetRect(null);
      return;
    }

    let tries = 0;
    const updateTarget = () => {
      const element = document.querySelector(step.selector);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        }, 120);
        return true;
      } else {
        setTargetRect(null);
        return false;
      }
    };

    const timer = window.setInterval(() => {
      tries += 1;
      if (updateTarget() || tries >= 12) {
        window.clearInterval(timer);
      }
    }, 180);

    return () => {
      window.clearInterval(timer);
    };
  }, [demoActive, step, location.pathname]);

  useEffect(() => {
    if (!demoActive || !step) return;
    if (paused) return;

    const timer = window.setTimeout(() => {
      nextDemoStep(steps.length);
    }, STEP_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [demoActive, step, paused, nextDemoStep, steps.length]);

  useEffect(() => {
    const handleResize = () => {
      if (!demoActive || !step) return;
      const element = document.querySelector(step.selector);
      if (element) setTargetRect(element.getBoundingClientRect());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [demoActive, step]);

  if (!demoActive || !step) return null;

  const bubbleWidth = Math.min(380, window.innerWidth - 24);
  const preferredTop = targetRect ? targetRect.bottom + 16 : 96;
  const overflowsBottom = preferredTop + 320 > window.innerHeight - 8;
  const topOffset = targetRect && overflowsBottom ? Math.max(12, targetRect.top - 336) : preferredTop;
  const leftOffset = targetRect
    ? clamp(targetRect.left, 16, window.innerWidth - bubbleWidth - 16)
    : window.innerWidth / 2 - bubbleWidth / 2;
  const bubbleStyle = {
    position: "fixed",
    top: `${targetRect ? topOffset : 76}px`,
    left: `${leftOffset}px`,
    width: `${bubbleWidth}px`,
    zIndex: 60,
  };

  const highlightStyle = targetRect
    ? {
        position: "fixed",
        top: `${Math.max(targetRect.top - 8, 8)}px`,
        left: `${Math.max(targetRect.left - 8, 8)}px`,
        width: `${Math.min(targetRect.width + 16, window.innerWidth - 32)}px`,
        height: `${Math.min(targetRect.height + 16, window.innerHeight - 32)}px`,
        border: "2px solid rgba(251, 191, 36, 0.95)",
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 0 4px rgba(251, 191, 36, 0.6)",
        borderRadius: "20px",
        pointerEvents: "none",
        zIndex: 55,
      }
    : {};

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm pointer-events-none" />
      {targetRect && <div style={highlightStyle} />}
      <div style={bubbleStyle} className="pointer-events-auto">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80 font-bold">
                Demo • {demoRole === "guest" ? "Guest" : demoRole === "org" ? "Organisation" : "Site Admin"} • {step.audience}
              </div>
              <div className="mt-2 text-lg font-semibold text-foreground">
                {step.title}
              </div>
            </div>
            <button
              type="button"
              onClick={stopDemo}
              className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {step.description}
          </p>

          <div className="mt-3 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Why it matters:</span> {step.value}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {JOURNEY_STAGES.map((stage, idx) => (
              <span
                key={stage.key}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${idx === safeStageIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {stage.label}
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-background/70 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Events</div>
              <div className="text-sm font-bold text-foreground">{reachStats.listedEvents}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Organisations</div>
              <div className="text-sm font-bold text-foreground">{reachStats.organisations}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-2 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Subscribers</div>
              <div className="text-sm font-bold text-foreground">{reachStats.subscribers}</div>
            </div>
          </div>

          <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Stage: {activeStage.label} • Step {Math.min(demoStepIndex + 1, steps.length)} of {steps.length} • loops every ~{Math.round(cycleMs / 60000)} minutes
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMusicEnabled((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
            >
              {musicEnabled ? <Music2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {musicEnabled ? "Music on" : "Music off"}
            </button>
            {musicEnabled && musicReady && <span className="text-[11px] text-emerald-600">Playing</span>}
            {musicEnabled && musicBlocked && <span className="text-[11px] text-amber-600">Tap Music on to enable</span>}
          </div>

          <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-700 ease-linear"
              style={{ width: `${((demoStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevDemoStep(steps.length)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              size="sm"
              onClick={() => nextDemoStep(steps.length)}
              className="min-w-[106px]"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
