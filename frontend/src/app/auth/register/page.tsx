"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { Loader2, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      await apiClient.registerPersonal({
        full_name: name,
        email,
        password,
      });

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
      if (session) {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { detail?: string } } };
        if (axiosError.response?.data?.detail) {
          setError(axiosError.response.data.detail);
        } else {
          setError("Failed to create account. Please try again.");
        }
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40 px-4 py-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-20 bottom-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-[1fr_420px] md:items-stretch md:min-h-[calc(100svh-5rem)]">
        <Card className="hidden border-primary/20 bg-card/70 shadow-xl backdrop-blur md:block md:h-full">
          <CardContent className="flex h-full flex-col justify-center p-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                One account. Then scale.
              </p>
              <h1 className="text-4xl font-semibold tracking-tight">
                Create account
              </h1>
              <p className="text-sm text-muted-foreground">
                Start personal. Promote to org admin later from workspace
                settings.
              </p>
            </div>
            <div className="mt-12 space-y-2 text-sm text-muted-foreground">
              <p>1. Create account.</p>
              <p>2. Sign in instantly.</p>
              <p>3. Invite team when ready.</p>
            </div>
          </CardContent>
        </Card>

        <div className="w-full flex flex-col space-y-5 md:justify-center">
          <div className="flex justify-start">
            <Button
              variant="ghost"
              onClick={() => router.push("/auth/login")}
              className="text-muted-foreground hover:text-foreground"
              type="button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>

          <div className="text-center md:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <span className="text-xl font-bold text-primary-foreground">
                DH
              </span>
            </div>
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="mt-2 text-muted-foreground">
              Team setup comes later, inside app.
            </p>
          </div>

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
                    <AlertDescription>
                      Account created. Redirecting...
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading || success}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || success}
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
                      disabled={isLoading || success}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
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
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
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
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
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
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Account
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Need to sign in instead?{" "}
                  <Link
                    href="/auth/login"
                    className="font-medium text-primary hover:underline"
                  >
                    Go to login
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
