"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Shield,
  Loader2,
  Save,
  AlertCircle,
  Key,
  FileText,
  CheckCircle,
} from "lucide-react";
import apiClient from "@/lib/api";
import { MainLayout } from "@/components/layout/main-layout";

export default function UserProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state - initialize from session
  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState(session?.user?.email || "");

  // Password change request state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const isOwner = session?.user?.role === "owner";
  const isAdmin = session?.user?.role === "admin";
  const isAnalystOrViewer =
    session?.user?.role === "analyst" || session?.user?.role === "viewer";

  // Update form when session changes
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  const handleSaveProfile = async () => {
    if (!name || !email) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      // Note: This assumes there's an endpoint to update user profile
      // You may need to add this endpoint to your API client
      const response = await apiClient.put(`/auth/me`, {
        name,
        email,
      });
      setSuccess("Profile updated successfully");

      // Update session with new name
      await update({ name });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChangeRequest = async () => {
    if (!newPassword || !confirmPassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsSubmittingRequest(true);
    setError("");
    setSuccess("");

    try {
      if (isOwner) {
        // Owners can change password directly
        await apiClient.post(`/auth/change-password`, {
          new_password: newPassword,
        });
        setSuccess("Password changed successfully");
      } else {
        // Non-owners must submit a request
        // Replace with: await apiClient.requestPasswordChange({ new_password: newPassword, reason })
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Mock delay

        setSuccess(
          isAdmin
            ? "Password change request submitted. Awaiting approval from an Owner."
            : "Password change request submitted. Awaiting approval from an Admin or Owner.",
        );
      }

      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
      setReason("");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(
        error.response?.data?.detail ||
          "Failed to submit password change request",
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancel = () => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
      setError("");
      setSuccess("");
    }
  };

  const hasChanges =
    session?.user &&
    (name !== (session.user.name || "") ||
      email !== (session.user.email || ""));

  return (
    <MainLayout>
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            My Profile
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal information and account settings
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10"
                />
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={!hasChanges || isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={!hasChanges || isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>View your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Role</span>
              </div>
              <Badge variant="outline" className="capitalize">
                {session?.user?.role || "N/A"}
              </Badge>
            </div>

            <Separator />

            {/* Organization */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Organization</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {session?.user?.organizationName || "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              {isOwner
                ? "Update your password to keep your account secure"
                : "Request a password change (requires approval)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Permission Info */}
            {!isOwner && (
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  {isAdmin
                    ? "As an Admin, password changes require approval from an Organization Owner."
                    : "Password changes require approval from an Admin or Owner. Submit a request below."}
                </AlertDescription>
              </Alert>
            )}

            {/* Change Password Button */}
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  {isOwner
                    ? "Change your account password"
                    : "Request to change your password"}
                </p>
              </div>
              <Button onClick={() => setShowPasswordDialog(true)}>
                <Key className="mr-2 h-4 w-4" />
                {isOwner ? "Change Password" : "Request Password Change"}
              </Button>
            </div>

            <Separator />

            {/* View Requests Link */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">My Requests</p>
                <p className="text-sm text-muted-foreground">
                  View status of your access requests
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/requests")}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Requests
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isOwner ? "Change Password" : "Request Password Change"}
              </DialogTitle>
              <DialogDescription>
                {isOwner
                  ? "Enter your new password below"
                  : "Submit a request to change your password. This will require approval."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="dialog-newPassword">New Password</Label>
                <Input
                  id="dialog-newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <p className="text-sm text-muted-foreground">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="dialog-confirmPassword">
                  Confirm New Password
                </Label>
                <Input
                  id="dialog-confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              {/* Reason (for non-owners) */}
              {!isOwner && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why do you need to change your password?"
                    rows={3}
                  />
                </div>
              )}

              {/* Approval info */}
              {!isOwner && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {isAdmin
                      ? "Your request will be sent to Organization Owners for approval."
                      : "Your request will be sent to Admins and Owners for approval."}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setReason("");
                }}
                disabled={isSubmittingRequest}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordChangeRequest}
                disabled={
                  !newPassword || !confirmPassword || isSubmittingRequest
                }
              >
                {isSubmittingRequest && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isOwner ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Submit Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
