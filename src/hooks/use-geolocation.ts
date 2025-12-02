import { useState, useCallback } from 'react'
import { getApproxLocation, type ApproxLocation } from '@/lib/location'
import { toast } from '@/hooks/use-toast'

export interface UseGeolocationReturn {
  location: ApproxLocation | null
  loading: boolean
  error: string | null
  requestLocation: () => Promise<void>
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<ApproxLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const loc = await getApproxLocation()

      if (loc && loc.lat != null && loc.lng != null) {
        setLocation(loc)
        const sourceLabel = loc.source === 'capacitor-geolocation' ? 'GPS' : 'device location'
        toast({
          title: 'Location set',
          description: `Location obtained via ${sourceLabel}`,
        })
      } else {
        setError('Could not determine location')
        toast({
          title: 'Location error',
          description: 'Please enable location services and try again',
          variant: 'destructive',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast({
        title: 'Location error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    location,
    loading,
    error,
    requestLocation,
  }
}
