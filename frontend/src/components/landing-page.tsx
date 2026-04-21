"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Upload,
  BookOpen,
  BarChart3,
  AlertTriangle,
  Users,
  Check,
  Play,
  Zap,
  Loader2,
} from "lucide-react";
import { gsap } from "gsap";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signIn, getSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const featureTabs = [
  {
    id: "profiling",
    label: "Corpus Profiling",
    icon: BarChart3,
    headline: "Know Your Training Data Before It Trains Your Model",
    description:
      "Auto-profile any dataset — CSV, JSON, Parquet. Surface null rates, duplicate rows, token distributions, and schema drift before they corrupt your model.",
    benefits: [
      "Column-level stats & histograms",
      "Duplicate & near-duplicate detection",
      "Schema drift alerts",
      "Export-ready audit reports",
    ],
  },
  {
    id: "rules",
    label: "Quality Rules",
    icon: BookOpen,
    headline: "Codify What 'Good Data' Means for Your Use Case",
    description:
      "Build validation rules with the Zero-Code Block Builder or write custom expressions. Version, share, and reuse rule sets across datasets.",
    benefits: [
      "Zero-Code block builder",
      "Custom expression language",
      "Version control & rule history",
      "Reusable rule libraries",
    ],
  },
  {
    id: "execution",
    label: "Batch Validation",
    icon: Zap,
    headline: "Validate Millions of Rows Before Fine-Tuning",
    description:
      "Parallel execution engine processes your entire annotation set or LLM output log in minutes. Get instant pass/fail results with row-level traceability.",
    benefits: [
      "Parallel execution at any scale",
      "Row-level violation details",
      "Severity classification",
      "Incremental re-validation",
    ],
  },
  {
    id: "anomalies",
    label: "Anomaly Detection",
    icon: AlertTriangle,
    headline: "Catch Outliers That Rules Miss",
    description:
      "Train Isolation Forest, One-Class SVM, or LOF models on any dataset version. Flag statistically unusual rows before they bias your fine-tune.",
    benefits: [
      "Isolation Forest & LOF models",
      "Train on any dataset version",
      "Per-row anomaly scores",
      "Auto-flag before training runs",
    ],
  },
  {
    id: "collaboration",
    label: "Team & Governance",
    icon: Users,
    headline: "Data Quality Is a Team Sport",
    description:
      "Compartments, role-based access, and approval workflows keep your org's data governance tight — even across large annotation teams.",
    benefits: [
      "Compartment-based access control",
      "Approval workflows for data changes",
      "Full audit trail",
      "Guest sandbox for contractors",
    ],
  },
];

const steps = [
  {
    number: "01",
    title: "Ingest",
    description:
      "Upload CSV/JSON/Parquet or connect Snowflake, MongoDB, Google Sheets. Auto-profiled on arrival.",
    icon: Upload,
  },
  {
    number: "02",
    title: "Define Rules",
    description:
      "Use the Zero-Code Block Builder or expressions. Rules are versioned and reusable.",
    icon: BookOpen,
  },
  {
    number: "03",
    title: "Run & Find Issues",
    description:
      "Parallel execution flags every violation. Issues classified by severity — ready for your team to fix.",
    icon: Zap,
  },
  {
    number: "04",
    title: "Train & Ship",
    description:
      "Run anomaly models on clean data. Export validated datasets directly to your training pipeline.",
    icon: BarChart3,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("profiling");

  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleSignIn = useCallback(() => {
    router.push("/auth/login");
  }, [router]);

  const handleTryLive = useCallback(async () => {
    setIsGuestLoading(true);
    try {
      let guestBrowserId = localStorage.getItem("guest_browser_id");
      if (!guestBrowserId) {
        guestBrowserId = crypto.randomUUID();
        localStorage.setItem("guest_browser_id", guestBrowserId);
      }
      const result = await signIn("guest", {
        redirect: false,
        callbackUrl: "/dashboard",
        guest_browser_id: guestBrowserId,
      });
      if (!result?.error) {
        const session = await getSession();
        if (session) router.push("/dashboard");
      }
    } finally {
      setIsGuestLoading(false);
    }
  }, [router]);

  const scrollToFeatures = useCallback(() => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /* GSAP entrance animations */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-title",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
      );
      gsap.fromTo(
        ".hero-sub",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.15, ease: "power2.out" },
      );
      gsap.fromTo(
        ".hero-cta",
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          delay: 0.3,
          stagger: 0.1,
          ease: "power2.out",
        },
      );
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const activeFeature = featureTabs.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <span className="text-lg font-bold tracking-widest text-foreground">
            GRIME
          </span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How It Works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="text-muted-foreground hover:text-foreground" />
            <Button
              variant="ghost"
              onClick={handleSignIn}
              className="text-sm font-medium hidden sm:inline-flex"
            >
              Sign In
            </Button>
            <Button
              onClick={handleTryLive}
              disabled={isGuestLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 text-sm font-medium"
            >
              Try live example
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-[#0b1220]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, #1e3a5f 0%, #0b1220 60%)",
        }}
      >
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-28 md:pt-32 md:pb-36 text-center">
          <Badge
            variant="secondary"
            className="hero-title mb-6 bg-blue-500/10 text-blue-400 border-blue-500/20"
          >
            Public Beta — Data Quality for AI Teams
          </Badge>

          <h1 className="hero-title text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Clean data.
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#60a5fa] via-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">
              Better models.
            </span>
          </h1>

          <p className="hero-sub mt-5 text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Profile training corpora, validate LLM outputs, and detect anomalies
            — before they corrupt your model.
          </p>

          <div className="hero-cta mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleTryLive}
              size="lg"
              disabled={isGuestLoading}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl px-7 py-5 text-base font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 group"
            >
              {isGuestLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              See live example
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleSignIn}
              className="text-slate-300 hover:text-white hover:bg-white/5 rounded-xl px-7 py-5 text-base font-semibold"
            >
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="hero-cta mt-3 text-xs text-slate-500">
            No signup required &mdash; explore as a guest instantly.
          </p>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE (Tabbed) ──────────────────────── */}
      <section
        id="features"
        className="py-24 md:py-32 px-4 sm:px-6 bg-background"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-foreground">
            Everything You Need for AI Data Prep
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14">
            From corpus profiling to team governance, one platform replaces your
            patchwork of scripts and manual checks.
          </p>

          {/* Tab bar */}
          <div
            className="flex flex-wrap justify-center gap-2 mb-12"
            role="tablist"
          >
            {featureTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div
            className="grid md:grid-cols-2 gap-10 items-center"
            role="tabpanel"
            aria-label={activeFeature.label}
          >
            <div className="order-2 md:order-1">
              <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                {activeFeature.headline}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {activeFeature.description}
              </p>
              <ul className="space-y-3">
                {activeFeature.benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 text-foreground"
                  >
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2 aspect-[4/3] rounded-2xl border border-border bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                Feature Preview — {activeFeature.label}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-24 md:py-32 px-4 sm:px-6 bg-muted"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            How It Works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-16">
            Four simple steps from raw data to validated, training-ready
            datasets.
          </p>

          <div className="grid md:grid-cols-4 gap-8 md:gap-4 relative">
            <div
              className="hidden md:block absolute top-12 left-[calc(25%+0.5rem)] right-[calc(25%+0.5rem)] h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30"
              aria-hidden="true"
            />
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative z-10 w-24 h-24 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-primary tracking-widest mb-2">
                    STEP {step.number}
                  </span>
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-[#0b1220]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white">
            Ready to ship cleaner models?
          </h2>
          <p className="text-slate-400 mb-6">
            No signup required. Explore immediately as a guest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleTryLive}
              disabled={isGuestLoading}
              size="lg"
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl px-7 text-base font-semibold shadow-lg shadow-blue-500/30 group"
            >
              {isGuestLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Try live example
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleSignIn}
              className="text-slate-300 hover:text-white hover:bg-white/5 rounded-xl px-7 text-base font-semibold"
            >
              Sign in
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-bold tracking-widest text-foreground">
              GRIME
            </span>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
              The data prep platform for AI teams that ship reliable models.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground">
              Product
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="#features"
                  className="hover:text-foreground transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-foreground transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  API Reference
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} GRIME. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
