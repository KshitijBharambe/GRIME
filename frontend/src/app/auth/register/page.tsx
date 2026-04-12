"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function RegisterPage() {
  // Organization fields
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Admin user fields
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

  // Auto-generate slug from org name
  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    const slug = value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "");
    setOrgSlug(slug);
  };

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
      await apiClient.registerOrganization({
        name: orgName,
        slug: orgSlug,
        contact_email: contactEmail,
        admin_name: name,
        admin_email: email,
        admin_password: password,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
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
    <div className="min-h-screen flex bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <aside className="relative hidden md:flex md:w-2/5 flex-col justify-between overflow-hidden bg-[#0f172a] p-10 text-blue-100 lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.2),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(37,99,235,0.2),transparent_40%)]" />

        <div className="relative">
          <p className="text-xs uppercase tracking-[0.28em] text-blue-300">
            Data Hygiene Tool
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white">
            Protect every model before it learns the wrong lesson.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-blue-200">
            Validate your AI training data. Catch issues before they corrupt
            your model.
          </p>

          <div className="mt-10 space-y-4 text-sm text-blue-100/95">
            <p>→ Schema and quality checks before ingestion</p>
            <p>→ Drift detection with actionable signals</p>
            <p>→ Versioned rule sets for confident releases</p>
            <p>→ Team-ready audit trails and approvals</p>
          </div>
        </div>

        <blockquote className="relative max-w-sm border-l border-blue-400/40 pl-4 text-sm text-blue-200">
          <p>
            "This is the first gate we trust before any training run goes live."
          </p>
          <span className="mt-2 block text-blue-300">
            Data Platform Lead, Example Co.
          </span>
        </blockquote>
      </aside>

      <main className="w-full md:w-3/5 bg-background px-4 py-8 sm:px-8 md:px-10 lg:px-16">
        <div className="mx-auto flex min-h-full w-full max-w-2xl items-center">
          <div className="w-full rounded-2xl border border-border/70 bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Create your account
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => router.push("/auth/login")}
                    className="font-medium text-primary hover:underline"
                    type="button"
                  >
                    Sign in
                  </button>
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => router.push("/")}
                className="text-muted-foreground hover:text-foreground"
                type="button"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Home
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
                  <AlertDescription>
                    Organization created successfully! Redirecting to login...
                  </AlertDescription>
                </Alert>
              )}

              <section className="rounded-xl border border-border p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Organization
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      type="text"
                      placeholder="e.g., Acme Corporation"
                      value={orgName}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
                      required
                      disabled={isLoading || success}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="orgSlug">Organization Slug</Label>
                    <Input
                      id="orgSlug"
                      type="text"
                      placeholder="e.g., acme-corporation"
                      value={orgSlug}
                      required
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from organization name. Used in URLs and
                      must be unique.
                    </p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="contactEmail">
                      Organization Contact Email
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@acme.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      disabled={isLoading || success}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Admin Account
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
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

                  <div className="space-y-2 sm:col-span-2">
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
                </div>
              </section>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading || success}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Organization & Admin Account
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Looking for a personal account?{" "}
                <Link
                  href="/auth/register/personal"
                  className="font-medium text-primary hover:underline"
                >
                  Create one here
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
