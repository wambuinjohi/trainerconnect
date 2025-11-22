import React, { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { MediaUploadSection } from './MediaUploadSection'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Upload, X } from 'lucide-react'
import * as apiService from '@/lib/api-service'

interface TrainerProfile {
  user_id?: string
  user_type?: string
  name?: string
  disciplines?: string[] | string
  certifications?: string[] | string
  hourly_rate?: number
  hourly_rate_by_radius?: Array<{ radius_km: number; rate: number }>
  service_radius?: number
  availability?: any
  payout_details?: any
  profile_image?: string
  bio?: string
}

interface Category {
  id: number
  name: string
  icon?: string
  description?: string
}

export const TrainerProfileEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Partial<TrainerProfile>>({})
  const [name, setName] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { upload } = useFileUpload({
    maxFileSize: 5 * 1024 * 1024,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'],
    onSuccess: (files) => {
      if (files.length > 0) {
        const uploadedFile = files[0]
        handleChange('profile_image', uploadedFile.url)
        toast({ title: 'Image uploaded', description: 'Profile image has been updated' })
        setUploadingImage(false)
      }
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error, variant: 'destructive' })
      setUploadingImage(false)
    }
  })

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setCategories(categoriesData.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories', error)
      } finally {
        setCategoriesLoading(false)
      }
    }

    loadCategories()
  }, [])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const loadProfile = async () => {
      try {
        // Load profile from API
        const profileData = await apiService.getUserProfile(userId)
        if (profileData?.data && profileData.data.length > 0) {
          const data = profileData.data[0]
          setProfile(data)
          setName(String(data.full_name || data.name || ''))
        } else {
          // Fallback to localStorage
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            const data = JSON.parse(savedProfile)
            setProfile(data)
            setName(String(data.name || ''))
          }
        }

        // Load trainer categories
        const categoriesData = await apiService.getTrainerCategories(userId)
        if (categoriesData?.data) {
          const ids = categoriesData.data.map((cat: any) => cat.category_id || cat.cat_id)
          setSelectedCategoryIds(ids)
        }
      } catch (error) {
        console.error('Failed to fetch profile', error)
        // Fallback to localStorage on error
        try {
          const savedProfile = localStorage.getItem(`trainer_profile_${userId}`)
          if (savedProfile) {
            const data = JSON.parse(savedProfile)
            setProfile(data)
            setName(String(data.name || ''))
          }
        } catch {}
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [userId])

  const handleChange = (field: string, value: any) => setProfile(prev => ({ ...prev, [field]: value }))

  const handleCategoryChange = (categoryId: number, checked: boolean) => {
    if (checked) {
      setSelectedCategoryIds(prev => [...new Set([...prev, categoryId])])
    } else {
      setSelectedCategoryIds(prev => prev.filter(id => id !== categoryId))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      setUploadingImage(true)
      const fileArray = Array.from(files)
      await upload(fileArray)
    }
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const clearProfileImage = () => {
    handleChange('profile_image', '')
  }

  const save = async () => {
    if (!userId) {
      toast({ title: 'Not signed in', description: 'Please sign in to edit your profile', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      // Disciplines & certifications normalization
      const disciplines = Array.isArray(profile.disciplines)
        ? profile.disciplines
        : String(profile.disciplines || '').split(',').map(s => s.trim()).filter(Boolean)

      const certifications = Array.isArray(profile.certifications)
        ? profile.certifications
        : String(profile.certifications || '').split(',').map(s => s.trim()).filter(Boolean)

      // Hourly rate validation
      const hourlyRateRaw = profile.hourly_rate == null ? '' : profile.hourly_rate
      const hourlyRateNum = hourlyRateRaw === '' ? 0 : Number(hourlyRateRaw)
      if (!Number.isFinite(hourlyRateNum) || hourlyRateNum < 0) {
        toast({ title: 'Invalid hourly rate', description: 'Enter a non-negative number for hourly rate.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Service radius validation
      const serviceRadiusRaw = profile.service_radius == null ? '' : profile.service_radius
      const serviceRadiusNum = serviceRadiusRaw === '' ? null : Number(serviceRadiusRaw)
      if (serviceRadiusNum !== null && (!Number.isFinite(serviceRadiusNum) || serviceRadiusNum < 0)) {
        toast({ title: 'Invalid service radius', description: 'Enter a non-negative number for service radius.', variant: 'destructive' })
        setLoading(false)
        return
      }

      // Hourly rate by radius - sanitize and sort
      const rawTiers = Array.isArray(profile.hourly_rate_by_radius) ? profile.hourly_rate_by_radius : []
      const cleanedTiers: Array<{ radius_km: number; rate: number }> = []
      for (let i = 0; i < rawTiers.length; i += 1) {
        const item: any = rawTiers[i]
        if (!item) continue
        const r = Number(item.radius_km ?? item.radius ?? item.radius_km)
        const rate = Number(item.rate ?? item.rate_per_hour ?? item.price ?? item.rate)
        if (!Number.isFinite(r) || r < 0 || !Number.isFinite(rate) || rate < 0) {
          toast({ title: 'Invalid travel tier', description: 'Each tier must have non-negative numeric radius and rate.', variant: 'destructive' })
          setLoading(false)
          return
        }
        cleanedTiers.push({ radius_km: r, rate })
      }
      cleanedTiers.sort((a,b)=>a.radius_km - b.radius_km)

      // Payout details - if string, attempt parse
      let payoutDetails: any = profile.payout_details ?? null
      if (typeof payoutDetails === 'string' && payoutDetails.trim() !== '') {
        try {
          payoutDetails = JSON.parse(payoutDetails)
        } catch (e) {
          toast({ title: 'Invalid payout JSON', description: 'Payout details must be valid JSON.', variant: 'destructive' })
          setLoading(false)
          return
        }
      }

      // Availability - if string, attempt parse
      let availabilityVal: any = profile.availability ?? null
      if (typeof availabilityVal === 'string' && availabilityVal.trim() !== '') {
        try {
          availabilityVal = JSON.parse(availabilityVal)
        } catch (e) {
          toast({ title: 'Invalid availability JSON', description: 'Availability must be valid JSON.', variant: 'destructive' })
          setLoading(false)
          return
        }
      }

      const profileData: TrainerProfile = {
        user_id: userId,
        user_type: 'trainer',
        name: name || null,
        disciplines,
        certifications,
        hourly_rate: hourlyRateNum,
        hourly_rate_by_radius: cleanedTiers.length ? cleanedTiers : null,
        service_radius: serviceRadiusNum,
        availability: availabilityVal ?? null,
        payout_details: payoutDetails ?? null,
        profile_image: profile.profile_image || null,
        bio: profile.bio || null,
      }

      // Save to API
      try {
        const updatePayload = {
          full_name: name,
          disciplines: JSON.stringify(disciplines),
          certifications: JSON.stringify(certifications),
          hourly_rate: hourlyRateNum,
          service_radius: serviceRadiusNum,
          availability: JSON.stringify(availabilityVal),
          timezone: profile.timezone || 'UTC',
          profile_image: profile.profile_image || null,
          bio: profile.bio || null,
          payout_details: payoutDetails ? JSON.stringify(payoutDetails) : null,
          hourly_rate_by_radius: cleanedTiers.length ? JSON.stringify(cleanedTiers) : null,
        }
        console.log('Saving profile with userId:', userId)
        console.log('Update payload:', updatePayload)
        const response = await apiService.updateUserProfile(userId, updatePayload)
        console.log('Profile updated successfully:', response)
      } catch (apiErr) {
        console.error('API save failed:', apiErr)
        toast({
          title: 'Database update failed',
          description: apiErr instanceof Error ? apiErr.message : 'Could not save to database',
          variant: 'destructive'
        })
        setLoading(false)
        return
      }

      // Save to localStorage as fallback
      localStorage.setItem(`trainer_profile_${userId}`, JSON.stringify(profileData))

      toast({ title: 'Saved', description: 'Profile updated successfully.' })
      onClose?.()
    } catch (err) {
      console.error('Save profile error', err)
      toast({ title: 'Error', description: (err as any)?.message || 'Failed to save profile', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Trainer Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
          </div>

          <div className="space-y-2">
            <Label>Profile Image</Label>
            <div className="space-y-3">
              {/* Image Preview */}
              {profile.profile_image && (
                <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden border-2 border-border bg-muted">
                  <img
                    src={profile.profile_image}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearProfileImage}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Upload Area */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || loading}
                  className="flex-1 p-3 border-2 border-dashed border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{uploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || loading}
                  className="hidden"
                />
              </div>

              {/* Manual URL Input */}
              <div>
                <Label htmlFor="profile-image-url" className="text-xs text-muted-foreground">Or paste image URL</Label>
                <Input
                  id="profile-image-url"
                  value={profile.profile_image || ''}
                  onChange={(e) => handleChange('profile_image', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea id="bio" value={profile.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
          </div>

          <div>
            <Label htmlFor="disciplines">Disciplines (comma separated)</Label>
            <Input id="disciplines" value={(profile.disciplines && Array.isArray(profile.disciplines)) ? (profile.disciplines as string[]).join(', ') : (profile.disciplines as any) || ''} onChange={(e) => handleChange('disciplines', e.target.value)} />
          </div>

          <div>
            <Label htmlFor="certifications">Certifications (comma separated)</Label>
            <Input id="certifications" value={(profile.certifications && Array.isArray(profile.certifications)) ? (profile.certifications as string[]).join(', ') : (profile.certifications as any) || ''} onChange={(e) => handleChange('certifications', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hourly_rate">Default Hourly Rate</Label>
              <Input id="hourly_rate" type="number" value={profile.hourly_rate ?? ''} onChange={(e) => handleChange('hourly_rate', Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="service_radius">Service Radius (km)</Label>
              <Input id="service_radius" type="number" value={profile.service_radius ?? ''} onChange={(e) => handleChange('service_radius', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={profile.timezone || 'UTC'}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-input"
            >
              <option value="UTC">UTC (Universal Time)</option>
              <option value="Africa/Johannesburg">Africa/Johannesburg (South Africa)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (Kenya)</option>
              <option value="Africa/Lagos">Africa/Lagos (Nigeria)</option>
              <option value="Africa/Cairo">Africa/Cairo (Egypt)</option>
              <option value="Africa/Kampala">Africa/Kampala (Uganda)</option>
              <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (Tanzania)</option>
              <option value="Africa/Accra">Africa/Accra (Ghana)</option>
              <option value="Europe/London">Europe/London (UK)</option>
              <option value="Europe/Paris">Europe/Paris (France)</option>
              <option value="Europe/Berlin">Europe/Berlin (Germany)</option>
              <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (Thailand)</option>
              <option value="Asia/Singapore">Asia/Singapore (Singapore)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (Japan)</option>
              <option value="America/New_York">America/New_York (US Eastern)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (US Pacific)</option>
              <option value="Australia/Sydney">Australia/Sydney (Australia)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Your booking times and availability will be displayed in this timezone to clients.</p>
          </div>

          <div className="space-y-2">
            <Label>Pricing by Service Radius</Label>
            <div className="text-xs text-muted-foreground">Set tiered rates based on client distance (km). The first tier that is greater than or equal to the client's distance is used.</div>
            <div className="space-y-2">
              {(Array.isArray(profile.hourly_rate_by_radius) ? profile.hourly_rate_by_radius : []).map((row: any, idx: number) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    <Label>Max distance (km)</Label>
                    <Input type="number" value={row.radius_km ?? ''} onChange={(e)=>{
                      const v = Number(e.target.value)
                      const arr = [...(Array.isArray(profile.hourly_rate_by_radius)?profile.hourly_rate_by_radius:[])]
                      arr[idx] = { ...arr[idx], radius_km: isFinite(v) ? v : undefined }
                      handleChange('hourly_rate_by_radius', arr)
                    }} />
                  </div>
                  <div className="col-span-2">
                    <Label>Rate (Ksh/hour)</Label>
                    <Input type="number" value={row.rate ?? ''} onChange={(e)=>{
                      const v = Number(e.target.value)
                      const arr = [...(Array.isArray(profile.hourly_rate_by_radius)?profile.hourly_rate_by_radius:[])]
                      arr[idx] = { ...arr[idx], rate: isFinite(v) ? v : undefined }
                      handleChange('hourly_rate_by_radius', arr)
                    }} />
                  </div>
                  <Button variant="outline" onClick={()=>{
                    const arr = [...(Array.isArray(profile.hourly_rate_by_radius)?profile.hourly_rate_by_radius:[])]
                    arr.splice(idx,1)
                    handleChange('hourly_rate_by_radius', arr)
                  }}>Remove</Button>
                </div>
              ))}
            </div>
            <div>
              <Button variant="ghost" onClick={()=>{
                const base = Number(profile.hourly_rate)
                const defaultRate = Number.isFinite(base) && base > 0 ? base : 30
                const arr = [...(Array.isArray(profile.hourly_rate_by_radius)?profile.hourly_rate_by_radius:[]), { radius_km: 5, rate: defaultRate }]
                handleChange('hourly_rate_by_radius', arr)
              }}>Add tier</Button>
            </div>
          </div>

          <div>
            <Label htmlFor="payout_details">Payout Details (JSON)</Label>
            <textarea id="payout_details" value={profile.payout_details ? JSON.stringify(profile.payout_details) : ''} onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : null
                handleChange('payout_details', parsed)
              } catch {
                // keep raw string until valid
                handleChange('payout_details', e.target.value)
              }
            }} className="w-full p-2 border border-border rounded-md bg-input" rows={3} />
            <p className="text-xs text-muted-foreground">You can provide bank_account/mobile_money and payout preferences. Example: <code>{"{\"payout_type\":\"weekly\",\"bank_account\":\"000111222\"}"}</code></p>
          </div>

          <div>
            <Label htmlFor="availability">Availability (JSON)</Label>
            <textarea id="availability" value={profile.availability ? JSON.stringify(profile.availability) : ''} onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : null
                handleChange('availability', parsed)
              } catch {
                handleChange('availability', e.target.value)
              }
            }} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
            <p className="text-xs text-muted-foreground">Provide a simple JSON schedule, e.g. <code>{"{\"monday\":[\"09:00-12:00\",\"14:00-18:00\"]}"}</code></p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onClose?.()} disabled={loading}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const TrainerProfileWithMedia: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
      <TrainerProfileEditor onClose={onClose} />
      <MediaUploadSection
        title="Upload Your Media"
        description="Add photos, videos, and certifications to showcase your expertise"
        uploadType="all"
        onFilesUploaded={(files) => {
          toast({
            title: 'Success',
            description: `${files.length} file(s) uploaded successfully`
          })
        }}
      />
    </div>
  )
}
