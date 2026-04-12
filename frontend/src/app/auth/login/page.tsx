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
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import apiClient from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [showOrgSelection, setShowOrgSelection] = useState(false);
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

  const handleInitialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const loginResponse = await apiClient.login({ email, password });
      const orgsData = loginResponse.available_organizations ?? [];

      if (orgsData.length === 0) {
        setError("No organizations found for this user");
        setIsLoading(false);
        return;
      }

      if (orgsData.length === 1) {
        await handleOrgLogin(orgsData[0].id);
      } else {
        setOrganizations(orgsData);
        setShowOrgSelection(true);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Invalid email or password");
      setIsLoading(false);
    }
  };

  const handleOrgLogin = async (orgId: string) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        organizationId: orgId,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError("Login failed. Please try again.");
      } else {
        const session = await getSession();
        if (session) {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrgSelection = async () => {
    if (!selectedOrg) {
      setError("Please select an organization");
      return;
    }
    await handleOrgLogin(selectedOrg);
  };

  const handleSubmit = showOrgSelection
    ? (e: React.FormEvent) => {
        e.preventDefault();
        handleOrgSelection();
      }
    : handleInitialLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-8">
        {/* Back to Landing Page */}
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>

        {/* Logo and header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">
              DH
            </span>
          </div>
          <h1 className="text-3xl font-bold">Data Hygiene Tool</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        {/* Guest Access CTA */}
        <Card>
          <CardContent className="pt-6 pb-6 text-center space-y-3">
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
              Try Free as Guest
            </Button>
            <p className="text-xs text-muted-foreground">
              No signup required &bull; 1 hour session
            </p>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or sign in
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              {showOrgSelection
                ? "Select your organization to continue"
                : "Enter your credentials to access your dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {showOrgSelection ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Select Organization</Label>
                    <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{org.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {org.role ?? "member"}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowOrgSelection(false);
                        setOrganizations([]);
                        setSelectedOrg("");
                      }}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isLoading}
                    >
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </form>

            {/* Demo account bootstrap flow removed. Use guest login or real account sign-in. */}
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?
          </p>
          <div className="flex flex-col gap-1">
            <Link
              href="/auth/register/personal"
              className="text-sm text-primary hover:underline font-medium"
            >
              Create personal account
            </Link>
            <Link
              href="/auth/register"
              className="text-sm text-muted-foreground hover:underline"
            >
              Register organization
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
