import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle, Send, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export const AdminPayoutManager: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [commissionPercent, setCommissionPercent] = useState(5)
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [b2cPayments, setB2cPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending')

  // Load payout requests
  useEffect(() => {
    loadRequests()
    loadB2CPayments()
  }, [activeTab])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const status = activeTab === 'pending' ? 'pending' : 'approved'
      const data = await apiRequest('payout_requests_get', { status }, { headers: withAuth() })

      if (data?.data) {
        setRequests(Array.isArray(data.data) ? data.data : [data.data])
      }
    } catch (err) {
      console.warn('Failed to load payout requests', err)
      toast({ title: 'Error', description: 'Failed to load payout requests', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const loadB2CPayments = async () => {
    try {
      const data = await apiRequest('b2c_payments_get', {}, { headers: withAuth() })
      if (data?.data) {
        setB2cPayments(Array.isArray(data.data) ? data.data : [data.data])
      }
    } catch (err) {
      console.warn('Failed to load B2C payments', err)
    }
  }

  const approveRequest = async (request: any) => {
    if (!request.id) {
      toast({ title: 'Error', description: 'Invalid request ID', variant: 'destructive' })
      return
    }

    setProcessingId(request.id)
    try {
      const data = await apiRequest('payout_request_approve', {
        payout_request_id: request.id,
        commission_percentage: commissionPercent
      }, { headers: withAuth() })

      if (data?.status === 'success') {
        toast({ title: 'Payout approved', description: `B2C payment created: ${data.data?.reference_id}` })
        loadRequests()
      } else {
        toast({ title: 'Error', description: data?.message || 'Failed to approve payout', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to approve payout', variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  const initiateB2CPayment = async (payment: any) => {
    if (!payment.id) {
      toast({ title: 'Error', description: 'Invalid payment ID', variant: 'destructive' })
      return
    }

    setProcessingId(payment.id)
    try {
      const data = await apiRequest('b2c_payment_initiate', {
        b2c_payment_id: payment.id,
        phone_number: payment.phone_number,
        amount: payment.amount
      }, { headers: withAuth() })

      if (data?.status === 'success') {
        toast({ title: 'B2C payment initiated', description: `Reference: ${data.data?.reference_id}` })
        loadB2CPayments()
      } else {
        toast({ title: 'Error', description: data?.message || 'Failed to initiate B2C payment', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to initiate B2C payment', variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'initiated': return 'bg-purple-100 text-purple-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Commission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commission Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="commission" className="whitespace-nowrap">Commission Percentage</Label>
            <Input
              id="commission"
              type="number"
              min="0"
              max="100"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This percentage will be deducted from payout requests
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pending')}
        >
          Pending Requests ({requests.filter(r => r.status === 'pending').length})
        </Button>
        <Button
          variant={activeTab === 'processed' ? 'default' : 'outline'}
          onClick={() => setActiveTab('processed')}
        >
          Approved Requests ({requests.filter(r => r.status === 'approved').length})
        </Button>
      </div>

      {/* Pending Payout Requests */}
      {activeTab === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Payout Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : requests.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No pending payout requests</p>
            ) : (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'pending').map((req) => (
                  <div key={req.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{req.full_name}</p>
                        <p className="text-sm text-muted-foreground">{req.phone}</p>
                        <p className="text-xs text-muted-foreground mt-1">{req.location_label}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl">Ksh {Number(req.amount).toFixed(2)}</p>
                        <Badge className="mt-1 bg-yellow-100 text-yellow-800">Pending</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-muted-foreground">Commission ({commissionPercent}%)</p>
                        <p className="font-semibold">Ksh {(Number(req.amount) * commissionPercent / 100).toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-muted-foreground">Net Payout</p>
                        <p className="font-semibold text-blue-600">Ksh {(Number(req.amount) * (100 - commissionPercent) / 100).toFixed(2)}</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => approveRequest(req)}
                      disabled={processingId === req.id}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {processingId === req.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve & Create B2C Payment
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approved Requests & B2C Payments */}
      {activeTab === 'processed' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Approved Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : requests.filter(r => r.status === 'approved').length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No approved requests</p>
              ) : (
                <div className="space-y-3">
                  {requests.filter(r => r.status === 'approved').map((req) => (
                    <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{req.full_name}</p>
                        <p className="text-sm">Ksh {Number(req.net_amount).toFixed(2)} (after commission)</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">Approved</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>B2C Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : b2cPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No B2C payments</p>
              ) : (
                <div className="space-y-3">
                  {b2cPayments.map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Ksh {Number(payment.amount).toFixed(2)}</p>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{payment.phone_number}</p>
                      <p className="text-xs text-muted-foreground">Ref: {payment.reference_id}</p>

                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => initiateB2CPayment(payment)}
                          disabled={processingId === payment.id}
                          className="w-full mt-2"
                        >
                          {processingId === payment.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Initiating...
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3 mr-1" />
                              Initiate M-Pesa B2C
                            </>
                          )}
                        </Button>
                      )}

                      {payment.transaction_id && (
                        <p className="text-xs text-green-600 mt-1">✓ Transaction ID: {payment.transaction_id}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
