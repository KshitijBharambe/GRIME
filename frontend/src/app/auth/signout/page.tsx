'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function SignOutPage() {
  const router = useRouter()

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        await signOut({
          redirect: false,
          callbackUrl: '/auth/login'
        })
        router.push('/auth/login')
      } catch (error) {
        console.error('Error signing out:', error)
        router.push('/auth/login')
      }
    }

    handleSignOut()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">DH</span>
          </div>
          <h1 className="text-3xl font-bold">GRIME</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Signing you out...</CardTitle>
            <CardDescription>
              Please wait while we sign you out securely
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}