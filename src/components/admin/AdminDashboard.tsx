import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import AdminSidebar from './AdminSidebar'
import ThemeToggleAdmin from './ThemeToggleAdmin'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  UserCheck,
  AlertCircle,
  Settings,
  TrendingUp,
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  Plus,
  Trash2,
  Save,
  Pencil,
  Key
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { loadSettings, saveSettings, defaultSettings, defaultMpesaSettings, type PlatformSettings, type MpesaSettings, loadSettingsFromDb, saveSettingsToDb } from '@/lib/settings'
import { useTheme } from 'next-themes'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { toast } from '@/hooks/use-toast'
import * as apiService from '@/lib/api-service'

type DisputeStatus = 'pending' | 'investigating' | 'resolved'

type Dispute = {
  id: string | number
  case: string
  client: string
  trainer: string
  issue: string
  amount: number
  status: DisputeStatus
  submittedAt: string
  refunded?: boolean
  notes?: string
}

type AnalyticsPoint = {
  rawDate: string
  revenue: number
  bookings: number
  aov: number
}

type ActivityItemTone = 'positive' | 'neutral' | 'alert'

type ActivityItem = {
  id: string
  timestamp: string
  message: string
  tone: ActivityItemTone
}

const kesFormatter = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatKes = (value: number) => {
  const numeric = Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  return `Ksh ${kesFormatter.format(safe)}`
}
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const safeDate = (value: string | null | undefined) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}
const buildAnalyticsPoints = (rows: any[]): AnalyticsPoint[] => {
  const buckets = new Map<string, { revenue: number; bookings: number }>()
  rows.forEach((row) => {
    const date = safeDate(row?.created_at)
    if (!date) return
    const key = date.toISOString().slice(0, 10)
    const summary = buckets.get(key) || { revenue: 0, bookings: 0 }
    summary.revenue += Number(row?.total_amount) || 0
    summary.bookings += 1
    buckets.set(key, summary)
  })
  return Array.from(buckets.entries())
    .map(([day, summary]) => {
      const rawDate = `${day}T00:00:00Z`
      const revenue = Number(summary.revenue.toFixed(2))
      const bookings = summary.bookings
      const aov = bookings ? revenue / bookings : 0
      return { rawDate, revenue, bookings, aov }
    })
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
}
const formatActivityTimestamp = (value: string) => {
  const date = safeDate(value)
  return date ? date.toLocaleString() : ''
}

const activityToneColors: Record<ActivityItemTone, string> = {
  positive: 'bg-blue-500',
  neutral: 'bg-blue-500',
  alert: 'bg-yellow-500',
}

const initialStats = {
  totalUsers: 0,
  totalTrainers: 0,
  totalClients: 0,
  totalAdmins: 0,
  totalBookings: 0,
  totalRevenue: 0,
  pendingApprovals: 0,
  activeDisputes: 0,
}

export const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [range, setRange] = useState<'30d' | '90d' | '12m'>('12m')
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [stats, setStats] = useState(initialStats)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DisputeStatus>('all')
  const [activeDispute, setActiveDispute] = useState<Dispute | null>(null)
  const [analyticsPoints, setAnalyticsPoints] = useState<AnalyticsPoint[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [adminApiAvailable, setAdminApiAvailable] = useState(false)

  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    if (loaded.mpesa) setMpesa(loaded.mpesa)
    // Try to hydrate from DB if available
    loadSettingsFromDb().then((db) => { if (db) { setSettings(db); if (db.mpesa) setMpesa(db.mpesa) } }).catch(() => {})
  }, [])

  const revenueSeries = useMemo(() => {
    if (!analyticsPoints.length) return []

    const now = new Date()
    const start = new Date(now)
    if (range === '30d') {
      start.setDate(start.getDate() - 30)
    } else if (range === '90d') {
      start.setDate(start.getDate() - 90)
    } else {
      start.setMonth(start.getMonth() - 12)
    }

    const filtered = analyticsPoints.filter((point) => {
      const pointDate = new Date(point.rawDate)
      return pointDate >= start && pointDate <= now
    })

    if (!filtered.length) return []

    if (range === '12m') {
      const monthly = new Map<string, { order: number; revenue: number; bookings: number; month: string }>()
      filtered.forEach((point) => {
        const date = new Date(point.rawDate)
        const order = date.getFullYear() * 12 + date.getMonth()
        const key = `${date.getFullYear()}-${date.getMonth()}`
        const bucket = monthly.get(key) || { order, revenue: 0, bookings: 0, month: monthFormatter.format(date) }
        bucket.revenue += point.revenue
        bucket.bookings += point.bookings
        monthly.set(key, bucket)
      })
      return Array.from(monthly.values())
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          month: item.month,
          revenue: Number(item.revenue.toFixed(2)),
          bookings: item.bookings,
          aov: item.bookings ? Number((item.revenue / item.bookings).toFixed(2)) : 0,
        }))
    }

    return filtered
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
      .map((point) => ({
        month: dayFormatter.format(new Date(point.rawDate)),
        revenue: Number(point.revenue.toFixed(2)),
        bookings: point.bookings,
        aov: Number(point.aov.toFixed(2)),
      }))
  }, [analyticsPoints, range])

  const userComposition = useMemo(() => ([
  { name: 'Clients', value: stats.totalClients || Math.max(0, stats.totalUsers - stats.totalTrainers) },
  { name: 'Trainers', value: stats.totalTrainers },
]), [stats])

  const kpiSummary = useMemo(() => {
    if (!revenueSeries.length) {
      return { totalRevenue: 0, totalBookings: 0, averageAov: 0 }
    }
    const totalRevenue = revenueSeries.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
    const totalBookings = revenueSeries.reduce((sum, item) => sum + (Number(item.bookings) || 0), 0)
    const averageAov = totalBookings ? totalRevenue / totalBookings : 0
    return { totalRevenue, totalBookings, averageAov }
  }, [revenueSeries])

  const update = (patch: Partial<PlatformSettings>) => setSettings(prev => ({ ...prev, ...patch }))

  const [announcementTarget, setAnnouncementTarget] = useState<'all'|'clients'|'trainers'|'admins'>('all')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      // Always save locally
      saveSettings(settings)
      // Best effort DB persist
      const ok = await saveSettingsToDb(settings)
      if (ok) {
        toast({ title: 'Settings saved' })
      } else {
        toast({ title: 'Saved locally', description: 'DB persist unavailable (check table or RLS).', variant: 'default' })
      }
    } finally {
      setSaving(false)
    }
  }

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast({ title: 'Missing content', description: 'Please provide title and message', variant: 'destructive' })
      return
    }
    setSendingAnnouncement(true)
    try {
      // Announcement functionality removed - would need alternative implementation
      toast({ title: 'Announcement feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
    } catch (err:any) {
      console.warn('Send announcement failed', err)
      toast({ title: 'Error', description: err?.message || 'Failed to send announcement', variant: 'destructive' })
    } finally {
      setSendingAnnouncement(false)
    }
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalTrainers}</p>
                <p className="text-xs text-muted-foreground">Active Trainers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalBookings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">Ksh {stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-foreground">Pending Approvals</p>
                  <p className="text-sm text-muted-foreground">{stats.pendingApprovals} trainer applications need review</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('approvals')}>
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-semibold text-foreground">Active Disputes</p>
                  <p className="text-sm text-muted-foreground">{stats.activeDisputes} cases require attention</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('disputes')}>
                Handle
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityFeed.length ? (
            <div className="space-y-4">
              {activityFeed.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className={`w-2 h-2 rounded-full ${activityToneColors[item.tone]}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{formatActivityTimestamp(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Recent activity will appear here when bookings, payouts, disputes, or promotions are updated.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderApprovals = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Trainer Approvals</h1>
        <Badge variant="secondary">{approvals.length} pending</Badge>
      </div>

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No pending trainer approvals.</CardContent>
          </Card>
        ) : approvals.map((trainer) => (
          <Card key={trainer.id || trainer.user_id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{trainer.full_name || trainer.user_id || 'Unnamed'}</h3>
                  <p className="text-muted-foreground">{trainer.email || trainer.phone_number || ''}</p>
                  <p className="text-sm text-muted-foreground mt-1">Applied {trainer.created_at ? new Date(trainer.created_at).toLocaleDateString() : ''}</p>
                </div>
                <Badge variant="outline">Pending Review</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Disciplines</p>
                  <p className="text-sm text-muted-foreground">{Array.isArray(trainer.disciplines)? trainer.disciplines.join(', '): trainer.disciplines || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Experience (years)</p>
                  <p className="text-sm text-muted-foreground">{trainer.experience_years ?? '-'}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-foreground mb-2">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(trainer.certifications)? trainer.certifications : (trainer.certifications? [trainer.certifications]: [])).map((cert: any, index: number) => (
                    <Badge key={index} variant="secondary">{cert}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => rejectTrainer(trainer.user_id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button size="sm" className="bg-gradient-primary text-white" onClick={() => approveTrainer(trainer.user_id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const toCSV = (rows: any[]) => [
    'case,client,trainer,issue,amount,status,submittedAt,refunded',
    ...rows.map(r => [r.case,r.client,r.trainer,`"${r.issue}"`,r.amount,r.status,r.submittedAt,!!r.refunded].join(','))
  ].join('\n')

  const issueToDispute = (issue: any): Dispute => {
    const clientUser = users.find((u: any) => u.user_id === issue.user_id)
    const trainerUser = users.find((u: any) => u.user_id === issue.trainer_id)
    return {
      id: issue.id,
      case: `#${issue.id?.substring(0, 8) || Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      client: clientUser?.full_name || issue.user_id || 'Unknown Client',
      trainer: trainerUser?.full_name || issue.trainer_id || 'N/A',
      issue: issue.description || 'No description',
      amount: 0,
      status: (issue.status || 'open') as DisputeStatus,
      submittedAt: issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Unknown',
      refunded: false,
      notes: issue.resolution || undefined,
    }
  }

  const transformedDisputes = useMemo(() => {
    return issues.map(issue => issueToDispute(issue))
  }, [issues, users])

  const filtered = useMemo(() => {
    return transformedDisputes.filter(d => {
      const q = query.toLowerCase()
      const matches = !q || [d.case,d.client,d.trainer,d.issue].some(v => String(v).toLowerCase().includes(q))
      const statusOk = statusFilter === 'all' ? true : d.status === statusFilter
      return matches && statusOk
    })
  }, [transformedDisputes, query, statusFilter])

  const setStatus = async (id: any, status: DisputeStatus) => {
    const issueId = String(id)
    try {
      await apiService.updateIssueStatus(issueId, status)
      setIssues(iss => iss.map(i => i.id === issueId ? { ...i, status } : i))
      if (activeDispute?.id === id) {
        setActiveDispute({ ...activeDispute, status })
      }
      toast({ title: 'Success', description: `Dispute status updated to ${status}` })
    } catch (err: any) {
      console.error('Update dispute status error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update dispute status', variant: 'destructive' })
    }
  }

  const resolve = (id: any) => setStatus(id, 'resolved')

  const refund = async (id: any) => {
    toast({ title: 'Feature unavailable', description: 'Refund functionality not yet implemented', variant: 'destructive' })
  }

  const [promotions, setPromotions] = useState<any[]>([])
  const [payoutRequests, setPayoutRequests] = useState<any[]>([])
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'all'|'requested'|'paid'|'failed'>('all')
  const payoutsFiltered = useMemo(() => {
    return payoutRequests.filter((p:any) => {
      const status = String(p.status || 'requested').toLowerCase()
      return payoutStatusFilter === 'all' ? true : status === payoutStatusFilter
    })
  }, [payoutRequests, payoutStatusFilter])
  const payoutStats = useMemo(() => {
    const total = payoutsFiltered.reduce((s:number, p:any) => s + (Number(p.amount) || 0), 0)
    const paid = payoutsFiltered.filter((p:any) => String(p.status || '').toLowerCase() === 'paid').reduce((s:number, p:any) => s + (Number(p.amount) || 0), 0)
    const pending = total - paid
    return { total, paid, pending }
  }, [payoutsFiltered])
  const [categories, setCategories] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [catForm, setCatForm] = useState({ name: '', icon: '', description: '' })
  const [catLoading, setCatLoading] = useState(false)

  // Normalize approval checks helper
  const approvedOf = (u:any) => {
    const v = u && (u.is_approved !== undefined ? u.is_approved : u)
    if (v === true) return true
    if (v === false) return false
    if (v == null) return false
    const s = String(v).trim().toLowerCase()
    return ['1','true','yes','y','t'].includes(s)
  }

  // Approve a trainer
  const approveTrainer = async (userId: string) => {
    try {
      await apiService.approveTrainer(userId)
      toast({ title: 'Success', description: 'Trainer approved' })
      // Refresh page after showing success message
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      console.error('Approve trainer error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to approve trainer', variant: 'destructive' })
    }
  }

  // Reject a trainer
  const rejectTrainer = async (userId: string) => {
    try {
      await apiService.rejectTrainer(userId)
      setUsers(users.filter(u => u.user_id !== userId))
      setApprovals(approvals.filter(a => a.user_id !== userId))
      toast({ title: 'Success', description: 'Trainer rejected' })
    } catch (err: any) {
      console.error('Reject trainer error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to reject trainer', variant: 'destructive' })
    }
  }

  // Delete a user
  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    try {
      await apiService.deleteUser(userId)
      setUsers(users.filter(u => u.user_id !== userId))
      toast({ title: 'Success', description: 'User deleted' })
    } catch (err: any) {
      console.error('Delete user error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to delete user', variant: 'destructive' })
    }
  }

  // Update user type
  const updateUserType = async (userId: string, newType: string) => {
    try {
      await apiService.updateUserType(userId, newType)
      setUsers(users.map(u => u.user_id === userId ? { ...u, user_type: newType } : u))
      toast({ title: 'Success', description: 'User type updated' })
    } catch (err: any) {
      console.error('Update user type error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update user type', variant: 'destructive' })
    }
  }

  // SMTP & MPesa settings (admin)
  const [smtp, setSmtp] = useState<{ host: string; port: string | number; user?: string; pass?: string; from?: string }>({ host:'', port:'', user:'', pass:'', from:'' })
  const [mpesa, setMpesa] = useState<MpesaSettings>(defaultMpesaSettings)

  // M-Pesa STK Push test form state
  const [testStkPhone, setTestStkPhone] = useState('254722241745')
  const [testStkAmount, setTestStkAmount] = useState('5')
  const [testStkLoading, setTestStkLoading] = useState(false)
  const [testStkResult, setTestStkResult] = useState<any>(null)

  // Function to initiate STK push test
  const handleTestStkPush = async () => {
    if (!testStkPhone.trim()) {
      toast({ title: 'Error', description: 'Please enter a phone number', variant: 'destructive' })
      return
    }
    if (!testStkAmount.trim() || isNaN(Number(testStkAmount)) || Number(testStkAmount) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    if (!mpesa.consumerKey || !mpesa.consumerSecret || !mpesa.shortcode || !mpesa.passkey) {
      toast({ title: 'Error', description: 'M-Pesa credentials are not configured. Please configure them first.', variant: 'destructive' })
      return
    }

    setTestStkLoading(true)
    setTestStkResult(null)

    try {
      const response = await fetch('https://trainer.skatryk.co.ke/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stk_push_initiate',
          phone: testStkPhone,
          amount: Number(testStkAmount),
          account_reference: 'AdminTest',
        }),
      })

      let responseText = ''
      try {
        responseText = await response.text()
      } catch (err) {
        throw new Error('Failed to read response body')
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (err) {
        console.error('Failed to parse JSON:', responseText.substring(0, 500))
        throw new Error('Server returned invalid response')
      }

      if (result.status === 'error') {
        setTestStkResult({ success: false, error: result.message })
        toast({ title: 'Error', description: result.message, variant: 'destructive' })
        return
      }

      setTestStkResult({ success: true, data: result.data })
      toast({ title: 'Success', description: 'STK Push initiated successfully' })
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to initiate STK Push'
      setTestStkResult({ success: false, error: errorMessage })
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
    } finally {
      setTestStkLoading(false)
    }
  }

  useEffect(() => {
    const loadAdmin = async () => {
      try {
        // Load users with profiles from API
        const usersData = await apiService.getUsers()
        if (usersData?.data) {
          setUsers(usersData.data)

          // Calculate stats from users
          const allUsers = usersData.data
          const trainers = allUsers.filter((u: any) => u.user_type === 'trainer')
          const clients = allUsers.filter((u: any) => u.user_type === 'client')
          const admins = allUsers.filter((u: any) => u.user_type === 'admin')
          const approvedTrainers = trainers.filter((u: any) => u.is_approved)
          const pendingTrainers = trainers.filter((u: any) => !u.is_approved)

          setApprovals(pendingTrainers)
          setStats({
            totalUsers: allUsers.length,
            totalTrainers: trainers.length,
            totalClients: clients.length,
            totalAdmins: admins.length,
            totalBookings: 0,
            totalRevenue: 0,
            pendingApprovals: pendingTrainers.length,
            activeDisputes: 0
          })
        }

        // Load categories
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setCategories(categoriesData.data)
        }

        // Load issues (reported_issues) from database
        try {
          const result = await apiService.getIssues()
          if (result?.data) {
            setIssues(result.data)
            const openIssuesCount = result.data.filter((it: any) => String(it.status || 'open').toLowerCase() !== 'resolved').length
            setStats(prev => ({ ...prev, activeDisputes: openIssuesCount }))
          }
        } catch (err) {
          console.warn('Failed to load issues', err)
        }

        // Set other data to empty for now (can be extended with actual API calls)
        setPromotions([])
        setPayoutRequests([])
        setActivityFeed([])
      } catch (err) {
        console.warn('Failed to load admin data', err)
      }
    }
    loadAdmin()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      // Force navigation to the root/login to reflect signed-out state
      window.location.href = '/'
    } catch (err) {
      // ignore errors during sign out
    }
  }

  const approvePromotion = async (id: number) => {
    toast({ title: 'Feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
  }

  const rejectPromotion = async (id: number) => {
    toast({ title: 'Feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
  }

  const addCategory = async () => {
    if (!catForm.name.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' })
      return
    }

    setCatLoading(true)
    try {
      const result = await apiService.addCategory(catForm.name, catForm.icon, catForm.description)
      const categoryId = result?.id || Date.now()
      setCategories([...categories, { id: categoryId, ...catForm, created_at: new Date().toISOString() }])
      setCatForm({ name: '', icon: '', description: '' })
      toast({ title: 'Success', description: 'Category added' })
    } catch (err: any) {
      console.error('Add category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to add category', variant: 'destructive' })
    } finally {
      setCatLoading(false)
    }
  }

  const updateCategory = async (id: any, patch: any) => {
    try {
      await apiService.updateCategory(id, patch)
      toast({ title: 'Success', description: 'Category updated' })
    } catch (err: any) {
      console.error('Update category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to update category', variant: 'destructive' })
    }
  }

  const [activeIssue, setActiveIssue] = useState<any | null>(null)

  const viewIssue = (it: any) => setActiveIssue(it)

  const markIssueResolved = async (it: any) => {
    if (!it?.id) {
      toast({ title: 'Error', description: 'Invalid issue', variant: 'destructive' })
      return
    }
    try {
      await apiService.updateIssueStatus(it.id, 'resolved')
      setIssues(issues.map(iss => iss.id === it.id ? { ...iss, status: 'resolved' } : iss))
      setActiveIssue(null)
      toast({ title: 'Success', description: 'Issue marked as resolved' })
    } catch (err: any) {
      console.error('Mark issue resolved error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to resolve issue', variant: 'destructive' })
    }
  }

  const deleteCategory = async (id: any) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return

    try {
      await apiService.deleteCategory(id)
      setCategories(categories.filter(c => c.id !== id))
      toast({ title: 'Success', description: 'Category deleted' })
    } catch (err: any) {
      console.error('Delete category error:', err)
      toast({ title: 'Error', description: err?.message || 'Failed to delete category', variant: 'destructive' })
    }
  }

  const processPayout = async (id: number) => {
    toast({ title: 'Feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
  }

  const renderIssues = () => {
    const totalIssues = issues.length
    const openIssues = issues.filter((it: any) => String(it.status || 'pending').toLowerCase() !== 'resolved').length

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reported Issues</h1>
            <p className="text-sm text-muted-foreground">Review, investigate, and resolve client or trainer complaints.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{totalIssues} total</Badge>
            <Badge variant={openIssues ? 'destructive' : 'secondary'}>{openIssues} open</Badge>
          </div>
        </div>

        {totalIssues === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-14 w-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-2xl">✓</div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">No issues reported</h3>
                <p className="text-sm text-muted-foreground">You&apos;re all caught up. New reports will appear here instantly.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {issues.map((it: any) => {
              const status = String(it.status || 'pending').toLowerCase()
              const resolved = status === 'resolved'
              return (
                <Card key={it.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">{it.complaint_type || 'Issue'}</h3>
                          <Badge variant={resolved ? 'secondary' : status === 'investigating' ? 'outline' : 'destructive'} className="capitalize">{status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{it.description || 'No description provided.'}</p>
                        <p className="text-xs text-muted-foreground">Reported by {it.user_name || it.user_email || it.user_id || 'Unknown user'} on {it.created_at ? new Date(it.created_at).toLocaleString() : 'unknown date'}</p>
                        {(it.booking_reference || it.booking_id) && (
                          <p className="text-xs text-muted-foreground">Booking reference: {it.booking_reference || it.booking_id}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <Button size="sm" variant="outline" onClick={() => viewIssue(it)}>
                          View details
                        </Button>
                        <Button size="sm" disabled={resolved} onClick={() => markIssueResolved(it)}>
                          {resolved ? 'Resolved' : 'Mark resolved'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderPromotions = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Promotion Requests</h1>
        <Badge variant="secondary">{promotions.length}</Badge>
      </div>

      <div className="space-y-4">
        {promotions.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No promotion requests.</CardContent>
          </Card>
        ) : promotions.map((p) => {
          const trainer = users.find((u:any) => u.user_id === (p.trainer_id || p.trainer_user_id || p.trainer))
          const trainerLabel = trainer?.full_name || trainer?.user_id || p.trainer_id || p.trainer_user_id || 'Unknown'
          const commissionRaw = (p.commission_rate ?? p.requested_commission)
          const commissionText = (commissionRaw === null || commissionRaw === undefined || Number.isNaN(Number(commissionRaw))) ? '���' : `${Number(commissionRaw).toFixed(0)}%`
          const createdAt = p.created_at ? new Date(p.created_at).toLocaleString() : ''
          return (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Trainer: {trainerLabel}</h3>
                    <p className="text-sm text-muted-foreground">Commission requested: {commissionText}</p>
                    <p className="text-sm text-muted-foreground">Status: {p.status || 'pending'} {createdAt ? `• ${createdAt}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approvePromotion(p.id)} disabled={p.status === 'approved'}>{p.status === 'approved' ? 'Approved' : 'Approve'}</Button>
                    <Button variant="outline" size="sm" className="border-destructive text-destructive" onClick={() => rejectPromotion(p.id)} disabled={p.status === 'rejected'}>{p.status === 'rejected' ? 'Rejected' : 'Reject'}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <Badge variant="secondary">{categories.length}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Add / Update Category</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={catForm.name} onChange={(e)=>setCatForm({...catForm, name:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Icon (emoji or char)</Label>
            <Input value={catForm.icon} onChange={(e)=>setCatForm({...catForm, icon:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Input value={catForm.description} onChange={(e)=>setCatForm({...catForm, description:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-4">
            <Button onClick={addCategory} disabled={catLoading}>
              <Plus className="h-4 w-4 mr-2"/> Save Category
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {categories.map((c)=> (
          <Card key={c.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg">{c.icon || '🏷️'}</div>
                  <Input value={c.name || ''} onChange={(e)=>setCategories(cs=>cs.map(x=>x.id===c.id?{...x,name:e.target.value}:x))} className="bg-input border-border" />
                </div>
                <Input value={c.description || ''} onChange={(e)=>setCategories(cs=>cs.map(x=>x.id===c.id?{...x,description:e.target.value}:x))} className="bg-input border-border" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={()=>updateCategory(c.id,{ name:c.name, description:c.description })}>
                    <Save className="h-4 w-4 mr-1"/> Save
                  </Button>
                  <Button size="sm" variant="outline" className="border-destructive text-destructive" onClick={()=>deleteCategory(c.id)}>
                    <Trash2 className="h-4 w-4 mr-1"/> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderPayouts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Payout Requests</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{payoutsFiltered.length}</Badge>
          <Select value={payoutStatusFilter} onValueChange={(v)=>setPayoutStatusFilter(v as any)}>
            <SelectTrigger className="w-40 bg-input border-border"><SelectValue placeholder="All statuses"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border" onClick={()=>{
            const rows = payoutsFiltered.map((p:any)=>({ id:p.id, trainer_id: p.trainer_id || p.trainer_user_id || p.trainer, amount: Number(p.amount)||0, status: p.status || 'requested', requested_at: p.requested_at || p.created_at || '', paid_at: p.paid_at || '' }))
            exportCSV('payouts.csv', rows)
          }}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total (filtered)</span><span className="font-semibold text-foreground">{formatKes(payoutStats.total)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Paid</span><span className="font-semibold text-foreground">{formatKes(payoutStats.paid)}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Pending</span><span className="font-semibold text-foreground">{formatKes(payoutStats.pending)}</span></div>
          </CardContent>
        </Card>
        {payoutsFiltered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No payout requests.</CardContent>
          </Card>
        ) : payoutsFiltered.map((p) => {
          const trainer = users.find((u:any) => u.user_id === (p.trainer_id || p.trainer_user_id || p.trainer))
          const trainerLabel = trainer?.full_name || trainer?.user_id || p.trainer_id || p.trainer_user_id || 'Unknown'
          const requestedAt = p.requested_at || p.created_at || ''
          return (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Trainer: {trainerLabel}</h3>
                    <p className="text-sm text-muted-foreground">Amount: {formatKes(Number(p.amount)||0)}</p>
                    <p className="text-sm text-muted-foreground">Status: {p.status || 'requested'} {requestedAt ? `• ${new Date(requestedAt).toLocaleString()}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => processPayout(p.id)} disabled={String(p.status || '').toLowerCase() === 'paid'}>{String(p.status || '').toLowerCase() === 'paid' ? 'Paid' : 'Mark Paid'}</Button>
                    <Button size="sm" variant="outline" disabled title="Admin API not configured">Send MPesa</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )

  const renderDisputes = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Dispute Management</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search cases, users…" value={query} onChange={(e)=>setQuery(e.target.value)} className="w-52 bg-input border-border" />
          <Select value={statusFilter} onValueChange={(v)=>setStatusFilter(v as any)}>
            <SelectTrigger className="w-40 bg-input border-border"><SelectValue placeholder="All statuses"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border" onClick={()=>{
            const blob = new Blob([toCSV(filtered)], {type:'text/csv;charset=utf-8;'})
            const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='disputes.csv'; a.click(); URL.revokeObjectURL(url)
          }}>
            <Download className="h-4 w-4 mr-2"/> Export
          </Button>
          <Badge variant="destructive">{filtered.filter(d=>d.status!=='resolved').length} active</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">No disputes found.</CardContent>
          </Card>
        ) : filtered.map((dispute) => (
          <Card key={dispute.id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Case {dispute.case}</h3>
                  <p className="text-muted-foreground">{dispute.issue}</p>
                  <p className="text-sm text-muted-foreground mt-1">Submitted {dispute.submittedAt}</p>
                </div>
                <Badge variant={dispute.status === 'pending' ? 'destructive' : dispute.status==='resolved' ? 'secondary' : 'outline'}>
                  {dispute.status}{dispute.refunded ? ' • refunded' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Client</p>
                  <p className="text-sm text-muted-foreground">{dispute.client}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Trainer</p>
                  <p className="text-sm text-muted-foreground">{dispute.trainer}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Amount</p>
                  <p className="text-sm text-muted-foreground">Ksh {dispute.amount}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="flex-1 min-w-[140px]" onClick={()=>setActiveDispute(dispute)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button variant="outline" size="sm" onClick={()=>refund(dispute.id)} disabled={dispute.refunded || dispute.status==='resolved'}>
                  Refund Client
                </Button>
                <Button size="sm" className="bg-gradient-primary text-white" onClick={()=>resolve(dispute.id)} disabled={dispute.status==='resolved'}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve Case
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeDispute && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setActiveDispute(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-card" onClick={(e)=>e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Case {activeDispute.case}</h3>
              <button className="text-sm text-muted-foreground" onClick={()=>setActiveDispute(null)}>Close</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">{activeDispute.issue}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground">{activeDispute.client}</span></div>
                <div><span className="text-muted-foreground">Trainer:</span> <span className="text-foreground">{activeDispute.trainer}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground">Ksh {activeDispute.amount}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> <span className="text-foreground">{activeDispute.submittedAt}</span></div>
              </div>
              <div>
                <Label htmlFor="notes">Internal notes</Label>
                <Input id="notes" value={activeDispute.notes || ''} onChange={(e)=>setActiveDispute({...activeDispute, notes:e.target.value})} className="bg-input border-border" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={async ()=>{
                  if(activeDispute){
                    try {
                      await apiService.updateData('reported_issues', { resolution: activeDispute.notes }, `id = '${activeDispute.id}'`)
                      setIssues(iss => iss.map(i => i.id === activeDispute.id ? { ...i, resolution: activeDispute.notes } : i))
                      setActiveDispute(null)
                      toast({ title: 'Success', description: 'Notes saved' })
                    } catch (err: any) {
                      console.error('Save error:', err)
                      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
                    }
                  }
                }}>Save</Button>
                <Button onClick={()=>{ if(activeDispute){ resolve(activeDispute.id); setActiveDispute(null);} }} className="bg-gradient-primary text-white">Mark Resolved</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeIssue && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setActiveIssue(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-card" onClick={(e)=>e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Issue {activeIssue.id}</h3>
              <button className="text-sm text-muted-foreground" onClick={()=>setActiveIssue(null)}>Close</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Type: {activeIssue.complaint_type}</p>
              <p className="text-sm text-muted-foreground">Description: {activeIssue.description}</p>
              <p className="text-sm text-muted-foreground">Booking ref: {activeIssue.booking_reference || '���'}</p>
              <div className="grid grid-cols-1 gap-2">
                {(activeIssue.attachments || []).map((a:any,i:number)=>(
                  <a key={i} href={a} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Attachment {i+1}</a>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={()=>{ setActiveIssue(null) }}>Close</Button>
                <Button onClick={()=>{ markIssueResolved(activeIssue); setActiveIssue(null) }} className="bg-gradient-primary text-white">Mark Resolved</Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )

  const exportCSV = (filename: string, rows: Record<string, any>[]) => {
    const headers = Object.keys(rows[0] || { month: 'Month', revenue: 0 })
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
        <div className="flex items-center gap-2">
          <Button variant={range==='30d'?'default':'outline'} size="sm" onClick={() => setRange('30d')}>30d</Button>
          <Button variant={range==='90d'?'default':'outline'} size="sm" onClick={() => setRange('90d')}>90d</Button>
          <Button variant={range==='12m'?'default':'outline'} size="sm" onClick={() => setRange('12m')}>12m</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-card border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue & AOV
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ left: 12, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="aov" stroke="#16a34a" strokeWidth={2} dot={false} name="AOV" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">User Composition</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={userComposition} dataKey="value" nameKey="name" outerRadius={90} label>
                  {userComposition.map((_, i) => <Cell key={i} fill={i===0?'#6366f1':'#f59e0b'} />)}
                </Pie>
                <Legend />
                <ReTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-card border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">{range === '12m' ? 'Monthly Bookings' : 'Daily Bookings'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries} margin={{ left: 12, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="bookings" fill="#10b981" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Total Revenue (period)</span><span className="font-semibold text-foreground">{formatKes(kpiSummary.totalRevenue)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Total Bookings</span><span className="font-semibold text-foreground">{kpiSummary.totalBookings}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">Avg AOV</span><span className="font-semibold text-foreground">{formatKes(kpiSummary.averageAov)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Generate Reports</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('monthly_revenue.csv', revenueSeries)}>
            <BarChart3 className="h-4 w-4 mr-2" /> Monthly Revenue
          </Button>
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('monthly_bookings.csv', revenueSeries.map(r=>({ month:r.month, bookings:r.bookings })))}>
            <Calendar className="h-4 w-4 mr-2" /> Bookings
          </Button>
          <Button variant="outline" className="justify-start border-border" onClick={() => exportCSV('user_composition.csv', userComposition.map(u=>({ name:u.name, value:u.value })))}>
            <Users className="h-4 w-4 mr-2" /> Users Breakdown
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Badge variant="secondary">{users.length}</Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Approved</th>
                  <th className="p-2">Joined</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.full_name || u.user_id}</td>
                    <td className="p-2">{u.email || u.phone_number || '-'}</td>
                    <td className="p-2">
                      <Select value={u.user_type || 'client'} onValueChange={(v)=>{
                        updateUserType(u.user_id, v)
                      }}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">{approvedOf(u) ? 'Yes' : 'No'}</td>
                    <td className="p-2">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => deleteUser(u.user_id)}>Delete</Button>

                        {/* Approve trainer (if applicable) */}
                        {String(u.user_type || '').toLowerCase() === 'trainer' && !approvedOf(u) && (
                          <Button size="sm" variant="outline" onClick={() => approveTrainer(u.user_id)}>Approve</Button>
                        )}

                        <Button size="sm" variant="ghost" disabled title="Admin API not configured">Reset PW</Button>
                        <Button size="sm" variant="outline" disabled title="Admin API not configured">{u.is_suspended? 'Reinstate' : 'Suspend'}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="mt-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-sm text-muted-foreground">No users found. Add users via Supabase or check the admin API.</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">System Settings</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Admin Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/admin/reset-passwords')}
              variant="outline"
              className="justify-start border-border h-auto py-4"
            >
              <Key className="h-5 w-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold text-foreground">Reset All Passwords</p>
                <p className="text-xs text-muted-foreground">Reset test user passwords to a new value</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="platformName">Platform Name</Label>
              <Input id="platformName" value={settings.platformName}
                onChange={(e) => update({ platformName: e.target.value })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input id="supportEmail" type="email" value={settings.supportEmail}
                onChange={(e) => update({ supportEmail: e.target.value })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update({ currency: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => update({ timezone: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="commission">Platform Commission (%)</Label>
              <Input id="commission" type="number" min={0} max={100} value={settings.commissionRate}
                onChange={(e) => update({ commissionRate: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax/VAT (%)</Label>
              <Input id="taxRate" type="number" min={0} max={100} value={settings.taxRate}
                onChange={(e) => update({ taxRate: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label>Payout Schedule</Label>
              <Select value={settings.payoutSchedule} onValueChange={(v) => update({ payoutSchedule: v as any })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Theme toggle for admins */}
          <div className="mt-4">
            <Label>Theme</Label>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-muted-foreground">Toggle site theme (Light / Dark)</p>
              <div className="ml-auto">
                <ThemeToggleAdmin />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target</Label>
            <Select value={announcementTarget} onValueChange={(v)=>setAnnouncementTarget(v as any)}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="clients">Clients</SelectItem>
                <SelectItem value="trainers">Trainers</SelectItem>
                <SelectItem value="admins">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={announcementTitle} onChange={(e)=>setAnnouncementTitle(e.target.value)} className="bg-input border-border" />
          </div>
          <div>
            <Label>Message</Label>
            <textarea value={announcementBody} onChange={(e)=>setAnnouncementBody(e.target.value)} className="w-full p-2 border border-border rounded-md bg-input" rows={4} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={()=>{ setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementTarget('all') }}>Clear</Button>
            <Button onClick={sendAnnouncement} disabled={sendingAnnouncement}>{sendingAnnouncement ? 'Sending…' : 'Send Announcement'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Booking Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cancelHrs">Cancellation window (hours)</Label>
              <Input id="cancelHrs" type="number" min={0} value={settings.cancellationHours}
                onChange={(e) => update({ cancellationHours: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="reschedHrs">Reschedule window (hours)</Label>
              <Input id="reschedHrs" type="number" min={0} value={settings.rescheduleHours}
                onChange={(e) => update({ rescheduleHours: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="maxDaily">Max sessions per trainer/day</Label>
              <Input id="maxDaily" type="number" min={1} value={settings.maxDailySessionsPerTrainer}
                onChange={(e) => update({ maxDailySessionsPerTrainer: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">SMTP Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Host</Label>
            <Input value={smtp.host} onChange={(e)=>setSmtp({...smtp, host:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Port</Label>
            <Input type="number" value={smtp.port as any} onChange={(e)=>setSmtp({...smtp, port:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>User</Label>
            <Input value={smtp.user || ''} onChange={(e)=>setSmtp({...smtp, user:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={smtp.pass || ''} onChange={(e)=>setSmtp({...smtp, pass:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>From</Label>
            <Input value={smtp.from || ''} onChange={(e)=>setSmtp({...smtp, from:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="outline" onClick={async ()=>{
              toast({ title: 'Feature unavailable', description: 'Supabase dependency removed', variant: 'destructive' })
            }}>Save SMTP</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">MPesa Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Environment</Label>
            <Select value={mpesa.environment} onValueChange={(v)=>setMpesa({...mpesa, environment:v})}>
              <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Consumer Key</Label>
            <Input value={mpesa.consumerKey} onChange={(e)=>setMpesa({...mpesa, consumerKey:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Consumer Secret</Label>
            <Input type="password" value={mpesa.consumerSecret} onChange={(e)=>setMpesa({...mpesa, consumerSecret:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Passkey</Label>
            <Input type="password" value={mpesa.passkey} onChange={(e)=>setMpesa({...mpesa, passkey:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Initiator Name</Label>
            <Input value={mpesa.initiatorName} onChange={(e)=>setMpesa({...mpesa, initiatorName:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Security Credential</Label>
            <Input type="password" value={mpesa.securityCredential} onChange={(e)=>setMpesa({...mpesa, securityCredential:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Shortcode</Label>
            <Input value={mpesa.shortcode} onChange={(e)=>setMpesa({...mpesa, shortcode:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Result URL</Label>
            <Input value={mpesa.resultUrl} onChange={(e)=>setMpesa({...mpesa, resultUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div>
            <Label>Queue Timeout URL</Label>
            <Input value={mpesa.queueTimeoutUrl} onChange={(e)=>setMpesa({...mpesa, queueTimeoutUrl:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>Command ID</Label>
            <Input value={mpesa.commandId} onChange={(e)=>setMpesa({...mpesa, commandId:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Label>Transaction Type</Label>
            <Input value={mpesa.transactionType} onChange={(e)=>setMpesa({...mpesa, transactionType:e.target.value})} className="bg-input border-border" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={async ()=>{
              setMpesa(settings.mpesa || defaultMpesaSettings)
            }}>Reset</Button>
            <Button onClick={async ()=>{
              setSaving(true)
              try {
                const updated = { ...settings, mpesa }
                setSettings(updated)
                saveSettings(updated)
                await saveSettingsToDb(updated)
                toast({ title: 'Success', description: 'M-Pesa settings saved successfully' })
              } catch (err: any) {
                toast({ title: 'Error', description: err?.message || 'Failed to save settings', variant: 'destructive' })
              } finally {
                setSaving(false)
              }
            }} disabled={saving}>Save M-Pesa Settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">M-Pesa STK Push Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Test M-Pesa STK Push payment initiation. This will send a prompt to the specified phone number. <span className="font-medium">Minimum amount: 5 KES</span></p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="testPhone">Phone Number</Label>
              <Input
                id="testPhone"
                placeholder="254722241745"
                value={testStkPhone}
                onChange={(e) => setTestStkPhone(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label htmlFor="testAmount">Amount (KES)</Label>
              <Input
                id="testAmount"
                type="number"
                placeholder="5"
                value={testStkAmount}
                onChange={(e) => setTestStkAmount(e.target.value)}
                className="bg-input border-border"
                min="5"
                max="150000"
                step="1"
              />
            </div>
          </div>

          <Button
            onClick={handleTestStkPush}
            disabled={testStkLoading}
            className="w-full"
          >
            {testStkLoading ? 'Initiating...' : 'Send STK Push'}
          </Button>

          {testStkResult && (
            <div className={`p-4 rounded-md border ${testStkResult.success ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
              <p className={`font-semibold mb-2 ${testStkResult.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                {testStkResult.success ? '✓ Success' : '✗ Error'}
              </p>
              {testStkResult.success ? (
                <div className="text-sm text-green-800 dark:text-green-200 space-y-2">
                  <p><strong>Phone:</strong> {testStkPhone}</p>
                  <p><strong>Amount:</strong> KES {testStkAmount}</p>
                  <p><strong>Checkout Request ID:</strong> {testStkResult.data?.checkout_request_id || 'N/A'}</p>
                  <p><strong>Merchant Request ID:</strong> {testStkResult.data?.merchant_request_id || 'N/A'}</p>
                  <p><strong>Response Code:</strong> {testStkResult.data?.response_code || 'N/A'}</p>
                  {testStkResult.data?.response_description && (
                    <p><strong>Description:</strong> {testStkResult.data.response_description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-800 dark:text-red-200">{testStkResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable Referral Program</p>
              <p className="text-sm text-muted-foreground">Allow discounts and commission benefits</p>
            </div>
            <Switch checked={settings.enableReferralProgram} onCheckedChange={(v) => update({ enableReferralProgram: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Send system emails to users</p>
            </div>
            <Switch checked={settings.emailNotifications} onCheckedChange={(v) => update({ emailNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">Show maintenance banner and restrict actions</p>
            </div>
            <Switch checked={settings.maintenanceMode} onCheckedChange={(v) => update({ maintenanceMode: v })} />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Referral Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientDiscount">Client Discount (%)</Label>
              <Input id="clientDiscount" type="number" min={0} max={100} value={settings.referralClientDiscount}
                onChange={(e) => update({ referralClientDiscount: Number(e.target.value) })}
                className="bg-input border-border" />
              <Label htmlFor="clientBookings" className="mt-3 block">Client Discount Lasts (bookings)</Label>
              <Input id="clientBookings" type="number" min={1} value={settings.referralClientBookings}
                onChange={(e) => update({ referralClientBookings: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="trainerDiscount">Trainer Commission Discount (%)</Label>
              <Input id="trainerDiscount" type="number" min={0} max={100} value={settings.referralTrainerDiscount}
                onChange={(e) => update({ referralTrainerDiscount: Number(e.target.value) })}
                className="bg-input border-border" />
              <Label htmlFor="trainerBookings" className="mt-3 block">Trainer Discount Lasts (bookings)</Label>
              <Input id="trainerBookings" type="number" min={1} value={settings.referralTrainerBookings}
                onChange={(e) => update({ referralTrainerBookings: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="referrerPct">Affiliate: Referrer Award (%)</Label>
              <Input id="referrerPct" type="number" min={0} max={100} value={settings.referralReferrerPercent}
                onChange={(e)=>update({ referralReferrerPercent: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
            <div>
              <Label htmlFor="referredPct">Affiliate: Referred Award (%)</Label>
              <Input id="referredPct" type="number" min={0} max={100} value={settings.referralReferredPercent}
                onChange={(e)=>update({ referralReferredPercent: Number(e.target.value) })}
                className="bg-input border-border" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Require referral code on first booking</p>
              <p className="text-sm text-muted-foreground">Show a prompt to enter a referral code on the first booking.</p>
            </div>
            <Switch checked={settings.promptReferralOnFirstBooking} onCheckedChange={(v)=>update({ promptReferralOnFirstBooking: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Apply referral discount immediately</p>
              <p className="text-sm text-muted-foreground">If a valid code is provided, discount is applied to the current booking.</p>
            </div>
            <Switch checked={settings.applyReferralDiscountImmediately} onCheckedChange={(v)=>update({ applyReferralDiscountImmediately: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Use referrer's phone number as referral code</p>
              <p className="text-sm text-muted-foreground">When enabled, the referrer's primary phone number will be used as the referral code.</p>
            </div>
            <Switch checked={settings.useReferrerPhoneAsCode} onCheckedChange={(v) => update({ useReferrerPhoneAsCode: v })} />
          </div>

          <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Platform Charges</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="chargeTrainer">Charge Trainer (%)</Label>
            <Input id="chargeTrainer" type="number" min={0} max={100} value={settings.platformChargeTrainerPercent}
              onChange={(e)=>update({ platformChargeTrainerPercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="chargeClient">Charge Client (%)</Label>
            <Input id="chargeClient" type="number" min={0} max={100} value={settings.platformChargeClientPercent}
              onChange={(e)=>update({ platformChargeClientPercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="compPct">Compensation Fee (%)</Label>
            <Input id="compPct" type="number" min={0} max={100} value={settings.compensationFeePercent}
              onChange={(e)=>update({ compensationFeePercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div>
            <Label htmlFor="maintPct">Maintenance Fee (%)</Label>
            <Input id="maintPct" type="number" min={0} max={100} value={settings.maintenanceFeePercent}
              onChange={(e)=>update({ maintenanceFeePercent: Number(e.target.value) })}
              className="bg-input border-border" />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm" className="border-border">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="pt-6">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar */}
            <AdminSidebar value={activeTab} onChange={setActiveTab} onSignOut={handleSignOut} />

            {/* Main content area */}
            <main className="flex-1">
              <div className="hidden md:block mb-4">
                {/* Desktop horizontal nav fallback (optional) */}
              </div>

              <div className="space-y-6">
                <TabsContent value="overview">{renderOverview()}</TabsContent>
                <TabsContent value="approvals">{renderApprovals()}</TabsContent>
                <TabsContent value="users">{renderUsers()}</TabsContent>
                <TabsContent value="disputes">{renderDisputes()}</TabsContent>
                <TabsContent value="issues">{renderIssues()}</TabsContent>
                <TabsContent value="analytics">{renderAnalytics()}</TabsContent>
                <TabsContent value="promotions">{renderPromotions()}</TabsContent>
                <TabsContent value="payouts">{renderPayouts()}</TabsContent>
                <TabsContent value="categories">{renderCategories()}</TabsContent>
                <TabsContent value="settings">{renderSettings()}</TabsContent>
              </div>
            </main>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
