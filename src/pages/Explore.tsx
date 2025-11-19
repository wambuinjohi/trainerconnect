import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

// Trainer card component
const TrainerRow: React.FC<{ t: any }> = ({ t }) => (
  <Card className="mb-3">
    <CardContent>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-foreground">{t.full_name || t.display_name || 'Trainer'}</div>
          <div className="text-sm text-muted-foreground">
            {t.disciplines ? (Array.isArray(t.disciplines) ? t.disciplines.join(', ') : t.disciplines) : (t.bio || '')}
          </div>
          <div className="text-sm text-muted-foreground mt-2">Location: {t.location_label || 'Unknown'}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">Ksh {t.hourly_rate ?? t.hourlyRate ?? '—'}/hr</div>
          <div className="text-xs text-muted-foreground mt-2">{t.is_available ? 'Available' : 'Offline'}</div>
        </div>
      </div>
    </CardContent>
  </Card>
)

// Main Explore page
const Explore: React.FC = () => {
  const [trainers, setTrainers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Mock data to replace Supabase
    const mockTrainers = [
      {
        id: 1,
        full_name: 'John Doe',
        disciplines: ['Yoga', 'Strength'],
        location_label: 'Nairobi',
        hourly_rate: 1200,
        is_available: true,
        bio: 'Certified personal trainer with 5 years experience'
      },
      {
        id: 2,
        full_name: 'Jane Smith',
        disciplines: ['Pilates', 'Cardio'],
        location_label: 'Mombasa',
        hourly_rate: 1000,
        is_available: false,
        bio: 'Specializes in functional training and wellness'
      }
    ]

    setTimeout(() => {
      if (mounted) {
        setTrainers(mockTrainers)
        setLoading(false)
      }
    }, 500) // simulate loading

    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Explore Trainers</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Browse trainers nearby, view profiles, and book sessions. Sign in to see more details and to make bookings.
        </p>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading trainers…</div>
        ) : (
          <div>
            {trainers.length === 0 ? (
              <Card><CardContent>No trainers found. Try again later.</CardContent></Card>
            ) : (
              trainers.map((t:any) => <TrainerRow key={t.id || Math.random()} t={t} />)
            )}
          </div>
        )}

        <div className="mt-4">
          <Link to="/signin">
            <Button>Sign in to book</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Explore
