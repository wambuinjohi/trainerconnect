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
  Briefcase
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
        if (bookingsData?.data) {
          setBookings(bookingsData.data)

          // Calculate month stats
          const now = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthBookings = bookingsData.data.filter((b: any) => new Date(b.session_date) >= monthStart)
          setMonthSessions(monthBookings.length)

          const monthRevenue = monthBookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)
          setMonthRevenue(monthRevenue)
        }
      } catch (err) {
        console.warn('Failed to load trainer bookings', err)
      }
    }
    loadBookings()
  }, [user?.id])

  useEffect(() => {
    const loadReviews = async () => {
      if (!user?.id || !showReviews) return
      try {
        const reviewsData = await apiService.getReviews(user.id)
        if (reviewsData?.data) {
          setReviews(reviewsData.data)
          if (reviewsData.data.length > 0) {
            const avgRate = reviewsData.data.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / reviewsData.data.length
            setAvgRating(avgRate)
          }
        }
      } catch (err) {
        console.warn('Failed to load trainer reviews', err)
      }
    }
    loadReviews()
  }, [user?.id, showReviews])

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [showServiceArea, setShowServiceArea] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const renderHomeContent = () => (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl mx-auto mb-4">
          👨‍💼
        </div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground">Ready to inspire and train today?</p>
      </div>
    </div>
  )

  const renderBookingsContent = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
      {bookings.map(b => (
        <Card key={b.id} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex justify-between">
              <div>{b.client_name}</div>
              <Badge variant={b.status === 'confirmed' ? 'default' : 'secondary'}>{b.status}</Badge>
            </div>
            <div className="flex gap-2 mt-2">
              <Button onClick={() => openChat(b)}>Chat</Button>
              {b.status === 'pending' && <Button onClick={() => acceptBooking(b.id)}>Accept</Button>}
              {b.status === 'pending' && <Button onClick={() => declineBooking(b.id)}>Decline</Button>}
              {(b.status === 'confirmed' || b.status === 'in_session') && <Button onClick={() => startSession(b.id)}>Start/End</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderProfileContent = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{profileData.name}</h1>
      <p className="text-muted-foreground">{profileData.bio}</p>
      <div className="flex gap-2">
        <Button onClick={() => setEditingProfile(true)}>Edit Profile</Button>
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
            <Button onClick={() => setActiveTab('home')}><Home /></Button>
            <Button onClick={() => setActiveTab('bookings')}><Calendar /></Button>
            <Button onClick={() => setShowServicesManager(true)}><Plus /></Button>
            <Button onClick={() => setActiveTab('profile')}><User /></Button>
          </div>
        </div>
      </div>

      {showServicesManager && <ServicesManager onClose={() => setShowServicesManager(false)} />}
      {editingProfile && <TrainerProfileEditor onClose={() => setEditingProfile(false)} />}
      {chatBooking && <TrainerChat booking={chatBooking} onClose={closeChat} />}
    </div>
  )
}
