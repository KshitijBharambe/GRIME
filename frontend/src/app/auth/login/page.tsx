"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const router = useRouter();

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    setError("");

    try {
      const result = await signIn("guest", {
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError("Guest login failed. Please try again.");
      } else {
        const session = await getSession();
        if (session) {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Guest login failed. Please try again.");
    } finally {
      setIsGuestLoading(false);
    }
  };

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
        if (session) {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

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
        <Card className="hidden border-primary/20 bg-card/70 shadow-xl backdrop-blur md:block md:h-full">
          <CardContent className="flex h-full flex-col justify-center p-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Cleaner data starts here
              </p>
              <h1 className="text-4xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in fast, run checks faster. One login flow for personal and
                team workspaces.
              </p>
            </div>
            <div className="mt-12 space-y-2 text-sm text-muted-foreground">
              <p>1. Explore with guest mode.</p>
              <p>2. Create your own account.</p>
              <p>3. Upgrade to organization admin later.</p>
            </div>
          </CardContent>
        </Card>

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
                DH
              </span>
            </div>
            <h1 className="text-2xl font-bold">Data Hygiene Tool</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to continue, or start with guest access
            </p>
          </div>

          <Card className="border-border/70 bg-card/80 shadow-lg backdrop-blur">
            <CardContent className="space-y-3 pb-6 pt-6 text-center">
              <p className="text-sm font-medium">New here? Explore first.</p>
              <Button
                size="lg"
                variant="outline"
                className="w-full text-base"
                onClick={handleGuestLogin}
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
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
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign In
                </Button>
              </form>

              <p className="mt-4 text-xs text-muted-foreground">
                No organization picker here. Organization access applies
                automatically after account setup.
              </p>
            </CardContent>
          </Card>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?
            </p>
            <Link
              href="/auth/register"
              className="text-sm font-medium text-primary hover:underline"
            >
              Create your account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
