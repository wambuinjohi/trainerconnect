import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

type TierRow = { id: string; radius: string; rate: string }
type PackageRow = { id: string; name: string; price: string; sessions: string; description: string }
type ServiceRow = { id: string; title: string; price: string; description: string; duration: string; is_active: boolean; dirty?: boolean }
type NewService = { title: string; price: string; description: string; duration: string }

type PricingPayloadTier = { radius_km: number; rate: number }
type PricingPayloadPackage = { name: string; price: number; sessions: number | null; description: string | null }

type ServicesManagerProps = { onClose?: () => void }

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const mapServiceRow = (row: any): ServiceRow => ({
  id: String(row?.id ?? createId('service')),
  title: String(row?.title ?? row?.name ?? ''),
  price: row?.price != null ? String(row.price) : '',
  description: String(row?.description ?? ''),
  duration: row?.duration_minutes != null ? String(row.duration_minutes) : '',
  is_active: row?.is_active !== false,
  dirty: false,
})

const mapTierRow = (row: any, index: number): TierRow => ({
  id: createId(`tier-${index}`),
  radius: row?.radius_km != null ? String(row.radius_km) : '',
  rate: row?.rate != null ? String(row.rate) : '',
})

const mapPackageRow = (row: any, index: number): PackageRow => ({
  id: String(row?.id ?? createId(`pkg-${index}`)),
  name: String(row?.name ?? row?.title ?? ''),
  price: row?.price != null ? String(row.price) : '',
  sessions: row?.sessions != null ? String(row.sessions) : '',
  description: String(row?.description ?? ''),
})

const ServicesManager: React.FC<ServicesManagerProps> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [baseRate, setBaseRate] = useState<string>('')
  const [newService, setNewService] = useState<NewService>({ title: '', price: '', description: '', duration: '60' })
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null)
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)

    const load = async () => {
      try {
        const [servicesData, profileData] = await Promise.all([
          apiRequest('services_get', { trainer_id: userId }, { headers: withAuth() }).catch(() => []),
          apiRequest('profile_get', { user_id: userId }, { headers: withAuth() }).catch(() => ({})),
        ])

        if (!active) return

        const serviceRows = Array.isArray(servicesData) ? servicesData.map(mapServiceRow) : []
        setServices(serviceRows)

        const profile = profileData ?? {}
        setBaseRate(profile?.hourly_rate != null ? String(profile.hourly_rate) : '')

        const profileTiers = Array.isArray(profile?.hourly_rate_by_radius)
          ? (profile.hourly_rate_by_radius as any[])
              .map((t) => ({ r: Number(t.radius_km), p: Number(t.rate) }))
              .filter(x => Number.isFinite(x.r) && Number.isFinite(x.p))
              .sort((a,b) => a.r - b.r)
              .map((t, idx) => mapTierRow({ radius_km: t.r, rate: t.p }, idx))
          : []
        setTiers(profileTiers)

        const profilePackages = Array.isArray(profile?.pricing_packages)
          ? profile.pricing_packages.map(mapPackageRow)
          : []
        setPackages(profilePackages)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [userId])

  const updateTier = (id: string, patch: Partial<TierRow>) => {
    setTiers(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  const removeTier = (id: string) => {
    setTiers(prev => prev.filter(t => t.id !== id))
  }

  const addTier = () => {
    setTiers(prev => [...prev, { id: createId('tier'), radius: '', rate: '' }])
  }

  const updatePackageRow = (id: string, patch: Partial<PackageRow>) => {
    setPackages(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  const removePackage = (id: string) => {
    setPackages(prev => prev.filter(p => p.id !== id))
  }

  const addPackage = () => {
    setPackages(prev => [...prev, { id: createId('pkg'), name: '', price: '', sessions: '', description: '' }])
  }

  const handleServiceChange = (id: string, patch: Partial<ServiceRow>) => {
    setServices(prev => prev.map(s => (s.id === id ? { ...s, ...patch, dirty: true } : s)))
  }

  const handleNewServiceChange = (patch: Partial<NewService>) => {
    setNewService(prev => ({ ...prev, ...patch }))
  }

  const savePricing = async () => {
    if (!userId) return

    const numericRate = baseRate.trim() === '' ? 0 : Number(baseRate)
    if (!Number.isFinite(numericRate) || numericRate < 0) {
      toast({ title: 'Invalid hourly rate', description: 'Enter a non-negative hourly rate.', variant: 'destructive' })
      return
    }

    const cleanedTiers: PricingPayloadTier[] = []
    for (const tier of tiers) {
      if ((tier.radius ?? '').toString().trim() === '' && (tier.rate ?? '').toString().trim() === '') {
        continue
      }
      const radiusVal = Number(tier.radius)
      const rateVal = Number(tier.rate)
      if (!Number.isFinite(radiusVal) || radiusVal < 0) {
        toast({ title: 'Invalid travel tier', description: 'Radius must be a non-negative number.', variant: 'destructive' })
        return
      }
      if (!Number.isFinite(rateVal) || rateVal < 0) {
        toast({ title: 'Invalid travel tier', description: 'Rate must be a non-negative number.', variant: 'destructive' })
        return
      }
      cleanedTiers.push({ radius_km: radiusVal, rate: rateVal })
    }

    cleanedTiers.sort((a, b) => a.radius_km - b.radius_km)

    const cleanedPackages: PricingPayloadPackage[] = []
    for (let i = 0; i < packages.length; i += 1) {
      const pkg = packages[i]
      const hasAnyValue = [pkg.name, pkg.price, pkg.sessions, pkg.description].some(value => String(value ?? '').trim() !== '')
      if (!hasAnyValue) continue

      const name = pkg.name.trim()
      if (!name) {
        toast({ title: 'Incomplete package', description: `Package ${i + 1} is missing a name.`, variant: 'destructive' })
        return
      }

      const priceVal = Number(pkg.price)
      if (!Number.isFinite(priceVal) || priceVal < 0) {
        toast({ title: 'Invalid package price', description: `Package ${name} must have a non-negative price.`, variant: 'destructive' })
        return
      }

      let sessionsVal: number | null = null
      if (pkg.sessions.trim() !== '') {
        const parsedSessions = Number(pkg.sessions)
        if (!Number.isFinite(parsedSessions) || parsedSessions <= 0 || !Number.isInteger(parsedSessions)) {
          toast({ title: 'Invalid package sessions', description: `Package ${name} must have a positive whole number of sessions.`, variant: 'destructive' })
          return
        }
        sessionsVal = parsedSessions
      }

      cleanedPackages.push({
        name,
        price: priceVal,
        sessions: sessionsVal,
        description: pkg.description.trim() === '' ? null : pkg.description.trim(),
      })
    }

    setPricingSaving(true)
    try {
      const payload: Record<string, unknown> = {
        user_id: userId,
        user_type: 'trainer',
        hourly_rate: numericRate,
      }
      payload.hourly_rate_by_radius = cleanedTiers.length ? cleanedTiers : null
      payload.pricing_packages = cleanedPackages.length ? cleanedPackages : null

      await apiRequest('profile_update', payload, { headers: withAuth() })

      toast({ title: 'Pricing saved', description: 'Your pricing settings are up to date.' })

      setBaseRate(String(numericRate))
      setTiers(cleanedTiers.map((tier, index) => mapTierRow(tier, index)))
      setPackages(cleanedPackages.map((pkg, index) => mapPackageRow({ ...pkg, id: cleanedPackages[index]?.name ?? index }, index)))
    } catch (error) {
      const description = (error as any)?.message || 'Failed to save pricing. Please try again.'
      toast({ title: 'Error saving pricing', description, variant: 'destructive' })
    } finally {
      setPricingSaving(false)
    }
  }

  const saveService = async (service: ServiceRow) => {
    if (!userId) return
    const title = service.title.trim()
    if (!title) {
      toast({ title: 'Service name required', description: 'Provide a service title before saving.', variant: 'destructive' })
      return
    }

    const priceVal = Number(service.price)
    if (!Number.isFinite(priceVal) || priceVal < 0) {
      toast({ title: 'Invalid price', description: 'Service price must be a non-negative number.', variant: 'destructive' })
      return
    }

    let durationVal: number | null = null
    if (service.duration.trim() !== '') {
      const parsedDuration = Number(service.duration)
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        toast({ title: 'Invalid duration', description: 'Duration must be a positive number of minutes.', variant: 'destructive' })
        return
      }
      durationVal = parsedDuration
    }

    setSavingServiceId(service.id)
    try {
      const payload: Record<string, unknown> = {
        title,
        price: priceVal,
        description: service.description.trim() === '' ? null : service.description.trim(),
        duration_minutes: durationVal,
        is_active: service.is_active,
        trainer_id: userId,
      }

      await apiRequest('service_update', { id: service.id, ...payload }, { headers: withAuth() })

      toast({ title: 'Service updated', description: `${title} has been saved.` })

      setServices(prev =>
        prev.map(s =>
          s.id === service.id
            ? {
                ...s,
                title,
                price: String(priceVal),
                description: payload.description == null ? '' : String(payload.description),
                duration: durationVal == null ? '' : String(durationVal),
                is_active: service.is_active,
                dirty: false,
              }
            : s,
        ),
      )
    } catch (error) {
      const description = (error as any)?.message || 'Failed to save service. Please try again.'
      toast({ title: 'Error saving service', description, variant: 'destructive' })
    } finally {
      setSavingServiceId(null)
    }
  }

  const deleteService = async (service: ServiceRow) => {
    if (!userId) return
    setDeletingServiceId(service.id)
    try {
      await apiRequest('service_delete', { id: service.id }, { headers: withAuth() })
      setServices(prev => prev.filter(s => s.id !== service.id))
      toast({ title: 'Service removed', description: `${service.title || 'Service'} was deleted.` })
    } catch (error) {
      const description = (error as any)?.message || 'Failed to delete service. Please try again.'
      toast({ title: 'Error deleting service', description, variant: 'destructive' })
    } finally {
      setDeletingServiceId(null)
    }
  }

  const addService = async () => {
    if (!userId) return
    const title = newService.title.trim()
    if (!title) {
      toast({ title: 'Service name required', description: 'Provide a service title before adding it.', variant: 'destructive' })
      return
    }

    const priceVal = Number(newService.price)
    if (!Number.isFinite(priceVal) || priceVal < 0) {
      toast({ title: 'Invalid price', description: 'Service price must be a non-negative number.', variant: 'destructive' })
      return
    }

    let durationVal: number | null = 60
    if (newService.duration.trim() !== '') {
      const parsedDuration = Number(newService.duration)
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        toast({ title: 'Invalid duration', description: 'Duration must be a positive number of minutes.', variant: 'destructive' })
        return
      }
      durationVal = parsedDuration
    }

    setSavingServiceId('new')
    try {
      const payload: Record<string, unknown> = {
        trainer_id: userId,
        title,
        price: priceVal,
        description: newService.description.trim() === '' ? null : newService.description.trim(),
        duration_minutes: durationVal,
        is_active: true,
      }

      const inserted = await apiRequest('service_insert', payload, { headers: withAuth() })
      const mapped = mapServiceRow({ ...payload, ...inserted })
      setServices(prev => [...prev, mapped])

      toast({ title: 'Service added', description: `${title} is now available for clients.` })

      setNewService({ title: '', price: '', description: '', duration: '60' })
    } catch (error) {
      const description = (error as any)?.message || 'Failed to add service. Please try again.'
      toast({ title: 'Error adding service', description, variant: 'destructive' })
    } finally {
      setSavingServiceId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Services</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep your rates, packages, and offered services up to date. Changes save immediately for clients.
            </p>
          </CardHeader>
          {loading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="space-y-8">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Base pricing</h3>
                  <Button onClick={savePricing} disabled={pricingSaving} className="gap-2">
                    {pricingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save pricing
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="base-rate">Default hourly rate (Ksh)</Label>
                    <Input
                      id="base-rate"
                      type="number"
                      min="0"
                      value={baseRate}
                      onChange={event => setBaseRate(event.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Shown as your default rate for new clients.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Travel tiers (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Adjust prices based on how far you need to travel. The first tier that covers the client distance is used.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {tiers.length === 0 && (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No travel tiers added yet.
                    </div>
                  )}
                  {tiers.map(tier => (
                    <div key={tier.id} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Max distance (km)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={tier.radius}
                          onChange={event => updateTier(tier.id, { radius: event.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hourly rate (Ksh)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={tier.rate}
                          onChange={event => updateTier(tier.id, { rate: event.target.value })}
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeTier(tier.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-2" onClick={addTier}>
                    <Plus className="h-4 w-4" /> Add travel tier
                  </Button>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Packages</h3>
                  <Button variant="outline" size="sm" className="gap-2" onClick={addPackage}>
                    <Plus className="h-4 w-4" /> Add package
                  </Button>
                </div>
                {packages.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Create bundles for recurring clients, e.g. 10 sessions for a discount.
                  </div>
                )}
                <div className="space-y-3">
                  {packages.map(pkg => (
                    <div key={pkg.id} className="space-y-3 rounded-md border border-border bg-card p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Package name</Label>
                          <Input value={pkg.name} onChange={event => updatePackageRow(pkg.id, { name: event.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price (Ksh)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={pkg.price}
                            onChange={event => updatePackageRow(pkg.id, { price: event.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sessions included</Label>
                          <Input
                            type="number"
                            min="0"
                            value={pkg.sessions}
                            onChange={event => updatePackageRow(pkg.id, { sessions: event.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                        <Textarea
                          value={pkg.description}
                          onChange={event => updatePackageRow(pkg.id, { description: event.target.value })}
                          rows={3}
                        />
                        <div className="mt-2 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => removePackage(pkg.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove package
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Services</h3>
                  <p className="text-sm text-muted-foreground">
                    Adjust visibility, pricing, and duration for the services you offer.
                  </p>
                </div>
                <div className="space-y-3">
                  {services.map(service => (
                    <div key={service.id} className="space-y-3 rounded-md border border-border bg-card p-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,160px)]">
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Service name</Label>
                          <Input value={service.title} onChange={event => handleServiceChange(service.id, { title: event.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price (Ksh)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={service.price}
                            onChange={event => handleServiceChange(service.id, { price: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration (minutes)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={service.duration}
                            onChange={event => handleServiceChange(service.id, { duration: event.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                          <Textarea
                            value={service.description}
                            onChange={event => handleServiceChange(service.id, { description: event.target.value })}
                            rows={3}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={service.is_active}
                            onCheckedChange={checked => handleServiceChange(service.id, { is_active: Boolean(checked) })}
                          />
                          <span className="text-sm text-muted-foreground">{service.is_active ? 'Visible to clients' : 'Hidden from clients'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteService(service)}
                            disabled={deletingServiceId === service.id || savingServiceId === service.id}
                            className="text-destructive"
                          >
                            {deletingServiceId === service.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveService(service)}
                            disabled={savingServiceId === service.id || deletingServiceId === service.id || !service.dirty}
                            className="gap-2"
                          >
                            {savingServiceId === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
                  <h4 className="font-medium text-foreground">Add a new service</h4>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,160px)]">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Service name</Label>
                      <Input value={newService.title} onChange={event => handleNewServiceChange({ title: event.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price (Ksh)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newService.price}
                        onChange={event => handleNewServiceChange({ price: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newService.duration}
                        onChange={event => handleNewServiceChange({ duration: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
                      <Textarea
                        value={newService.description}
                        onChange={event => handleNewServiceChange({ description: event.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={addService} disabled={savingServiceId === 'new'} className="gap-2">
                      {savingServiceId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add service
                    </Button>
                  </div>
                </div>
              </section>
            </CardContent>
          )}
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose?.()}>Close</Button>
            <Button onClick={savePricing} disabled={pricingSaving} className="gap-2">
              {pricingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save pricing
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export { ServicesManager }
