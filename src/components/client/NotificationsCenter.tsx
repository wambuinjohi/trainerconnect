import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiRequest, withAuth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export const NotificationsCenter: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    apiRequest('notifications_get', { user_id: userId }, { headers: withAuth() })
      .then((data: any) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.length === 0 && <div className="text-sm text-muted-foreground">No notifications</div>}
              {items.map((it, i) => (
                <div key={i} className="p-2 border border-border rounded-md bg-card">
                  <div className="font-semibold">{it.title || 'Notification'}</div>
                  <div className="text-sm text-muted-foreground">{it.body || it.message}</div>
                </div>
              ))}

              <div className="flex justify-end mt-2">
                <Button onClick={() => onClose?.()}>Close</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
