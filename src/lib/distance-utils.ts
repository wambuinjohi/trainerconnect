/**
 * Validate and normalize geographic coordinates
 * @param lat - Latitude value (should be -90 to 90)
 * @param lng - Longitude value (should be -180 to 180)
 * @returns Valid coordinates or null if invalid
 */
function validateCoordinates(
  lat: any,
  lng: any
): { lat: number; lng: number } | null {
  // Convert to numbers
  const numLat = Number(lat)
  const numLng = Number(lng)

  // Check if both are valid numbers
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return null
  }

  // Check if within valid geographic ranges
  // Latitude: -90 to 90
  // Longitude: -180 to 180
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null
  }

  return { lat: numLat, lng: numLng }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers, or null if coordinates are invalid
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number | null {
  // Validate coordinates
  const startCoords = validateCoordinates(lat1, lon1)
  const endCoords = validateCoordinates(lat2, lon2)

  if (!startCoords || !endCoords) {
    return null
  }

  const R = 6371 // Earth's radius in km
  const dLat = ((endCoords.lat - startCoords.lat) * Math.PI) / 180
  const dLon = ((endCoords.lng - startCoords.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startCoords.lat * Math.PI) / 180) *
      Math.cos((endCoords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format distance for display
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined) {
    return '—'
  }
  return distanceKm < 1
    ? `${(distanceKm * 1000).toFixed(0)}m`
    : `${distanceKm.toFixed(1)}km`
}

/**
 * Enrich trainers with distance information
 * @param trainers - Array of trainers
 * @param userLocation - User's location {lat, lng}
 * @returns Trainers with distance and formatted distance
 */
export function enrichTrainersWithDistance(
  trainers: any[],
  userLocation: { lat: number; lng: number } | null
): any[] {
  if (!userLocation) {
    return trainers.map((t) => ({
      ...t,
      distanceKm: null,
      distance: '—',
    }))
  }

  return trainers
    .map((trainer) => {
      if (trainer.location_lat != null && trainer.location_lng != null) {
        const distKm = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          trainer.location_lat,
          trainer.location_lng
        )
        return {
          ...trainer,
          distanceKm: distKm,
          distance: formatDistance(distKm),
        }
      }
      return {
        ...trainer,
        distanceKm: null,
        distance: '—',
      }
    })
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
}

/**
 * Filter trainers based on criteria
 */
export interface FilterCriteria {
  minRating?: number
  maxPrice?: number
  onlyAvailable?: boolean
  radius?: number
  categoryId?: number | null
  searchQuery?: string
}

export interface TrainerWithCategories {
  id: string
  name: string
  rating: number
  hourlyRate: number
  available: boolean
  distanceKm: number | null
  categoryIds: number[]
  [key: string]: any
}

export function filterTrainers(
  trainers: TrainerWithCategories[],
  criteria: FilterCriteria
): TrainerWithCategories[] {
  return trainers.filter((trainer) => {
    // Filter by category
    if (criteria.categoryId !== null && criteria.categoryId !== undefined) {
      if (!trainer.categoryIds || !trainer.categoryIds.includes(criteria.categoryId)) {
        return false
      }
    }

    // Filter by rating
    if (criteria.minRating && (trainer.rating || 0) < criteria.minRating) {
      return false
    }

    // Filter by price
    if (criteria.maxPrice && (trainer.hourlyRate || 0) > criteria.maxPrice) {
      return false
    }

    // Filter by availability
    if (criteria.onlyAvailable && !trainer.available) {
      return false
    }

    // Filter by distance
    if (criteria.radius && (trainer.distanceKm == null || trainer.distanceKm > criteria.radius)) {
      return false
    }

    // Filter by search query
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase()
      const nameMatch = (trainer.name || '').toLowerCase().includes(query)
      const disciplineMatch = (trainer.discipline || '').toLowerCase().includes(query)
      if (!nameMatch && !disciplineMatch) {
        return false
      }
    }

    return true
  })
}
