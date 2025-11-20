import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Calendar,
  DollarSign,
  Star,
  Users,
  MessageCircle,
  Clock,
  MapPin,
  Settings,
  BarChart3,
  Gift,
  Plus,
  User,
  Home,
  Briefcase,
  ArrowLeft,
  LogOut
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { TrainerProfileEditor } from './TrainerProfileEditor'
import { AvailabilityEditor } from './AvailabilityEditor'
import { ServicesManager } from './ServicesManager'
import { ServiceAreaEditor } from './ServiceAreaEditor'
import { TrainerChat } from './TrainerChat'
import { Payouts } from './Payouts'
import { TrainerTopUp } from './TrainerTopUp'
import { PromoteProfile } from './PromoteProfile'
import { loadSettings } from '@/lib/settings'
import { toast } from '@/hooks/use-toast'
import { TrainerReportIssue } from './TrainerReportIssue'
import * as apiService from '@/lib/api-service'

export const TrainerDashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [isAvailable, setIsAvailable] = useState(true)
  const [showServicesManager, setShowServicesManager] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [monthRevenue, setMonthRevenue] = useState<number>(0)
  const [monthSessions, setMonthSessions] = useState<number>(0)

  const referNow = async () => {
    if (!user) return
    const settings = loadSettings()
    let code = 'REF-T-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    try {
      if (settings.useReferrerPhoneAsCode) {
        // Placeholder: replace with your own logic
        code = '123456'
      }
      // Placeholder: simulate referral creation
      setReferralCount(referralCount + 1)
      toast({ title: 'Referral created', description: `Share this code: ${code}` })
    } catch (err) {
      console.warn('Referral create failed', err)
      toast({ title: 'Referral', description: `Share this code: ${code}` })
    }
  }

  const [bookings, setBookings] = useState<any[]>([])
  const [chatBooking, setChatBooking] = useState<any | null>(null)
  const [showPayouts, setShowPayouts] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [profileData, setProfileData] = useState<any>({
    name: user?.email,
    bio: 'Professional Trainer',
    profile_image: null,
    hourly_rate: 0,
    availability: [],
    pricing_packages: []
  })
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [showPromote, setShowPromote] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])
  const [avgRating, setAvgRating] = useState<number>(0)

  const openPromote = () => setShowPromote(true)
  const openChat = (booking: any) => setChatBooking(booking)
  const closeChat = () => setChatBooking(null)

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/'
  }

  const acceptBooking = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed' } : b))
    toast({ title: 'Booking accepted', description: 'You accepted the booking.' })
  }

  const declineBooking = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    toast({ title: 'Booking declined', description: 'You declined the booking.', variant: 'destructive' })
  }

  const startSession = (id: string) => {
    setBookings(prev => prev.map(b => {
      if (b.id !== id) return b
      if (b.status === 'confirmed') return { ...b, status: 'in_session' }
      if (b.status === 'in_session') return { ...b, status: 'completed' }
      return b
    }))
    toast({ title: 'Session updated', description: 'Booking status updated' })
  }

  useEffect(() => {
    const loadBookings = async () => {
      if (!user?.id) return
      try {
        const bookingsData = await apiService.getBookings(user.id, 'trainer')
        if (bookingsData?.data && Array.isArray(bookingsData.data)) {
          setBookings(bookingsData.data)

          // Calculate month stats
          const now = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthBookings = bookingsData.data.filter((b: any) => b.session_date && new Date(b.session_date) >= monthStart)
          setMonthSessions(monthBookings.length)

          const monthRevenue = monthBookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)
          setMonthRevenue(monthRevenue)
        } else {
          setBookings([])
        }
      } catch (err) {
        console.warn('Failed to load trainer bookings', err)
        setBookings([])
      }
    }
    loadBookings()
  }, [user?.id])

  useEffect(() => {
    const loadReviews = async () => {
      if (!user?.id || !showReviews) return
      try {
        const reviewsData = await apiService.getReviews(user.id)
        if (reviewsData?.data && Array.isArray(reviewsData.data)) {
          setReviews(reviewsData.data)
          if (reviewsData.data.length > 0) {
            const avgRate = reviewsData.data.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / reviewsData.data.length
            setAvgRating(avgRate)
          }
        } else {
          setReviews([])
        }
      } catch (err) {
        console.warn('Failed to load trainer reviews', err)
        setReviews([])
      }
    }
    loadReviews()
  }, [user?.id, showReviews])

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [showServiceArea, setShowServiceArea] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    const loadTrainerProfile = async () => {
      if (!user?.id) return
      try {
        const profile = await apiService.getTrainerProfile(user.id)
        if (profile?.data && profile.data.length > 0) {
          const profileData = profile.data[0]
          setProfileData({
            name: profileData.full_name || user.email,
            bio: profileData.bio || 'Professional Trainer',
            profile_image: profileData.profile_image || null,
            hourly_rate: profileData.hourly_rate || 0,
            availability: profileData.availability ? (typeof profileData.availability === 'string' ? JSON.parse(profileData.availability) : profileData.availability) : [],
            pricing_packages: profileData.pricing_packages ? (typeof profileData.pricing_packages === 'string' ? JSON.parse(profileData.pricing_packages) : profileData.pricing_packages) : []
          })
        } else {
          setProfileData({
            name: user.email,
            bio: 'Professional Trainer',
            profile_image: null,
            hourly_rate: 0,
            availability: [],
            pricing_packages: []
          })
        }
      } catch (err) {
        console.warn('Failed to load trainer profile', err)
        setProfileData({
          name: user.email,
          bio: 'Professional Trainer',
          profile_image: null,
          hourly_rate: 0,
          availability: [],
          pricing_packages: []
        })
      }

      // Load wallet balance - handle gracefully if table doesn't exist
      try {
        const walletData = await apiService.getWalletBalance(user.id)
        if (walletData?.data && walletData.data.length > 0) {
          setWalletBalance(walletData.data[0].balance || 0)
        }
      } catch (err) {
        console.warn('Failed to load wallet balance', err)
        setWalletBalance(0)
      }
    }
    loadTrainerProfile()
  }, [user?.id])

  const renderHomeContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <div className="text-center py-4">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl mx-auto mb-4">
          💪
        </div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground">Ready to inspire and train today?</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">This Month</div>
            <div className="text-2xl font-bold text-foreground mt-2">Ksh {monthRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Revenue</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Sessions</div>
            <div className="text-2xl font-bold text-foreground mt-2">{monthSessions}</div>
            <div className="text-xs text-muted-foreground mt-1">This month</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Wallet</div>
            <div className="text-2xl font-bold text-foreground mt-2">Ksh {walletBalance.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Available balance</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Messages</div>
            <div className="text-2xl font-bold text-foreground mt-2">{unreadMessages}</div>
            <div className="text-xs text-muted-foreground mt-1">Unread</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="w-full" onClick={() => setEditingProfile(true)}>Edit Profile</Button>
          <Button variant="outline" className="w-full" onClick={() => setEditingAvailability(true)}>Set Hours</Button>
          <Button variant="outline" className="w-full" onClick={() => setShowPayouts(true)}>Payouts</Button>
          <Button variant="outline" className="w-full" onClick={openPromote}>Promote</Button>
        </div>
      </div>
    </div>
  )

  const renderBookingsContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
      </div>
      {bookings && bookings.length > 0 ? (
        bookings.map(b => (
          <Card key={b.id || b.user_id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>{b.client_name || 'Client'}</div>
                <Badge variant={b.status === 'confirmed' ? 'default' : 'secondary'}>{b.status || 'pending'}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{b.session_date || 'TBD'} at {b.session_time || ''}</div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => openChat(b)}>Chat</Button>
                {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => acceptBooking(b.id)}>Accept</Button>}
                {(b.status === 'pending' || !b.status) && <Button size="sm" onClick={() => declineBooking(b.id)}>Decline</Button>}
                {(b.status === 'confirmed' || b.status === 'in_session') && <Button size="sm" onClick={() => startSession(b.id)}>Start/End</Button>}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your bookings will appear here</p>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderProfileContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('home')} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl mx-auto mb-4">
          {profileData.profile_image ? '🖼️' : '👨‍💼'}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{profileData.name}</h1>
        <p className="text-muted-foreground mt-2">{profileData.bio}</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Hourly Rate</p>
            <p className="text-lg font-semibold text-foreground">Ksh {profileData.hourly_rate}</p>
          </div>
          {profileData.availability && profileData.availability.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Availability</p>
              <p className="text-sm text-foreground">{typeof profileData.availability === 'object' ? Object.keys(profileData.availability).join(', ') : 'Check schedule'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="w-full" onClick={() => setEditingProfile(true)}>Edit Profile</Button>
        <Button variant="outline" className="w-full" onClick={() => setEditingAvailability(true)}>Edit Availability</Button>
        <Button variant="outline" className="w-full" onClick={() => setShowServiceArea(true)}>Service Area</Button>
        <Button variant="destructive" className="w-full" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return renderHomeContent()
      case 'bookings': return renderBookingsContent()
      case 'profile': return renderProfileContent()
      default: return renderHomeContent()
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-20">
        <div className="container max-w-md mx-auto p-4">
          {renderContent()}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="container max-w-md mx-auto">
          <div className="flex items-center justify-around py-2">
            <Button variant={activeTab === 'home' ? 'default' : 'ghost'} onClick={() => setActiveTab('home')} size="sm"><Home className="h-5 w-5" /></Button>
            <Button variant={activeTab === 'bookings' ? 'default' : 'ghost'} onClick={() => setActiveTab('bookings')} size="sm"><Calendar className="h-5 w-5" /></Button>
            <Button variant="ghost" onClick={() => setShowServicesManager(true)} size="sm"><Plus className="h-5 w-5" /></Button>
            <Button variant={activeTab === 'profile' ? 'default' : 'ghost'} onClick={() => setActiveTab('profile')} size="sm"><User className="h-5 w-5" /></Button>
          </div>
        </div>
      </div>

      {showServicesManager && <ServicesManager onClose={() => setShowServicesManager(false)} />}
      {editingProfile && <TrainerProfileEditor onClose={() => setEditingProfile(false)} />}
      {editingAvailability && <AvailabilityEditor onClose={() => setEditingAvailability(false)} />}
      {showServiceArea && <ServiceAreaEditor onClose={() => setShowServiceArea(false)} />}
      {showPayouts && <Payouts onClose={() => setShowPayouts(false)} />}
      {showPromote && <PromoteProfile onClose={() => setShowPromote(false)} />}
      {showReport && <TrainerReportIssue onClose={() => setShowReport(false)} />}
      {chatBooking && <TrainerChat booking={chatBooking} onClose={closeChat} />}
    </div>
  )
}
