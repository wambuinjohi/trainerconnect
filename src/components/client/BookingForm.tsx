import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import { calculateFeeBreakdown } from '@/lib/fee-calculations'
import * as apiService from '@/lib/api-service'
import { getGroupTierByName, formatGroupPricingDisplay, type GroupPricingConfig, type GroupTier } from '@/lib/group-pricing-utils'

export const BookingForm: React.FC<{ trainer: any, trainerProfile?: any, onDone?: () => void }> = ({ trainer, trainerProfile, onDone }) => {
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
  const [availabilityError, setAvailabilityError] = useState<string>('')
  const [isGroupTraining, setIsGroupTraining] = useState(false)
  const [groupSize, setGroupSize] = useState<number>(1)
  const [groupTrainingData, setGroupTrainingData] = useState<GroupPricingConfig | null>(null)
  const [selectedGroupTierName, setSelectedGroupTierName] = useState<string>('')
  const [trainerCategoryId, setTrainerCategoryId] = useState<number | null>(null)

  const computeBaseAmount = () => {
    if (isGroupTraining && selectedGroupTierName && groupTrainingData) {
      const tier = getGroupTierByName(groupTrainingData, selectedGroupTierName)
      if (tier) {
        const tierRate = tier.rate
        // Calculate based on pricing model
        if (groupTrainingData.pricing_model === 'per_person') {
          return tierRate * groupSize * Number(sessions || 1)
        } else {
          // fixed rate
          return tierRate * Number(sessions || 1)
        }
      }
    }
    return Number(trainer.hourlyRate || 0) * Number(sessions || 1)
  }

  const settings = loadSettings()

  // Validate availability when date or time changes
  useEffect(() => {
    setAvailabilityError('')
    if (!date || !time) return

    const availability = trainerProfile?.availability
    if (!availability) return

    const selectedDate = new Date(date)
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'lowercase' })
    const slots = availability[dayName]

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      setAvailabilityError(`Trainer is not available on ${dayName}s`)
      return
    }

    const selectedHour = parseInt(time.split(':')[0])
    const selectedMinute = parseInt(time.split(':')[1])
    const selectedTimeInMinutes = selectedHour * 60 + selectedMinute

    const isAvailable = slots.some((slot: string) => {
      const [start, end] = slot.split('-')
      const [startHour, startMin] = start.split(':').map(Number)
      const [endHour, endMin] = end.split(':').map(Number)
      const startInMinutes = startHour * 60 + startMin
      const endInMinutes = endHour * 60 + endMin

      return selectedTimeInMinutes >= startInMinutes && selectedTimeInMinutes < endInMinutes
    })

    if (!isAvailable) {
      const availableTimes = slots.join(', ')
      setAvailabilityError(`Time not available. Available slots: ${availableTimes}`)
    }
  }, [date, time, trainerProfile?.availability])

  // Load group training data for the trainer
  useEffect(() => {
    const loadGroupTrainingData = async () => {
      if (!trainer?.id) return
      try {
        const response = await apiService.getTrainerGroupPricing(trainer.id)
        if (response?.data && response.data.length > 0) {
          const firstGroupPricing = response.data[0]
          setGroupTrainingData(firstGroupPricing)
          setTrainerCategoryId(firstGroupPricing.category_id)
          // Auto-select first tier for convenience
          if (firstGroupPricing.tiers && firstGroupPricing.tiers.length > 0) {
            setSelectedGroupTierName(firstGroupPricing.tiers[0].group_size_name)
          }
        }
      } catch (err) {
        console.warn('Failed to load group training data:', err)
      }
    }
    loadGroupTrainingData()
  }, [trainer?.id])

  // Get fee breakdown using new calculation utility
  const baseAmount = computeBaseAmount() - appliedDiscount
  const feeBreakdown = calculateFeeBreakdown(baseAmount, {
    platformChargeClientPercent: settings.platformChargeClientPercent || 15,
    platformChargeTrainerPercent: settings.platformChargeTrainerPercent || 10,
    compensationFeePercent: settings.compensationFeePercent || 10,
    maintenanceFeePercent: settings.maintenanceFeePercent || 15,
  }, 0) // transportFee will be calculated server-side

  const submit = async () => {
    if (!user) return
    if (!date || !time) {
      toast({ title: 'Missing info', description: 'Please select date and time', variant: 'destructive' })
      return
    }
    if (availabilityError) {
      toast({ title: 'Invalid time', description: availabilityError, variant: 'destructive' })
      return
    }
    setLoading(true)
    const baseAmount = computeBaseAmount()
    let baseServiceAmount = baseAmount
    let appliedReferralDiscount = 0

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
          baseServiceAmount = Math.max(0, baseAmount - discount)
          appliedReferralDiscount = discount
          setAppliedDiscount(discount)
          try {
            await apiRequest('referral_update', { id: row.id, referee_id: user.id, discount_used: true, discount_amount: discount }, { headers: withAuth() })
          } catch {}
        }
      } catch (e) {
        console.warn('Referral validation error', e)
      }
    }

    const payload: any = {
      client_id: user.id,
      trainer_id: trainer.id,
      session_date: date,
      session_time: time,
      duration_hours: 1,
      total_sessions: sessions,
      status: 'pending',
      base_service_amount: baseServiceAmount,
      notes,
      client_location_label: (clientLocation.label || null),
      client_location_lat: (clientLocation.lat != null ? clientLocation.lat : null),
      client_location_lng: (clientLocation.lng != null ? clientLocation.lng : null),
    }

    try {
      // create booking using new booking_create action with server-side fee calculation
      const bookingResponse = await apiRequest('booking_create', payload, { headers: withAuth() })
      const bookingData = { id: bookingResponse?.booking_id }
      const clientTotal = bookingResponse?.total_amount || 0
      const transportFee = bookingResponse?.transport_fee || 0
      const platformFee = bookingResponse?.platform_fee || 0
      const vatAmount = bookingResponse?.vat_amount || 0

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
        const mpesaSettings = loadSettings().mpesa
        const initRes = await fetch('/payments/mpesa/stk-initiate', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ phone: mpesaPhone.trim(), amount: clientTotal, booking_id: bookingData?.id, account_reference: bookingData?.id || 'booking', transaction_desc: 'Training session payment', mpesa_creds: mpesaSettings }) })
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
          const mpesaSettings = loadSettings().mpesa
          const qRes = await fetch('/payments/mpesa/stk-query', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ checkout_request_id: checkoutId, mpesa_creds: mpesaSettings }) })
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
          {availabilityError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{availabilityError}</div>}
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
          <div className="flex justify-between"><span>Base Service Amount</span><span className="font-semibold">Ksh {baseAmount}</span></div>
          {appliedDiscount > 0 && <div className="flex justify-between text-blue-500"><span>Referral Discount</span><span>−Ksh {appliedDiscount}</span></div>}
          <div className="border-t border-border my-2 pt-2">
            <div className="text-xs text-muted-foreground mb-2">Fee Breakdown:</div>
            <div className="flex justify-between text-xs"><span>Platform Charge (Client)</span><span>Ksh {feeBreakdown.platformChargeClient}</span></div>
            <div className="flex justify-between text-xs"><span>Compensation Fee</span><span>Ksh {feeBreakdown.compensationFee}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Maintenance Fee (system revenue)</span><span>Ksh {feeBreakdown.maintenanceFee}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Transport fee (distance-based)</span><span>Ksh 0 (server-calculated)</span></div>
            <div className="flex justify-between mt-2"><span className="font-medium">Estimated Total (excl. transport)</span><span className="font-bold">Ksh {feeBreakdown.clientTotal}</span></div>
            <div className="text-xs text-muted-foreground mt-1">*Transport fee will be added based on distance at checkout</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onDone?.()}>Cancel</Button>
          <Button onClick={submit} disabled={loading || !!availabilityError} className="bg-gradient-primary text-white" title={availabilityError ? 'Please select a valid date and time' : ''}>{loading ? 'Processing...' : 'Confirm & Pay'}</Button>
        </div>
      </div>
    </div>
  )
}
