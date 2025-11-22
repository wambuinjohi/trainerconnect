import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  MapPin,
  Star,
  Calendar,
  MessageCircle,
  Gift,
  Home,
  Compass,
  Clock,
  User,
  Plus,
  ChevronRight,
  ArrowLeft,
  LogOut
} from 'lucide-react'
import { TrainerDetails } from './TrainerDetails'
import { ClientProfileEditor } from './ClientProfileEditor'
import { PaymentMethods } from './PaymentMethods'
import { NotificationsCenter } from './NotificationsCenter'
import { ReportIssue } from './ReportIssue'
import { FiltersModal } from './FiltersModal'
import { ReviewModal } from './ReviewModal'
import { NextSessionModal } from './NextSessionModal'
import { LocationSelector } from './LocationSelector'
import { SearchBar } from './SearchBar'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchHistory } from '@/hooks/use-search-history'
import * as apiService from '@/lib/api-service'
import { enrichTrainersWithDistance } from '@/lib/distance-utils'
import { apiRequest, withAuth } from '@/lib/api'

export const ClientDashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<any>({})
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelpSupport, setShowHelpSupport] = useState(false)
  const [unreadMessagesClient, setUnreadMessagesClient] = useState(0)
  const [unreadNotificationsClient, setUnreadNotificationsClient] = useState(0)
  const [dbCategories, setDbCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [referralSavings, setReferralSavings] = useState(0)
  const [referralCode, setReferralCode] = useState('REF-' + Math.random().toString(36).slice(2, 8).toUpperCase())
  const [referralCount, setReferralCount] = useState(0)
  const [trainers, setTrainers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [reviewsByBooking, setReviewsByBooking] = useState<Record<string, any>>({})
  const [reviewBooking, setReviewBooking] = useState<any | null>(null)
  const [nextSessionBooking, setNextSessionBooking] = useState<any | null>(null)

  const { recentSearches, popularSearches, addSearch } = useSearchHistory({ trainers })

  // Generate suggestions from trainer names
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    return trainers
      .filter(t => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .map(t => t.name)
      .slice(0, 5)
  }, [searchQuery, trainers])

  const modalOpen = Boolean(selectedTrainer || showEditProfile || showPaymentMethods || showNotifications || showHelpSupport || showFilters || reviewBooking || nextSessionBooking)

  const loadBookings = async () => {
    if (!user?.id) return
    try {
      const bookingsData = await apiService.getBookings(user.id, 'client')
      if (bookingsData?.data) {
        setBookings(bookingsData.data)
      }
    } catch (err) {
      console.warn('Failed to load bookings', err)
      setBookings([])
    }
  }

  const setReviewByBooking = (bookingId: string) => {
    setReviewsByBooking(prev => ({ ...prev, [bookingId]: true }))
  }

  const checkPendingRatings = async () => {
    if (!user?.id) return
    try {
      const notifData = await apiRequest('notifications_get', { user_id: user.id }, { headers: withAuth() })
      const notifs = Array.isArray(notifData) ? notifData : (notifData?.data || [])

      // Find pending rate action notifications
      const pendingRateNotif = notifs.find((n: any) => n.action_type === 'rate' && !n.read && n.booking_id)

      if (pendingRateNotif && bookings.length > 0) {
        // Find the associated booking
        const targetBooking = bookings.find(b => b.id === pendingRateNotif.booking_id)
        if (targetBooking && targetBooking.status === 'completed' && !reviewsByBooking[targetBooking.id] && !targetBooking.rating_submitted) {
          // Auto-open the review modal
          setReviewBooking(targetBooking)
        }
      }
    } catch (err) {
      console.warn('Failed to check pending ratings', err)
    }
  }

  // Check for pending ratings when bookings load
  useEffect(() => {
    if (bookings.length > 0) {
      checkPendingRatings()
    }
  }, [bookings])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setDbCategories(categoriesData.data)
        }
      } catch (err) {
        console.warn('Failed to load categories', err)
        setDbCategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }

    const loadTrainers = async () => {
      try {
        const trainersData = await apiService.getAvailableTrainers(filters)
        if (trainersData?.data) {
          const trainersWithCategories = await Promise.all(
            trainersData.data.map(async (trainer: any) => {
              let categoryIds: number[] = []
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                if (categoriesData?.data && Array.isArray(categoriesData.data)) {
                  categoryIds = categoriesData.data.map((cat: any) => cat.category_id || cat.cat_id)
                }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id, err)
              }
              return {
                id: trainer.user_id,
                name: trainer.full_name || trainer.user_id,
                discipline: trainer.disciplines || 'Training',
                bio: trainer.bio || '',
                profile_image: trainer.profile_image || null,
                categoryIds: categoryIds,
                rating: trainer.rating || 0,
                reviews: trainer.total_reviews || 0,
                hourlyRate: trainer.hourly_rate || 0,
                available: trainer.is_available !== false,
                distance: '—',
                distanceKm: null,
                service_radius: trainer.service_radius || 10,
                location_lat: trainer.location_lat || null,
                location_lng: trainer.location_lng || null,
                location_label: trainer.location_label || 'Unknown',
                image: trainer.profile_image ? null : '👤',
                availability: (() => {
                  try {
                    return typeof trainer.availability === 'string' ? JSON.parse(trainer.availability) : trainer.availability
                  } catch {
                    return null
                  }
                })(),
                hourly_rate_by_radius: (() => {
                  try {
                    return typeof trainer.hourly_rate_by_radius === 'string' ? JSON.parse(trainer.hourly_rate_by_radius) : trainer.hourly_rate_by_radius
                  } catch {
                    return []
                  }
                })(),
                pricing_packages: (() => {
                  try {
                    return typeof trainer.pricing_packages === 'string' ? JSON.parse(trainer.pricing_packages) : trainer.pricing_packages
                  } catch {
                    return []
                  }
                })()
              }
            })
          )
          setTrainers(trainersWithCategories)
        }
      } catch (err) {
        console.warn('Failed to load trainers', err)
        setTrainers([])
      }
    }

    loadCategories()
    loadTrainers()
    loadBookings()
  }, [user?.id, filters])

  const applyFilters = (list: any[]) => {
    return list.filter(t => {
      // Handle category filter from selectedCategory (sidebar) or from filters (modal)
      if (selectedCategory) {
        const selectedCategoryId = dbCategories.find(c => c.name === selectedCategory)?.id
        const match = selectedCategoryId && t.categoryIds && t.categoryIds.includes(selectedCategoryId)
        if (!match) return false
      } else if (filters.categoryId !== null && filters.categoryId !== undefined) {
        // Category filter from modal
        const match = t.categoryIds && t.categoryIds.includes(filters.categoryId)
        if (!match) return false
      }
      if (filters.minRating && (t.rating || 0) < filters.minRating) return false
      if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
      if (filters.onlyAvailable && !t.available) return false
      if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const nameMatch = (t.name || '').toLowerCase().includes(query)
        const disciplineMatch = (t.discipline || '').toLowerCase().includes(query)
        if (!nameMatch && !disciplineMatch) return false
      }
      return true
    })
  }

  // Update distances when user location changes
  useEffect(() => {
    if (userLocation && trainers.length > 0) {
      const updatedTrainers = enrichTrainersWithDistance(trainers, userLocation)
      setTrainers(updatedTrainers)
    }
  }, [userLocation])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Location not supported' })
      return
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      toast({ title: 'Location set' })
    }, (err) => {
      toast({ title: 'Location error' })
    })
  }

  const inviteFriends = () => {
    try { navigator.clipboard.writeText(referralCode) } catch {}
    toast({ title: 'Referral code', description: `Share this code: ${referralCode}` })
  }

  const openTrainer = (trainer: any) => setSelectedTrainer(trainer)
  const closeTrainer = () => setSelectedTrainer(null)
  const handleCategorySelect = (category: string) => { setSelectedCategory(category); setActiveTab('explore') }

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  // -------------------- Render Functions --------------------
  const renderHomeContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div></div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5 text-red-500" />
        </Button>
      </div>
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Perfect Trainer</h1>
        <p className="text-muted-foreground">Connect with certified professionals in your area</p>
      </div>
      <SearchBar
        placeholder="Search trainers or services..."
        value={searchQuery}
        onChange={setSearchQuery}
        onSubmit={(query) => {
          if (query) {
            addSearch(query)
            setActiveTab('explore')
          }
        }}
        suggestions={suggestions}
        recentSearches={recentSearches}
        popularSearches={popularSearches}
      />

      <LocationSelector />

      {!userLocation && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Find trainers near you</h3>
              <p className="text-sm text-muted-foreground">We use your location only to sort trainers by distance.</p>
            </div>
            <Button variant="outline" size="sm" onClick={requestLocation}>Enable GPS</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-primary border-0 text-white">
        <CardContent className="p-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2"><Gift className="h-5 w-5" /><span className="font-semibold">Referral Rewards</span></div>
            <p className="text-sm opacity-90 mb-3">Invite friends and get 10% off your next 5 bookings!</p>
            <Button variant="secondary" size="sm" className="bg-white text-trainer-accent hover:bg-gray-100" onClick={inviteFriends}>Invite Friends</Button>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">Ksh {referralSavings}</div>
            <div className="text-sm opacity-90">Saved so far</div>
            <div className="text-xs opacity-90">Code: {referralCode}</div>
            <div className="text-xs opacity-90">Referrals: {referralCount}</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Browse Categories</h2>
        <div className="grid grid-cols-1 gap-4">
          {categoriesLoading ? (
            <>
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
              <Skeleton className="h-20 w-full rounded-xl bg-muted/40" />
            </>
          ) : dbCategories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">No categories available.</div>
          ) : (
            dbCategories.map((category) => (
              <Card key={category.id} className="bg-trainer-card border-transparent rounded-xl shadow-card hover:shadow-glow cursor-pointer group" onClick={() => handleCategorySelect(category.name)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-xl text-white shadow-glow">{category.icon}</div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{category.name}</h3>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )

  const renderExploreContent = () => {
    // Filter trainers based on selected category and other criteria
    const filteredTrainers = selectedCategory
      ? trainers.filter(t => {
          const selectedCategoryId = dbCategories.find(c => c.name === selectedCategory)?.id
          const match = selectedCategoryId && t.categoryIds && t.categoryIds.includes(selectedCategoryId)

          if (!match) return false
          if (filters.minRating && (t.rating || 0) < filters.minRating) return false
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
          if (filters.onlyAvailable && !t.available) return false
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
          if (searchQuery && !((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false

          return true
        })
      : trainers.filter(t => {
          if (filters.minRating && (t.rating || 0) < filters.minRating) return false
          if (filters.maxPrice && (t.hourlyRate || 0) > Number(filters.maxPrice)) return false
          if (filters.onlyAvailable && !t.available) return false
          if (filters.radius && (t.distanceKm == null || t.distanceKm > Number(filters.radius))) return false
          if (searchQuery && !((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (t.discipline || '').toLowerCase().includes(searchQuery.toLowerCase()))) return false

          return true
        })

    const nearestTrainerId = filteredTrainers.length > 0 ? filteredTrainers[0].id : null

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedCategory ? `${selectedCategory} Trainers` : 'Nearby Trainers'}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(true)}><MapPin className="h-4 w-4 mr-2" />Filters</Button>
        </div>

        {filteredTrainers.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No trainers found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTrainers.map((trainer, idx) => (
              <Card
                key={trainer.id}
                className={`bg-card border-2 transition-all ${idx === 0 && userLocation ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'}`}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                    {trainer.image}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{trainer.name}</h3>
                          {idx === 0 && userLocation && selectedCategory && (
                            <Badge className="bg-green-500 text-white text-xs">Nearest</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{trainer.discipline}</p>
                      </div>
                      <Badge variant={trainer.available ? "default" : "secondary"} className="flex-shrink-0">
                        {trainer.available ? 'Available' : 'Busy'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {trainer.rating} ({trainer.reviews})
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {trainer.location_label}
                        {trainer.distance !== '—' && <span className="ml-1 font-semibold text-foreground">{trainer.distance}</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Ksh {trainer.hourlyRate}/hour</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openTrainer(trainer)}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="bg-gradient-primary text-white" onClick={() => openTrainer(trainer)}>
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderScheduleContent = () => {
    const sortedBookings = [...bookings].sort((a, b) =>
      new Date(b.session_date || 0).getTime() - new Date(a.session_date || 0).getTime()
    )

    const groupedByStatus = {
      pending: sortedBookings.filter(b => b.status === 'pending'),
      confirmed: sortedBookings.filter(b => b.status === 'confirmed'),
      in_session: sortedBookings.filter(b => b.status === 'in_session'),
      completed: sortedBookings.filter(b => b.status === 'completed'),
      cancelled: sortedBookings.filter(b => b.status === 'cancelled'),
    }

    const renderBookingCard = (booking: any, showActions: boolean = true) => (
      <Card key={booking.id} className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{booking.trainer_name || booking.trainer_id || 'Trainer'}</h3>
              <p className="text-sm text-muted-foreground">{booking.notes || 'Session'}</p>
            </div>
            <Badge variant={
              booking.status === 'confirmed' ? 'default' :
              booking.status === 'in_session' ? 'secondary' :
              booking.status === 'completed' ? 'outline' :
              booking.status === 'cancelled' ? 'destructive' :
              'secondary'
            }>
              {booking.status?.replace('_', ' ').charAt(0).toUpperCase() + booking.status?.slice(1).replace('_', ' ') || 'Pending'}
            </Badge>
          </div>

          <div className="space-y-2 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {booking.session_date ? new Date(booking.session_date).toLocaleDateString() : 'TBD'}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {booking.session_time || 'Time TBD'}
            </div>
            {booking.total_amount && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ksh {Number(booking.total_amount).toLocaleString()}
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => openTrainer({ id: booking.trainer_id })} className="flex-1">
                <MessageCircle className="h-3 w-3 mr-1" />
                Chat
              </Button>
              {booking.status === 'completed' && !reviewsByBooking[booking.id] && (
                <Button size="sm" className="flex-1 bg-gradient-primary text-white" onClick={() => setReviewBooking(booking)}>
                  <Star className="h-3 w-3 mr-1" />
                  Rate
                </Button>
              )}
              {booking.status === 'completed' && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setNextSessionBooking(booking)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Next
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Sessions</h1>
        </div>

        {bookings.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Book a session to get started</p>
              <Button className="mt-4" size="sm" onClick={() => setActiveTab('explore')}>Explore Trainers</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedByStatus.confirmed.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Upcoming
                </h2>
                {groupedByStatus.confirmed.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.in_session.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  In Session
                </h2>
                {groupedByStatus.in_session.map(b => renderBookingCard(b, false))}
              </div>
            )}

            {groupedByStatus.completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Completed
                </h2>
                {groupedByStatus.completed.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.pending.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  Pending
                </h2>
                {groupedByStatus.pending.map(b => renderBookingCard(b))}
              </div>
            )}

            {groupedByStatus.cancelled.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-red-500" />
                  Cancelled
                </h2>
                {groupedByStatus.cancelled.map(b => renderBookingCard(b, false))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // -------------------- Other renderContent functions (Schedule, Profile) can also be simplified similarly --------------------

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-20 container max-w-md mx-auto p-4">
        {activeTab === 'home' && renderHomeContent()}
        {activeTab === 'explore' && renderExploreContent()}
        {activeTab === 'schedule' && renderScheduleContent()}
      </div>

      {selectedTrainer && <TrainerDetails trainer={selectedTrainer} onClose={closeTrainer} />}
      {showEditProfile && <ClientProfileEditor onClose={() => setShowEditProfile(false)} />}
      {showPaymentMethods && <PaymentMethods onClose={() => setShowPaymentMethods(false)} />}
      {showNotifications && <NotificationsCenter onClose={() => setShowNotifications(false)} />}
      {showHelpSupport && <ReportIssue onDone={() => setShowHelpSupport(false)} />}
      {showFilters && <FiltersModal initial={filters} onApply={(f) => setFilters(f)} onClose={() => setShowFilters(false)} />}
      {reviewBooking && <ReviewModal booking={reviewBooking} onClose={() => setReviewBooking(null)} onSubmitted={() => {
        setReviewByBooking(reviewBooking.id)
        setReviewBooking(null)
        setBookings(bookings.map(b => b.id === reviewBooking.id ? { ...b, rating_submitted: true } : b))
      }} />}
      {nextSessionBooking && <NextSessionModal previous={nextSessionBooking} onClose={() => setNextSessionBooking(null)} onBooked={() => { setNextSessionBooking(null); loadBookings() }} />}

      {!modalOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
          <div className="container max-w-md mx-auto flex justify-around py-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-primary' : 'text-muted-foreground'}><Home className="h-5 w-5" /><span className="text-xs">Home</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('explore')} className={activeTab === 'explore' ? 'text-primary' : 'text-muted-foreground'}><Compass className="h-5 w-5" /><span className="text-xs">Explore</span></Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('schedule')} className={activeTab === 'schedule' ? 'text-primary' : 'text-muted-foreground'}><Calendar className="h-5 w-5" /><span className="text-xs">Sessions</span></Button>
          </div>
        </div>
      )}
    </div>
  )
}
