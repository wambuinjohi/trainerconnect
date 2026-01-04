import { useState, useEffect } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Loader2, Plus, Save, Trash2, Users } from 'lucide-react'
import * as apiService from '@/lib/api-service'
import { GroupTrainingManager } from './GroupTrainingManager'

type TierRow = { id: string; radius: string; rate: string }
type ServiceCategory = { id: number; name: string; icon?: string; description?: string }

interface ServicesManagerProps { onClose?: () => void }

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const ServicesManager = ({ onClose }: ServicesManagerProps) => {
  const { user } = useAuth()
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseRate, setBaseRate] = useState<string>('')
  const [allCategories, setAllCategories] = useState<ServiceCategory[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoryPricing, setCategoryPricing] = useState<Record<number, string>>({})
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [groupTrainingModalOpen, setGroupTrainingModalOpen] = useState(false)
  const [selectedCategoryForGroupTraining, setSelectedCategoryForGroupTraining] = useState<{ id: number; name: string } | null>(null)
  const [groupTrainingEnabledByCategory, setGroupTrainingEnabledByCategory] = useState<Record<number, boolean>>({})

  // Load available data
  useEffect(() => {
    if (!userId) return
    let active = true
    setLoading(true)

    const load = async () => {
      try {
        // Fetch all available categories
        const categoriesData = await apiService.getCategories()
        if (active && categoriesData?.data) {
          setAllCategories(categoriesData.data)
        }

        // Fetch trainer profile
        const profileData = await apiService.getUserProfile(userId).catch(() => ({ data: [] }))
        if (!active) return

        if (profileData?.data && profileData.data.length > 0) {
          const profile = profileData.data[0]

          // Set base rate
          setBaseRate(profile?.hourly_rate != null ? String(profile.hourly_rate) : '')

          // Load distance-based tiers - handle both JSON string and object formats
          let tiers = profile?.hourly_rate_by_radius
          if (typeof tiers === 'string') {
            try {
              tiers = JSON.parse(tiers)
            } catch {
              tiers = null
            }
          }

          const profileTiers = Array.isArray(tiers)
            ? (tiers as any[])
                .map((t) => ({ r: Number(t.radius_km || t.radius), p: Number(t.rate) }))
                .filter(x => Number.isFinite(x.r) && Number.isFinite(x.p))
                .sort((a,b) => a.r - b.r)
                .map((t, idx) => ({
                  id: createId(`tier-${idx}`),
                  radius: String(t.r),
                  rate: String(t.p)
                }))
            : []
          setTiers(profileTiers)
        }

        // Load selected service categories
        const selectedCats = await apiService.getTrainerCategories(userId).catch(() => ({ data: [] }))

        if (active && selectedCats?.data && Array.isArray(selectedCats.data)) {
          const catIds = selectedCats.data.map((sc: any) => Number(sc.category_id || sc.cat_id))
          setSelectedCategoryIds(catIds)

          const pricing: Record<number, string> = {}
          selectedCats.data.forEach((sc: any) => {
            if (sc.hourly_rate != null) {
              pricing[Number(sc.category_id || sc.cat_id)] = String(sc.hourly_rate)
            }
          })
          setCategoryPricing(pricing)
        }
      } catch (err) {
        console.warn('Failed to load data', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId])

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const updateTier = (id: string, patch: Partial<TierRow>) => {
    setTiers(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  const removeTier = (id: string) => {
    setTiers(prev => prev.filter(t => t.id !== id))
  }

  const addTier = () => {
    setTiers(prev => [...prev, { id: createId('tier'), radius: '', rate: '' }])
  }

  const updateCategoryPrice = (categoryId: number, price: string) => {
    setCategoryPricing(prev => ({ ...prev, [categoryId]: price }))
  }

  const savePricing = async () => {
    if (!userId) return
    setSaving(true)

    try {
      // Validate inputs
      if (!baseRate || isNaN(Number(baseRate))) {
        toast({ title: 'Invalid base rate', variant: 'destructive' })
        setSaving(false)
        return
      }

      if (selectedCategoryIds.length === 0) {
        toast({ title: 'Select at least one service category', variant: 'destructive' })
        setSaving(false)
        return
      }

      // Validate tiers
      for (const tier of tiers) {
        if (!tier.radius || !tier.rate || isNaN(Number(tier.radius)) || isNaN(Number(tier.rate))) {
          toast({ title: 'Invalid distance tier - fill all fields', variant: 'destructive' })
          setSaving(false)
          return
        }
      }

      // Save base rate and tiers to profile
      const cleanedTiers = tiers.length > 0
        ? tiers.map(t => ({ radius_km: Number(t.radius), rate: Number(t.rate) }))
        : null

      await apiService.updateUserProfile(userId, {
        hourly_rate: Number(baseRate),
        hourly_rate_by_radius: cleanedTiers ? JSON.stringify(cleanedTiers) : null
      })

      // Get previous categories to determine what changed
      const previousCategoriesData = await apiService.getTrainerCategories(userId)
      const previousCategoryIds = previousCategoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []

      // Determine which categories to add and remove
      const categoriesToAdd = selectedCategoryIds.filter(id => !previousCategoryIds.includes(id))
      const categoriesToRemove = previousCategoryIds.filter(id => !selectedCategoryIds.includes(id))

      // Save category changes
      for (const categoryId of categoriesToAdd) {
        try {
          await apiService.addTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to add category ${categoryId}:`, catErr)
        }
      }

      for (const categoryId of categoriesToRemove) {
        try {
          await apiService.removeTrainerCategory(userId, categoryId)
        } catch (catErr) {
          console.warn(`Failed to remove category ${categoryId}:`, catErr)
        }
      }

      // Save category pricing for all selected categories
      for (const categoryId of selectedCategoryIds) {
        const price = categoryPricing[categoryId]
        if (price && Number(price) > 0) {
          try {
            await apiService.setTrainerCategoryPricing(userId, categoryId, Number(price))
          } catch (pricingErr) {
            console.warn(`Failed to save pricing for category ${categoryId}:`, pricingErr)
          }
        }
      }

      toast({ title: 'Success', description: 'Pricing and services updated' })
      onClose?.()
    } catch (err: any) {
      const description = err?.message || 'Failed to save'
      toast({ title: 'Error saving pricing', description, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedCategories = allCategories.filter(c => selectedCategoryIds.includes(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={event => event.stopPropagation()}>
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Service Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select service categories you offer and set your base pricing. Adjust pricing by distance if needed.
            </p>
          </CardHeader>
          {loading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="space-y-8">
              {/* Base Pricing Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Base Pricing</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="base-rate">Default hourly rate (Ksh)</Label>
                    <Input
                      id="base-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={baseRate}
                      onChange={event => setBaseRate(event.target.value)}
                      placeholder="e.g., 1000"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Your default rate for all selected service categories.</p>
                  </div>
                </div>
              </section>

              {/* Service Categories Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Service Categories</h3>
                <p className="text-sm text-muted-foreground">Select one or more service categories you offer.</p>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto border border-border rounded-lg p-4">
                  {allCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">No categories available</div>
                  ) : (
                    allCategories.map(category => (
                      <label key={category.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded">
                        <Checkbox
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {category.icon && <span>{category.icon}</span>}
                            <span>{category.name}</span>
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </section>

              {/* Per-Category Pricing (if multiple categories selected) */}
              {selectedCategories.length > 1 && (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Category-Specific Pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Optionally set different rates for specific categories. Leave empty to use base rate.
                  </p>
                  
                  <div className="space-y-3">
                    {selectedCategories.map(category => (
                      <div key={category.id} className="flex items-end gap-3 rounded-md border border-border bg-card p-3">
                        <div className="flex-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {category.icon && <span className="mr-2">{category.icon}</span>}
                            {category.name} hourly rate (Ksh)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={categoryPricing[category.id] || ''}
                            onChange={event => updateCategoryPrice(category.id, event.target.value)}
                            placeholder={`Leave empty for base rate (Ksh ${baseRate})`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Distance-Based Tiers Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Distance-Based Pricing Tiers</h3>
                <p className="text-sm text-muted-foreground">
                  Optionally adjust prices based on travel distance. The first matching tier is used.
                </p>
                
                <div className="space-y-3">
                  {tiers.length === 0 && (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No distance tiers added yet. Your base rate applies to all distances.
                    </div>
                  )}
                  {tiers.map(tier => (
                    <div key={tier.id} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Max distance (km)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={tier.radius}
                          onChange={event => updateTier(tier.id, { radius: event.target.value })}
                          placeholder="e.g., 5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hourly rate (Ksh)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.rate}
                          onChange={event => updateTier(tier.id, { rate: event.target.value })}
                          placeholder="e.g., 1500"
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
                    <Plus className="h-4 w-4" /> Add distance tier
                  </Button>
                </div>
              </section>
            </CardContent>
          )}
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose?.()}>Close</Button>
            <Button onClick={savePricing} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save pricing
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export { ServicesManager }
