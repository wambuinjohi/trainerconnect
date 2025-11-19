import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const PromoteProfile: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [commission, setCommission] = useState<number>(20)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const payload = { trainer_id: userId, commission_rate: commission, status: 'pending', created_at: new Date().toISOString() }
      await apiRequest('promotion_insert', payload, { headers: withAuth() })
      toast({ title: 'Promotion requested', description: 'Your profile will be promoted shortly.' })
      onClose?.()
    } catch (err) {
      console.error('Promotion request failed', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to request promotion', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Promote Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Increase commission (%)</Label>
                <Input type="number" min={0} max={100} value={String(commission)} onChange={(e) => setCommission(Number(e.target.value))} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Requesting...' : 'Promote'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
