import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

const DEMO_CONFIG = {
  guest: [
    {
      key: "home-hero",
      route: "/",
      selector: "[data-testid=hero-explore-events]",
      title: "Welcome to Blackrod Now",
      description:
        "This homepage brings together local events, organisations and opportunities in one place. Start by browsing what’s on or by sharing a local activity.",
    },
    {
      key: "events-search",
      route: "/events",
      selector: "[data-testid=events-search]",
      title: "Search and filter events",
      description:
        "Use the search bar and filters to find what matters most, including categories, organisations and accessible or family-friendly listings.",
    },
    {
      key: "orgs-search",
      route: "/organisations",
      selector: "[data-testid=orgs-search]",
      title: "Explore local organisations",
      description:
        "Discover clubs, groups and community projects across Blackrod, and view their profiles with contact and event information.",
    },
    {
      key: "submit-event",
      route: "/",
      selector: "[data-testid=hero-submit-event]",
      title: "Share a local event",
      description:
        "When you spot something worth sharing, use the Submit Event call to post it quickly and help the community stay informed.",
    },
  ],
  org: [
    {
      key: "org-dashboard-welcome",
      route: "/organisation-dashboard",
      selector: "[data-testid=org-dashboard]",
      title: "Organisation dashboard",
      description:
        "This dashboard is your club or organisation control centre. Manage events, updates and membership tools from one page.",
    },
    {
      key: "org-ai",
      route: "/organisation-dashboard",
      selector: "[data-testid=upload-once-section]",
      title: "Upload once, publish everywhere",
      description:
        "Paste your flyer or update here and the site will turn it into event, social and notification drafts in one step.",
    },
    {
      key: "org-parse-btn",
      route: "/organisation-dashboard",
      selector: "[data-testid=ai-parse-btn]",
      title: "Generate drafts quickly",
      description:
        "Click Generate drafts to see how AI helps you publish event or update content with less typing.",
    },
    {
      key: "org-quick-actions",
      route: "/organisation-dashboard",
      selector: "[data-testid=qa-profile]",
      title: "Manage club details",
      description:
        "Quick actions let you update your profile, upload documents and add or manage social links from this dashboard.",
    },
  ],
  admin: [
    {
      key: "admin-welcome",
      route: "/admin",
      selector: "[data-testid=admin-page]",
      title: "Site admin overview",
      description:
        "As a site admin you can approve events, manage organisations and keep the community feed healthy from one place.",
    },
    {
      key: "admin-pending-events",
      route: "/admin",
      selector: "[data-testid=admin-pending-events-section]",
      title: "Review pending events",
      description:
        "Pending events appear here first. Approve or reject them to keep the calendar current and accurate.",
    },
    {
      key: "admin-pending-orgs",
      route: "/admin",
      selector: "[data-testid=admin-pending-orgs-section]",
      title: "Manage organisation approvals",
      description:
        "Approve or reject organisation listings so only trusted, up-to-date groups are shown to the community.",
    },
    {
      key: "admin-subscribers",
      route: "/admin",
      selector: "[data-testid=admin-subscriber-section]",
      title: "Subscriber and user control",
      description:
        "Monitor the subscriber list and reset account access in one place for faster community support.",
    },
  ],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function DemoTour() {
  const {
    demoActive,
    demoRole,
    demoStepIndex,
    nextDemoStep,
    prevDemoStep,
    stopDemo,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = useState(null);
  const [ready, setReady] = useState(false);

  const steps = useMemo(() => DEMO_CONFIG[demoRole] || [], [demoRole]);
  const step = steps[demoStepIndex];

  useEffect(() => {
    if (!demoActive || !step) return;
    if (location.pathname !== step.route) {
      navigate(step.route, { replace: true });
      return;
    }

    const updateTarget = () => {
      const element = document.querySelector(step.selector);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        }, 100);
      } else {
        setTargetRect(null);
      }
    };

    setReady(false);
    const timer = window.setTimeout(() => {
      updateTarget();
      setReady(true);
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [demoActive, step, location.pathname, navigate]);

  useEffect(() => {
    if (!demoActive || !step) return;
    if (demoStepIndex >= steps.length) {
      stopDemo();
    }
  }, [demoActive, demoStepIndex, steps.length, stopDemo, step]);

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

  const bubbleWidth = 340;
  const topOffset = targetRect ? targetRect.bottom + 16 : 96;
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
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      {targetRect && <div style={highlightStyle} />}
      <div style={bubbleStyle} className="pointer-events-auto">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80 font-bold">
                Demo • {demoRole === "guest" ? "Guest" : demoRole === "org" ? "Organisation" : "Site Admin"}
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

          <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Step {Math.min(demoStepIndex + 1, steps.length)} of {steps.length} • under 2 minutes
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevDemoStep}
              disabled={demoStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              size="sm"
              onClick={nextDemoStep}
              className="min-w-[106px]"
            >
              {demoStepIndex + 1 < steps.length ? (
                <>
                  Next <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                "Finish"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
