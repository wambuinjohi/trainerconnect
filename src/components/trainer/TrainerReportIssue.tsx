import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export const TrainerReportIssue: React.FC<{ onDone?: (ref?: string) => void }> = ({ onDone }) => {
  const { user } = useAuth()
  const [type, setType] = useState<'client_misconduct' | 'payment' | 'safety' | 'other'>('client_misconduct')
  const [bookingRef, setBookingRef] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in to report an issue', variant: 'destructive' })
      return
    }
    if (!description.trim()) {
      toast({ title: 'Missing details', description: 'Please provide a description', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const payload: any = {
        user_id: user.id,
        trainer_id: null,
        description,
        status: 'open',
        complaint_type: type,
        booking_reference: bookingRef || null,
        created_at: new Date().toISOString(),
      }
      const data = await apiRequest('issue_insert', payload, { headers: withAuth() })
      const ref = data?.id || ('ISSUE-' + Math.random().toString(36).slice(2, 9).toUpperCase())
      toast({ title: 'Reported', description: `Issue reported: ${String(ref)}` })
      onDone?.(String(ref))
    } catch (err) {
      console.error('Report error', err)
      toast({ title: 'Failed', description: 'Could not report issue', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onDone?.()} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Complaint type</Label>
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full p-2 border border-border rounded-md bg-input">
                  <option value="client_misconduct">Client misconduct</option>
                  <option value="payment">Payment issue</option>
                  <option value="safety">Safety concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>Booking reference (optional)</Label>
                <Input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} placeholder="Booking ID or reference" />
              </div>

              <div>
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
              </div>

              <div>
                <Label>Attachments (optional)</Label>
                <input type="file" multiple onChange={() => {}} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onDone?.()} disabled={loading}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Reporting...' : 'Report'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
