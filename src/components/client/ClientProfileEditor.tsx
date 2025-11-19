import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const ClientProfileEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>({})

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    apiRequest('profile_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => {
        if (data) {
          setProfile(data)
        }
      })
      .catch((error: any) => {
        console.warn('Failed to load profile', error)
      })
      .finally(() => setLoading(false))
  }, [userId])

  const save = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const payload = {
        user_id: userId,
        full_name: profile.full_name || null,
        phone_number: profile.phone_number || null,
        profile_image: profile.profile_image || null,
        bio: profile.bio || null,
        location: (profile.location || profile.location_label || '') || null,
      }
      await apiRequest('profile_update', payload, { headers: withAuth() })
      toast({ title: 'Saved', description: 'Profile updated' })
      onClose?.()
    } catch (err) {
      console.error('Save client profile error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={profile.phone_number || ''} onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })} />
              </div>
              <div>
                <Label>Locality</Label>
                <Input placeholder="e.g. Nairobi, Parklands" value={(profile.location || profile.location_label) || ''} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </div>
              <div>
                <Label>Profile image URL</Label>
                <Input value={profile.profile_image || ''} onChange={(e) => setProfile({ ...profile, profile_image: e.target.value })} />
              </div>
              <div>
                <Label>Bio</Label>
                <textarea className="w-full p-2 border border-border rounded-md bg-input" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={4} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancel</Button>
                <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
