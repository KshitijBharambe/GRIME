"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
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
  Star,
  Twitter,
  Github,
  Linkedin,
  Play,
  Zap,
} from "lucide-react";
import { gsap } from "gsap";
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LiquidEther = dynamic(() => import("./LiquidEther"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0b1220]" />,
});

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

const stats = [
  { value: "50M+", label: "Rows Validated" },
  { value: "99.9%", label: "Uptime" },
  { value: "300+", label: "AI Teams" },
  { value: "5M+", label: "Issues Detected" },
];

const testimonials = [
  {
    quote:
      "DATAFORGE cut our annotation QA time by 80%. We caught 40K bad training examples before fine-tuning — our model accuracy jumped 6 points.",
    author: "Anika Mehra",
    role: "ML Lead, Synthesis AI",
  },
  {
    quote:
      "The anomaly detection models flagged subtle distribution shifts in our LLM eval set that our manual checks completely missed.",
    author: "Jordan Tse",
    role: "AI Data Engineer, NeuralWorks",
  },
  {
    quote:
      "We run DATAFORGE on every dataset version before training. It's the quality gate that ships with our MLOps pipeline now.",
    author: "Carlos Rivas",
    role: "Head of AI Infra, Apex Labs",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("profiling");

  const handleGetStarted = useCallback(() => {
    router.push("/auth/register");
  }, [router]);

  const handleSignIn = useCallback(() => {
    router.push("/auth/login");
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

  const liquidEtherProps = useMemo(
    () => ({
      colors: ["#2563eb", "#1d4ed8", "#0b1220"],
      mouseForce: 30,
      cursorSize: 140,
      isViscous: true,
      viscous: 100,
      iterationsViscous: 32,
      iterationsPoisson: 32,
      resolution: 0.4,
      isBounce: true,
      autoDemo: false,
      autoSpeed: 0.5,
      autoIntensity: 2.2,
      takeoverDuration: 0.1,
      autoResumeDelay: 3000,
      autoRampDuration: 0.8,
    }),
    [],
  );

  const activeFeature = featureTabs.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <span className="text-lg font-bold tracking-widest text-foreground">
            DATAFORGE
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
            <a
              href="#testimonials"
              className="hover:text-foreground transition-colors"
            >
              Testimonials
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
              onClick={handleGetStarted}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 text-sm font-medium"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden bg-[#0b1220]">
        {/* LiquidEther — hero only, no pointer-events leak */}
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          aria-hidden="true"
        >
          <LiquidEther {...liquidEtherProps} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-32 md:pt-36 md:pb-44 text-center">
          <Badge
            variant="secondary"
            className="hero-title mb-6 bg-blue-500/10 text-blue-400 border-blue-500/20"
          >
            Now in Public Beta — GenAI Data Prep
          </Badge>

          <h1 className="hero-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Train Better AI.
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#60a5fa] via-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">
              Start With Clean Data.
            </span>
          </h1>

          <p className="hero-sub mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            DATAFORGE is the data prep platform built for AI teams — profile
            training corpora, validate LLM outputs, detect anomalies, and ship
            cleaner models faster.
          </p>

          <div className="hero-cta mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl px-8 py-6 text-base font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 group"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={scrollToFeatures}
              className="border-white/15 text-white hover:bg-white/5 rounded-xl px-8 py-6 text-base font-semibold group bg-transparent"
            >
              <Play className="mr-2 h-4 w-4" />
              See How It Works
            </Button>
          </div>

          {/* Product mockup placeholder */}
          <div className="mt-16 mx-auto max-w-4xl aspect-video rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#111827] shadow-2xl flex items-center justify-center">
            <span className="text-slate-600 text-sm">Dashboard Preview</span>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section className="border-y border-border bg-muted py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl md:text-4xl font-extrabold text-primary">
                {s.value}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
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

      {/* ── TESTIMONIALS ───────────────────────────────────── */}
      <section
        id="testimonials"
        className="py-24 md:py-32 px-4 sm:px-6 bg-background"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-foreground">
            Trusted by AI Teams
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {t.author}
                  </p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-10">
            {[
              "Synthesis AI",
              "NeuralWorks",
              "Apex Labs",
              "TechVentures",
              "CloudScale",
            ].map((name) => (
              <span
                key={name}
                className="text-muted-foreground/60 text-sm font-medium tracking-wide"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-[#0b1220]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Ready to ship cleaner models?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Start validating your training data in minutes. No credit card
            required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl px-8 py-6 text-base font-semibold shadow-lg shadow-blue-500/30 group"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSignIn}
              className="border-white/15 text-white hover:bg-white/5 rounded-xl px-8 py-6 text-base font-semibold bg-transparent"
            >
              Sign In
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
              DATAFORGE
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
            &copy; {new Date().getFullYear()} DATAFORGE. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
