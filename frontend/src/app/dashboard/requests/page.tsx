"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Key,
  UserCog,
  FolderTree,
  Database,
  AlertCircle,
  Ban,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthenticatedApi } from "@/lib/hooks/useAuthenticatedApi";
import apiClient from "@/lib/api";
import { AccessRequest, RequestType, RequestStatus } from "@/types/api";

export default function RequestsPage() {
  const { data: session } = useSession();
  const { hasToken } = useAuthenticatedApi();
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Dialog states
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const isOwnerOrAdmin =
    session?.user?.role === "owner" || session?.user?.role === "admin";
  // Password change only available for org accounts (not personal)
  const isPersonalAccount = session?.user?.accountType === "personal";

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [myReqs, approvals] = await Promise.all([
        apiClient.getMyAccessRequests(),
        isOwnerOrAdmin ? apiClient.getPendingApprovals() : Promise.resolve([]),
      ]);
      setMyRequests(myReqs);
      setPendingApprovals(approvals);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }, [isOwnerOrAdmin]);

  useEffect(() => {
    if (hasToken) {
      void loadRequests();
    }
  }, [hasToken, loadRequests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.approveAccessRequest(selectedRequest.id, {
        admin_notes: adminNotes,
      });
      setSuccess(
        `Request from ${selectedRequest.requester_name} has been approved`,
      );
      setShowApprovalDialog(false);
      setSelectedRequest(null);
      setAdminNotes("");
      await loadRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to approve request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.rejectAccessRequest(selectedRequest.id, {
        admin_notes: adminNotes,
      });
      setSuccess(
        `Request from ${selectedRequest.requester_name} has been rejected`,
      );
      setShowApprovalDialog(false);
      setSelectedRequest(null);
      setAdminNotes("");
      await loadRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to reject request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await apiClient.cancelAccessRequest(requestId);
      setSuccess("Request cancelled successfully");
      await loadRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to cancel request");
    }
  };

  const getRequestTypeIcon = (type: RequestType) => {
    switch (type) {
      case "password_change":
        return <Key className="h-4 w-4" />;
      case "role_change":
        return <UserCog className="h-4 w-4" />;
      case "compartment_access":
        return <FolderTree className="h-4 w-4" />;
      case "data_access":
        return <Database className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getRequestTypeLabel = (type: RequestType) => {
    switch (type) {
      case "password_change":
        return "Password Change";
      case "role_change":
        return "Role Change";
      case "compartment_access":
        return "Compartment Access";
      case "data_access":
        return "Data Access";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="bg-gray-50 text-gray-700 border-gray-200"
          >
            <Ban className="mr-1 h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filterRequests = (requests: AccessRequest[]) => {
    return requests.filter((req) => {
      const statusMatch = statusFilter === "all" || req.status === statusFilter;
      const typeMatch = typeFilter === "all" || req.request_type === typeFilter;
      return statusMatch && typeMatch;
    });
  };

  const filteredMyRequests = filterRequests(myRequests);
  const filteredPendingApprovals = filterRequests(pendingApprovals);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Access Requests
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage password changes and permission requests
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-48">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label htmlFor="type-filter">Request Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger id="type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {!isPersonalAccount && (
                      <SelectItem value="password_change">
                        Password Change
                      </SelectItem>
                    )}
                    <SelectItem value="role_change">Role Change</SelectItem>
                    <SelectItem value="compartment_access">
                      Compartment Access
                    </SelectItem>
                    <SelectItem value="data_access">Data Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="my-requests">
          <TabsList>
            <TabsTrigger value="my-requests">
              My Requests ({filteredMyRequests.length})
            </TabsTrigger>
            {isOwnerOrAdmin && (
              <TabsTrigger value="pending-approvals">
                Pending Approvals (
                {
                  filteredPendingApprovals.filter((r) => r.status === "pending")
                    .length
                }
                )
              </TabsTrigger>
            )}
          </TabsList>

          {/* My Requests Tab */}
          <TabsContent value="my-requests">
            <Card>
              <CardHeader>
                <CardTitle>My Requests</CardTitle>
                <CardDescription>
                  View all your submitted access requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredMyRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No requests found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMyRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getRequestTypeIcon(request.request_type)}
                              <span className="font-medium">
                                {getRequestTypeLabel(request.request_type)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(request.status)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.reason || "-"}
                          </TableCell>
                          <TableCell>
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(request.id)}
                              >
                                Cancel
                              </Button>
                            )}
                            {request.admin_notes && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                View Notes
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Approvals Tab */}
          {isOwnerOrAdmin && (
            <TabsContent value="pending-approvals">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                  <CardDescription>
                    Review and approve requests from team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredPendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending approvals
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Requester</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPendingApprovals.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {request.requester_name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {request.requester_email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRequestTypeIcon(request.request_type)}
                                <span>
                                  {getRequestTypeLabel(request.request_type)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {request.reason || "-"}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                request.created_at,
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {request.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowApprovalDialog(true);
                                    }}
                                  >
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    Review
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Approval Dialog */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Access Request</DialogTitle>
              <DialogDescription>
                Review and approve or reject this access request
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Requester
                    </Label>
                    <div className="font-medium">
                      {selectedRequest.requester_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedRequest.requester_email}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Request Type
                    </Label>
                    <div className="flex items-center gap-2 font-medium">
                      {getRequestTypeIcon(selectedRequest.request_type)}
                      {getRequestTypeLabel(selectedRequest.request_type)}
                    </div>
                  </div>
                </div>

                {selectedRequest.reason && (
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Reason
                    </Label>
                    <p className="mt-1">{selectedRequest.reason}</p>
                  </div>
                )}

                {selectedRequest.admin_notes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Admin Notes
                    </Label>
                    <p className="mt-1 text-sm">
                      {selectedRequest.admin_notes}
                    </p>
                  </div>
                )}

                {selectedRequest.status === "pending" && (
                  <div>
                    <Label htmlFor="admin-notes">Your Notes (Optional)</Label>
                    <Textarea
                      id="admin-notes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add any notes or comments..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {selectedRequest?.status === "pending" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowApprovalDialog(false);
                      setAdminNotes("");
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isProcessing}
                  >
                    {isProcessing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={handleApprove} disabled={isProcessing}>
                    {isProcessing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setShowApprovalDialog(false);
                    setAdminNotes("");
                  }}
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
