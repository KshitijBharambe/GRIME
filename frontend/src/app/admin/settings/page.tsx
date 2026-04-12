'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings,
  Database,
  Shield,
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'

interface SystemSetting {
  readonly key: string
  readonly value: string | boolean | number
  readonly type: 'text' | 'number' | 'boolean' | 'select'
  readonly options?: readonly string[]
  readonly description: string
  readonly category: string
}

// Mock system settings - in a real app, these would come from an API
const systemSettings: SystemSetting[] = [
  {
    key: 'app_name',
    value: 'Data Quality Management System',
    type: 'text',
    description: 'The name of the application displayed to users',
    category: 'general'
  },
  {
    key: 'app_description',
    value: 'Enterprise data quality management and validation platform',
    type: 'text',
    description: 'Description of the application',
    category: 'general'
  },
  {
    key: 'max_file_size_mb',
    value: 100,
    type: 'number',
    description: 'Maximum file upload size in megabytes',
    category: 'general'
  },
  {
    key: 'session_timeout_minutes',
    value: 480,
    type: 'number',
    description: 'User session timeout in minutes',
    category: 'security'
  },
  {
    key: 'password_min_length',
    value: 8,
    type: 'number',
    description: 'Minimum password length for user accounts',
    category: 'security'
  },
  {
    key: 'enable_2fa',
    value: false,
    type: 'boolean',
    description: 'Enable two-factor authentication for all users',
    category: 'security'
  },
  {
    key: 'failed_login_attempts',
    value: 5,
    type: 'number',
    description: 'Maximum failed login attempts before account lockout',
    category: 'security'
  },
  {
    key: 'email_notifications',
    value: true,
    type: 'boolean',
    description: 'Enable email notifications for system events',
    category: 'notifications'
  },
  {
    key: 'notification_frequency',
    value: 'daily',
    type: 'select',
    options: ['realtime', 'hourly', 'daily', 'weekly'],
    description: 'Frequency of email notifications',
    category: 'notifications'
  },
  {
    key: 'smtp_host',
    value: 'localhost',
    type: 'text',
    description: 'SMTP server hostname for email notifications',
    category: 'notifications'
  },
  {
    key: 'smtp_port',
    value: 587,
    type: 'number',
    description: 'SMTP server port',
    category: 'notifications'
  },
  {
    key: 'data_retention_days',
    value: 365,
    type: 'number',
    description: 'Number of days to retain execution history and logs',
    category: 'data'
  },
  {
    key: 'auto_cleanup',
    value: true,
    type: 'boolean',
    description: 'Automatically clean up old data based on retention policy',
    category: 'data'
  },
  {
    key: 'backup_frequency',
    value: 'daily',
    type: 'select',
    options: ['hourly', 'daily', 'weekly', 'monthly'],
    description: 'Automatic backup frequency',
    category: 'data'
  }
]

interface SettingCardProps {
  readonly setting: SystemSetting
  readonly value: string | boolean | number
  onChange: (key: string, value: string | boolean | number) => void
}

function SettingCard({ setting, value, onChange }: SettingCardProps) {
  const renderInput = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <Switch
            checked={typeof value === 'boolean' ? value : false}
            onCheckedChange={(checked) => onChange(setting.key, checked)}
          />
        )
      case 'select':
        return (
          <Select value={value.toString()} onValueChange={(val) => onChange(setting.key, val)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'number':
        return (
          <Input
            type="number"
            value={typeof value === 'number' ? value : 0}
            onChange={(e) => onChange(setting.key, parseInt(e.target.value) || 0)}
            className="w-48"
          />
        )
      default:
        return (
          <Input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(setting.key, e.target.value)}
            className="w-96"
          />
        )
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Label className="text-base font-medium">
              {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Label>
            <p className="text-sm text-muted-foreground">
              {setting.description}
            </p>
          </div>
          <div className="ml-4">
            {renderInput()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string | boolean | number>>(
    Object.fromEntries(systemSettings.map(s => [s.key, s.value]))
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSettingChange = (key: string, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setHasChanges(false)
    // In a real app, you would make an API call here
  }

  const handleReset = () => {
    setSettings(Object.fromEntries(systemSettings.map(s => [s.key, s.value])))
    setHasChanges(false)
  }

  const getSettingsByCategory = (category: string) => {
    return systemSettings.filter(s => s.category === category)
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              System Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure system-wide settings and preferences
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        {hasChanges && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="data">Data & Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Basic application configuration and behavior settings
                </CardDescription>
              </CardHeader>
            </Card>
            {getSettingsByCategory('general').map((setting) => (
              <SettingCard
                key={setting.key}
                setting={setting}
                value={settings[setting.key]}
                onChange={handleSettingChange}
              />
            ))}
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure authentication, authorization, and security policies
                </CardDescription>
              </CardHeader>
            </Card>
            {getSettingsByCategory('security').map((setting) => (
              <SettingCard
                key={setting.key}
                setting={setting}
                value={settings[setting.key]}
                onChange={handleSettingChange}
              />
            ))}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure email notifications and alert preferences
                </CardDescription>
              </CardHeader>
            </Card>
            {getSettingsByCategory('notifications').map((setting) => (
              <SettingCard
                key={setting.key}
                setting={setting}
                value={settings[setting.key]}
                onChange={handleSettingChange}
              />
            ))}
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data & Backup Settings
                </CardTitle>
                <CardDescription>
                  Configure data retention, backup, and cleanup policies
                </CardDescription>
              </CardHeader>
            </Card>
            {getSettingsByCategory('data').map((setting) => (
              <SettingCard
                key={setting.key}
                setting={setting}
                value={settings[setting.key]}
                onChange={handleSettingChange}
              />
            ))}
          </TabsContent>
        </Tabs>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Current system status and version information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Application Version</Label>
                <p className="text-sm text-muted-foreground">v2.1.0</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Database Status</Label>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Backup</Label>
                <p className="text-sm text-muted-foreground">2024-01-15 03:00:00 UTC</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Server Status</Label>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}