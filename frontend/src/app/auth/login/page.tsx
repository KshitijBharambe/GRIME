"use client";

import { Suspense, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  Clock,
} from "lucide-react";
import apiClient from "@/lib/api";

const SIGNUP_ENABLED = process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "true";

// ── Shared handlers ──────────────────────────────────────────────

async function signInWithGuest(
  setLoading: (v: boolean) => void,
  setError: (v: string) => void,
  push: (href: string) => void,
) {
  setLoading(true);
  setError("");
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
    if (result?.error) {
      setError("Guest login failed. Please try again.");
    } else {
      const session = await getSession();
      if (session) push("/dashboard");
    }
  } catch {
    setError("Guest login failed. Please try again.");
  } finally {
    setLoading(false);
  }
}

// ── Sign-in tab ──────────────────────────────────────────────────

function SignInTab() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        const session = await getSession();
        if (session) router.push("/dashboard");
      }
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardContent className="space-y-3 pb-5 pt-5 text-center">
          <p className="text-sm font-medium">New here? Explore first.</p>
          <Button
            size="lg"
            variant="outline"
            className="w-full text-base"
            onClick={() =>
              signInWithGuest(setIsGuestLoading, setError, router.push)
            }
            disabled={isGuestLoading || isLoading}
          >
            {isGuestLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Continue as Guest
          </Button>
          <p className="text-xs text-muted-foreground">
            No signup required. Safe read-only trial session.
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            or use your account
          </span>
        </div>
      </div>

      <Card className="border-border/70 bg-card/85 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <div className="relative">
                <Input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isGuestLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Create account tab ────────────────────────────────────────────

function WaitlistView() {
  return (
    <div className="flex flex-col items-center py-8 text-center space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
        <Clock className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Coming soon</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Signup is closed during beta. Explore the app as a guest — no account
          needed.
        </p>
      </div>
    </div>
  );
}

function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await apiClient.registerPersonal({ full_name: name, email, password });
      setSuccess(true);
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (result?.error) {
        router.push("/auth/login");
        return;
      }
      const session = await getSession();
      if (session) router.push("/dashboard");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosError?.response?.data?.detail ??
          "Failed to create account. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/85 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle>Account details</CardTitle>
        <CardDescription>
          Personal account first. Convert to organization admin later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
              <AlertDescription>Account created. Redirecting...</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="reg-name">Full Name</Label>
            <Input
              id="reg-name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading || success}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="admin@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || success}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || success}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isLoading || success}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-confirm">Confirm Password</Label>
            <div className="relative">
              <Input
                id="reg-confirm"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading || success}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading || success}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || success}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main page (reads tab from URL) ───────────────────────────────

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "register" ? "register" : "signin",
  );

  return (
    <div className="relative min-h-[100svh] overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40 px-4 py-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-[1fr_420px] md:items-stretch md:min-h-[calc(100svh-5rem)]">
        {/* Brand panel — desktop only */}
        <Card className="hidden border-primary/20 bg-card/70 shadow-xl backdrop-blur md:block md:h-full">
          <CardContent className="flex h-full flex-col justify-center p-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Cleaner data starts here
              </p>
              <h1 className="text-4xl font-semibold tracking-tight">
                {activeTab === "register" ? "Create account" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTab === "register"
                  ? "Start personal. Promote to org admin later from workspace settings."
                  : "Sign in fast, run checks faster. One login flow for personal and team workspaces."}
              </p>
            </div>
            <div className="mt-12 space-y-2 text-sm text-muted-foreground">
              <p>1. Explore with guest mode.</p>
              <p>2. Create your own account.</p>
              <p>3. Upgrade to organization admin later.</p>
            </div>
          </CardContent>
        </Card>

        {/* Form column */}
        <div className="w-full flex flex-col space-y-5 md:justify-center">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          <div className="text-center md:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <span className="text-xl font-bold text-primary-foreground">
                G
              </span>
            </div>
            <h1 className="text-2xl font-bold">GRIME</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or start with guest access
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <SignInTab />
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              {SIGNUP_ENABLED ? <RegisterForm /> : <WaitlistView />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthPageContent />
    </Suspense>
  );
}
