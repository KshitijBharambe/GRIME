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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  FolderTree,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Folder,
  UserPlus,
  X,
  Link,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuthenticatedApi } from "@/lib/hooks/useAuthenticatedApi";
import apiClient from "@/lib/api";
import { Compartment, CompartmentMember, UserRole } from "@/types/api";

interface CompartmentTreeItemProps {
  readonly compartment: Compartment;
  readonly level: number;
  onSelect: (compartment: Compartment) => void;
  onEdit: (compartment: Compartment) => void;
  onDelete: (compartment: Compartment) => void;
  onAddChild: (parent: Compartment) => void;
  readonly selected?: string;
}

function CompartmentTreeItem({
  compartment,
  level,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  selected,
}: CompartmentTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = compartment.children && compartment.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
          selected === compartment.id ? "bg-muted" : ""
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0 h-4 w-4"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </button>
        <Folder className="h-4 w-4 text-blue-500" />
        <span
          className="flex-1 font-medium"
          onClick={() => onSelect(compartment)}
        >
          {compartment.name}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(compartment);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(compartment);
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          {level > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(compartment);
              }}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {compartment.children?.map((child) => (
            <CompartmentTreeItem
              key={child.id}
              compartment={child}
              level={level + 1}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompartmentsPage() {
  const { data: session } = useSession();
  const { hasToken } = useAuthenticatedApi();
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [selectedCompartment, setSelectedCompartment] =
    useState<Compartment | null>(null);
  const [members, setMembers] = useState<CompartmentMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create/Edit dialog state
  const [showCompartmentDialog, setShowCompartmentDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCompartment, setEditingCompartment] =
    useState<Compartment | null>(null);
  const [parentCompartment, setParentCompartment] =
    useState<Compartment | null>(null);
  const [compartmentName, setCompartmentName] = useState("");
  const [compartmentDescription, setCompartmentDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingCompartment, setDeletingCompartment] =
    useState<Compartment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add member dialog state — with invite verification
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<UserRole>("analyst");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberNotRegistered, setMemberNotRegistered] = useState(false);
  const [registrationLink] = useState(
    `${typeof window !== "undefined" ? window.location.origin : ""}/auth/register`,
  );

  const isOwnerOrAdmin =
    session?.user?.role === "owner" || session?.user?.role === "admin";

  const loadCompartments = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiClient.getCompartments();
      setCompartments(data);
      setSelectedCompartment((prev) => prev ?? data[0] ?? null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to load compartments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasToken) {
      void loadCompartments();
    }
  }, [hasToken, loadCompartments]);

  useEffect(() => {
    if (selectedCompartment && hasToken) {
      loadMembers(selectedCompartment.id);
    }
  }, [selectedCompartment, hasToken]);

  // Reset unregistered warning when email changes
  useEffect(() => {
    setMemberNotRegistered(false);
  }, [memberEmail]);

  const loadMembers = async (compartmentId: string) => {
    try {
      const data = await apiClient.getCompartmentMembers(compartmentId);
      setMembers(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to load members");
    }
  };

  const handleCreateCompartment = (parent?: Compartment) => {
    setIsEditMode(false);
    setEditingCompartment(null);
    setParentCompartment(parent || null);
    setCompartmentName("");
    setCompartmentDescription("");
    setShowCompartmentDialog(true);
  };

  const handleEditCompartment = (compartment: Compartment) => {
    setIsEditMode(true);
    setEditingCompartment(compartment);
    setCompartmentName(compartment.name);
    setCompartmentDescription(compartment.description || "");
    setShowCompartmentDialog(true);
  };

  const handleDeleteCompartment = (compartment: Compartment) => {
    setDeletingCompartment(compartment);
    setShowDeleteDialog(true);
  };

  const handleSaveCompartment = async () => {
    if (!compartmentName) {
      setError("Compartment name is required");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      if (isEditMode && editingCompartment) {
        await apiClient.updateCompartment(editingCompartment.id, {
          name: compartmentName,
          description: compartmentDescription,
        });
        setSuccess("Compartment updated successfully");
      } else {
        await apiClient.createCompartment({
          name: compartmentName,
          description: compartmentDescription,
          parent_compartment_id: parentCompartment?.id,
        });
        setSuccess("Compartment created successfully");
      }
      setShowCompartmentDialog(false);
      await loadCompartments();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to save compartment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCompartment) return;

    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      await apiClient.deleteCompartment(deletingCompartment.id);
      setSuccess("Compartment deleted successfully");
      setShowDeleteDialog(false);
      if (selectedCompartment?.id === deletingCompartment.id) {
        setSelectedCompartment(null);
      }
      await loadCompartments();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to delete compartment");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail || !selectedCompartment) {
      setError("Email is required");
      return;
    }

    setIsAddingMember(true);
    setError("");
    setSuccess("");
    setMemberNotRegistered(false);

    try {
      await apiClient.addCompartmentMember(selectedCompartment.id, {
        user_email: memberEmail,
        role: memberRole,
      });
      setSuccess("Member added successfully");
      setShowMemberDialog(false);
      setMemberEmail("");
      setMemberRole("analyst");
      await loadMembers(selectedCompartment.id);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: string; message?: string } };
        message?: string;
      };
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "";
      // User not found = not registered
      if (
        detail.toLowerCase().includes("not found") ||
        detail.toLowerCase().includes("user") ||
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        setMemberNotRegistered(true);
      } else {
        setError(detail || "Failed to add member");
      }
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedCompartment) return;

    try {
      await apiClient.removeCompartmentMember(selectedCompartment.id, memberId);
      setSuccess("Member removed successfully");
      await loadMembers(selectedCompartment.id);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to remove member");
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <MainLayout>
        <div className="container max-w-6xl mx-auto py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to view compartments. Only owners and
              administrators can access this page.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

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
      <div className="container max-w-7xl mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FolderTree className="h-8 w-8" />
              Compartments
            </h1>
            <p className="text-muted-foreground mt-2">
              Organize resources with hierarchical compartments (IAM)
            </p>
          </div>
          <Button onClick={() => handleCreateCompartment()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Compartment
          </Button>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Compartment Tree */}
          <Card>
            <CardHeader>
              <CardTitle>Compartment Hierarchy</CardTitle>
              <CardDescription>
                Navigate through your compartment structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
                {compartments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No compartments found. Create one to get started.
                  </div>
                ) : (
                  compartments.map((compartment) => (
                    <CompartmentTreeItem
                      key={compartment.id}
                      compartment={compartment}
                      level={0}
                      onSelect={setSelectedCompartment}
                      onEdit={handleEditCompartment}
                      onDelete={handleDeleteCompartment}
                      onAddChild={handleCreateCompartment}
                      selected={selectedCompartment?.id}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Compartment Details & Members */}
          <div className="space-y-6">
            {/* Details Card */}
            {selectedCompartment && (
              <Card>
                <CardHeader>
                  <CardTitle>Compartment Details</CardTitle>
                  <CardDescription>
                    Information about the selected compartment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Name
                    </Label>
                    <p className="font-medium">{selectedCompartment.name}</p>
                  </div>
                  {selectedCompartment.description && (
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Description
                      </Label>
                      <p>{selectedCompartment.description}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Path
                    </Label>
                    <p className="font-mono text-sm">
                      {selectedCompartment.path}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Status
                    </Label>
                    <Badge
                      variant={
                        selectedCompartment.is_active ? "default" : "secondary"
                      }
                    >
                      {selectedCompartment.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members Card */}
            {selectedCompartment && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Members ({members.length})</CardTitle>
                      <CardDescription>
                        Users with access to this compartment
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setShowMemberDialog(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No members in this compartment
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {member.user_name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {member.user_email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {member.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Create/Edit Compartment Dialog */}
        <Dialog
          open={showCompartmentDialog}
          onOpenChange={setShowCompartmentDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Compartment" : "Create Compartment"}
              </DialogTitle>
              <DialogDescription>
                {(() => {
                  if (isEditMode) return "Update compartment information";
                  if (parentCompartment)
                    return `Create a new sub-compartment under ${parentCompartment.name}`;
                  return "Create a new root compartment";
                })()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={compartmentName}
                  onChange={(e) => setCompartmentName(e.target.value)}
                  placeholder="Enter compartment name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={compartmentDescription}
                  onChange={(e) => setCompartmentDescription(e.target.value)}
                  placeholder="Enter compartment description"
                  rows={3}
                />
              </div>

              {parentCompartment && (
                <Alert>
                  <FolderTree className="h-4 w-4" />
                  <AlertDescription>
                    Parent: <strong>{parentCompartment.name}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCompartmentDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveCompartment} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Compartment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <strong>{deletingCompartment?.name}</strong>? This will also
                delete all sub-compartments and remove resource assignments.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Member Dialog */}
        <Dialog
          open={showMemberDialog}
          onOpenChange={(open) => {
            setShowMemberDialog(open);
            if (!open) {
              setMemberEmail("");
              setMemberRole("analyst");
              setMemberNotRegistered(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member to Compartment</DialogTitle>
              <DialogDescription>
                Grant a user access to {selectedCompartment?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">User Email *</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              {memberNotRegistered && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong>{memberEmail}</strong> is not registered on this
                      platform.
                    </p>
                    <p className="text-sm">
                      Share the registration link with them:
                    </p>
                    <div className="flex items-center gap-2 p-2 bg-white rounded border text-xs font-mono break-all">
                      {registrationLink}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(registrationLink);
                          setSuccess("Registration link copied!");
                        }}
                      >
                        <Link className="h-3 w-3" />
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {!memberNotRegistered && (
                <div className="space-y-2">
                  <Label htmlFor="member-role">Role</Label>
                  <Select
                    value={memberRole}
                    onValueChange={(value: UserRole) => setMemberRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMemberDialog(false);
                  setMemberEmail("");
                  setMemberRole("analyst");
                  setMemberNotRegistered(false);
                }}
                disabled={isAddingMember}
              >
                Cancel
              </Button>
              {!memberNotRegistered && (
                <Button onClick={handleAddMember} disabled={isAddingMember}>
                  {isAddingMember && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Member
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
