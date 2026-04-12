'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Building2, Mail, Calendar, Users, Loader2, Save, AlertCircle } from 'lucide-react'
import apiClient from '@/lib/api'
import { Organization } from '@/types/api'
import { MainLayout } from '@/components/layout/main-layout'

export default function OrganizationSettingsPage() {
  const { data: session } = useSession()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const isOwnerOrAdmin = session?.user?.role === 'owner' || session?.user?.role === 'admin'
  const isOwner = session?.user?.role === 'owner'

  useEffect(() => {
    loadOrganizationDetails()
  }, [])

  const loadOrganizationDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const orgData = await apiClient.getOrganizationDetails()
      setOrganization(orgData)
      setName(orgData.name)
      setContactEmail(orgData.contact_email)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load organization details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name || !contactEmail) {
      setError('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const updatedOrg = await apiClient.updateOrganizationDetails({
        name,
        contact_email: contactEmail,
      })
      setOrganization(updatedOrg)
      setSuccess('Organization settings updated successfully')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to update organization settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (organization) {
      setName(organization.name)
      setContactEmail(organization.contact_email)
      setError('')
      setSuccess('')
    }
  }

  const hasChanges =
    organization &&
    (name !== organization.name || contactEmail !== organization.contact_email)

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    )
  }

  if (!isOwnerOrAdmin) {
    return (
      <MainLayout>
        <div className="container max-w-4xl mx-auto py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to view organization settings. Only owners and administrators can access this page.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization&apos;s information and configuration
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

      {/* Organization Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>
            Update your organization&apos;s basic information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name *</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter organization name"
              disabled={!isOwner}
            />
            <p className="text-sm text-muted-foreground">
              This is the display name for your organization
            </p>
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@example.com"
                className="pl-10"
                disabled={!isOwnerOrAdmin}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Primary contact email for organization communications
            </p>
          </div>

          {/* Organization Slug (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="slug">Organization Slug</Label>
            <Input
              id="slug"
              value={organization?.slug || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Unique identifier for your organization (cannot be changed)
            </p>
          </div>

          <Separator />

          {/* Action Buttons */}
          {isOwnerOrAdmin && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={!hasChanges || isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            View your organization&apos;s metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status</span>
            </div>
            <Badge variant={organization?.is_active ? 'default' : 'secondary'}>
              {organization?.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <Separator />

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Created</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {organization?.created_at
                ? new Date(organization.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </span>
          </div>

          <Separator />

          {/* Last Updated */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Last Updated</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {organization?.updated_at
                ? new Date(organization.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </span>
          </div>

          <Separator />

          {/* Your Role */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Your Role</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {session?.user?.role || 'N/A'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone (Owner only) */}
      {isOwner && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Deleting your organization will permanently remove all data, including datasets, rules, executions, and team members. This action cannot be undone.
              </AlertDescription>
            </Alert>
            <Button variant="destructive" disabled>
              Delete Organization
            </Button>
            <p className="text-sm text-muted-foreground">
              Organization deletion is currently disabled. Contact support to delete your organization.
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </MainLayout>
  )
}
