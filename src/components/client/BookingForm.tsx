import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

export const BookingForm: React.FC<{ trainer: any, onDone?: () => void }> = ({ trainer, onDone }) => {
  const { user } = useAuth()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [sessions, setSessions] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const [payMethod, setPayMethod] = useState<'mpesa' | 'mock'>('mpesa')
  const [mpesaPhone, setMpesaPhone] = useState('')

  const computeBaseAmount = () => (Number(trainer.hourlyRate || 0) * Number(sessions || 1))
  const settings = loadSettings()
  const clientChargePct = Math.max(0, Math.min(100, Number(settings.platformChargeClientPercent || 0)))
  const trainerChargePct = Math.max(0, Math.min(100, Number(settings.platformChargeTrainerPercent || 0)))
  const vatPct = Math.max(0, Math.min(100, Number(settings.taxRate || 0)))

  const submit = async () => {
    if (!user) return
    if (!date || !time) {
      toast({ title: 'Missing info', description: 'Please select date and time', variant: 'destructive' })
      return
    }
    setLoading(true)
    const baseAmount = computeBaseAmount()
    let totalAmount = baseAmount

    // Load client saved location to link to booking
    let clientLocation: { label?: string; lat?: number | null; lng?: number | null } = {}
    try {
      const prof = await apiRequest('profile_get', { user_id: user.id }, { headers: withAuth() })
      const label = (prof?.location_label as string) || (prof?.location as string) || ''
      const lat = prof?.location_lat != null ? Number(prof.location_lat) : null
      const lng = prof?.location_lng != null ? Number(prof.location_lng) : null
      clientLocation = { label, lat, lng }
    } catch {}

    // Try apply referral code
    if (referralCode.trim()) {
      try {
        const code = referralCode.trim().toUpperCase()
        const row = await apiRequest('referral_get', { code }, { headers: withAuth() })
        if (row && !row.discount_used && row.referrer_id !== user.id) {
          const settings = loadSettings()
          const pct = Math.max(0, Math.min(100, settings.referralClientDiscount || 0))
          const discount = Math.round((baseAmount * pct) / 100)
          totalAmount = Math.max(0, baseAmount - discount)
          setAppliedDiscount(discount)
          try {
            await apiRequest('referral_update', { id: row.id, referee_id: user.id, discount_used: true, discount_amount: discount }, { headers: withAuth() })
          } catch {}
        }
      } catch (e) {
        console.warn('Referral validation error', e)
      }
    }

    // Apply platform client surcharge and VAT to what client pays
    const clientCommission = Math.round((totalAmount * clientChargePct) / 100)
    const vatAmount = Math.round(((totalAmount + clientCommission) * vatPct) / 100)
    const clientTotal = totalAmount + clientCommission + vatAmount

    const payload: any = {
      client_id: user.id,
      trainer_id: trainer.id,
      session_date: date,
      session_time: time,
      duration_hours: 1,
      total_sessions: sessions,
      status: 'pending',
      total_amount: clientTotal,
      notes,
      client_location_label: (clientLocation.label || null),
      client_location_lat: (clientLocation.lat != null ? clientLocation.lat : null),
      client_location_lng: (clientLocation.lng != null ? clientLocation.lng : null),
    }

    try {
      // create booking
      const bookingData = await apiRequest('booking_insert', payload, { headers: withAuth() })

      // in-app notifications: client, trainer, admins
      try {
        const trainerUserId = trainer.id
        const nowIso = new Date().toISOString()
        const notifRows: any[] = [
          { user_id: user.id, title: 'Booking submitted', body: `Your booking with trainer has been created for ${date} ${time}.`, created_at: nowIso, read: false },
          { user_id: trainerUserId, title: 'New booking request', body: `A client requested ${date} ${time}.`, created_at: nowIso, read: false },
        ]
        try {
          const admins = await apiRequest('profiles_get_by_type', { user_type: 'admin' }, { headers: withAuth() })
          for (const a of (admins || [])) notifRows.push({ user_id: a.user_id, title: 'New booking', body: `Booking from ${user.email || user.id} to trainer ${trainer.name || trainer.id}.`, created_at: nowIso, read: false })
        } catch {}
        if (notifRows.length) await apiRequest('notifications_insert', { notifications: notifRows }, { headers: withAuth() })
      } catch (err) {
        console.warn('Notification insert failed', err)
      }

      let paymentRecord: any = null

      if (payMethod === 'mpesa') {
        if (!mpesaPhone.trim()) { toast({ title: 'Phone required', description: 'Enter your M-Pesa phone number (e.g., 2547XXXXXXX)', variant: 'destructive' }); throw new Error('phone required') }
        toast({ title: 'M-Pesa STK', description: 'Check your phone and enter PIN to approve.' })
        const initRes = await fetch('/payments/mpesa/stk-initiate', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ phone: mpesaPhone.trim(), amount: clientTotal, booking_id: bookingData?.id, account_reference: bookingData?.id || 'booking', transaction_desc: 'Training session payment' }) })
        const initJson = await initRes.json().catch(()=>null)
        if (!initRes.ok || !initJson?.ok) { toast({ title: 'Payment failed', description: initJson?.error || 'Failed to initiate STK push', variant: 'destructive' }); throw new Error(initJson?.error || 'init failed') }
        const checkoutId = initJson?.result?.CheckoutRequestID || ''
        if (!checkoutId) { toast({ title: 'Payment error', description: 'Missing CheckoutRequestID', variant: 'destructive' }); throw new Error('no checkout id') }

        // Poll for result
        let success = false
        let attempts = 0
        let lastResult: any = null
        while (attempts < 20) {
          await new Promise(r => setTimeout(r, 3000))
          const qRes = await fetch('/payments/mpesa/stk-query', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ checkout_request_id: checkoutId }) })
          const qJson = await qRes.json().catch(()=>null)
          lastResult = qJson?.result || null
          const rc = Number((lastResult?.ResultCode ?? lastResult?.ResponseCode) || -1)
          if (rc === 0) { success = true; break }
          // Pending codes: 1, 1032 (cancelled), 1037 (timeout) -> continue polling for a short while
          if (rc === 1032) break
          attempts += 1
        }

        if (!success) {
          // mark failed
          try { await apiRequest('payment_insert', { booking_id: bookingData?.id || null, user_id: user.id, amount: clientTotal, status: 'failed', method: 'mpesa', created_at: new Date().toISOString() }, { headers: withAuth() }) } catch {}
          try { if (bookingData?.id) await apiRequest('booking_update', { id: bookingData.id, status: 'pending' }, { headers: withAuth() }) } catch {}
          toast({ title: 'Payment not completed', description: 'You can retry from your dashboard', variant: 'destructive' })
          setLoading(false)
          return
        }

        paymentRecord = { booking_id: bookingData?.id || null, user_id: user.id, amount: clientTotal, status: 'completed', method: 'mpesa', created_at: new Date().toISOString() }
        try { await apiRequest('payment_insert', paymentRecord, { headers: withAuth() }) } catch {}
        try { if (bookingData?.id) await apiRequest('booking_update', { id: bookingData.id, status: 'confirmed' }, { headers: withAuth() }) } catch {}
      } else {
        // Mock immediate success
        paymentRecord = {
          booking_id: bookingData?.id || null,
          user_id: user.id,
          amount: clientTotal,
          status: 'completed',
          method: 'mock',
          created_at: new Date().toISOString(),
        }
        try {
          await apiRequest('payment_insert', paymentRecord, { headers: withAuth() })
        } catch (err) {
          console.warn('Payment insert exception', err)
        }
        if (bookingData?.id) {
          try { await apiRequest('booking_update', { id: bookingData.id, status: 'confirmed' }, { headers: withAuth() }) } catch {}
        }
      }

      try {
        const hook = (import.meta.env.VITE_ZAPIER_WEBHOOK_URL || import.meta.env.NEXT_PUBLIC_ZAPIER_WEBHOOK_URL) as string | undefined
        if (hook) {
          await fetch(hook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'booking_created', booking: bookingData, payer: paymentRecord }),
          })
        }
      } catch (err) {
        console.warn('Zapier webhook error', err)
      }

      onDone?.()
    } catch (err) {
      console.error('Booking error', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border border-border rounded-md bg-card max-h-[60vh] overflow-auto">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label>Session Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Session Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <Label>Number of Sessions</Label>
          <Input type="number" min={1} value={String(sessions)} onChange={(e) => setSessions(Number(e.target.value))} />
        </div>
        <div>
          <Label>Referral Code (optional)</Label>
          <Input value={referralCode} onChange={(e)=>setReferralCode(e.target.value)} placeholder="Enter code" />
          {appliedDiscount > 0 && <div className="text-xs text-blue-500 mt-1">Discount applied: −Ksh {appliedDiscount}</div>}
        </div>
        <div>
          <Label>Notes</Label>
          <input className="w-full p-2 border border-border rounded-md bg-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <Label>Payment Method</Label>
          <select className="w-full p-2 border border-border rounded-md bg-input" value={payMethod} onChange={(e)=>setPayMethod(e.target.value as any)}>
            <option value="mpesa">M-Pesa (STK Push)</option>
            <option value="mock">Mock (for testing)</option>
          </select>
        </div>
        {payMethod === 'mpesa' && (
          <div>
            <Label>M-Pesa Phone (2547XXXXXXX)</Label>
            <Input value={mpesaPhone} onChange={(e)=>setMpesaPhone(e.target.value)} placeholder="2547XXXXXXXX" />
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
          <div className="flex justify-between"><span>Rate</span><span className="font-semibold">Ksh {Number(trainer.hourlyRate || 0)}/hr</span></div>
          <div className="flex justify-between"><span>Sessions</span><span className="font-semibold">{sessions}</span></div>
          {appliedDiscount > 0 && <div className="flex justify-between text-blue-500"><span>Discount</span><span>−Ksh {appliedDiscount}</span></div>}
          {(() => { const base = computeBaseAmount() - appliedDiscount; const clientFee = Math.round((base * clientChargePct)/100); const vat = Math.round(((base + clientFee) * vatPct)/100); const total = base + clientFee + vat; return (
            <>
              <div className="flex justify-between"><span>Platform fee ({clientChargePct}%)</span><span>+Ksh {clientFee}</span></div>
              <div className="flex justify-between"><span>VAT ({vatPct}%)</span><span>+Ksh {vat}</span></div>
              <div className="flex justify-between mt-2"><span className="font-medium">Total</span><span className="font-bold">Ksh {total}</span></div>
            </>
          ) })()}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onDone?.()}>Cancel</Button>
          <Button onClick={submit} disabled={loading} className="bg-gradient-primary text-white">{loading ? 'Processing...' : 'Confirm & Pay'}</Button>
        </div>
      </div>
    </div>
  )
}
