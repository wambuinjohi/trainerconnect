import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { Star, MapPin } from 'lucide-react'
import Header from '@/components/Header'
import * as apiService from '@/lib/api-service'

interface Trainer {
  user_id: string
  full_name: string
  hourly_rate: number
  location_label: string
  is_available: boolean
  rating: number
  categoryIds?: number[]
}

// Trainer card component
const TrainerRow: React.FC<{ t: Trainer, categories: any[] }> = ({ t, categories }) => {
  const categoryNames = t.categoryIds
    ? t.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean)
    : []

  return (
    <Card className="mb-3">
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="font-semibold text-foreground">{t.full_name || 'Trainer'}</div>
            {categoryNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {categoryNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {t.location_label || 'Unknown'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Ksh {t.hourly_rate ?? '—'}/hr</div>
            {t.rating && (
              <div className="flex items-center gap-1 mt-1 justify-end text-sm">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>{t.rating}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-2">{t.is_available ? 'Available' : 'Offline'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Explore page
const Explore: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories first
        const categoriesData = await apiService.getCategories()
        if (categoriesData?.data) {
          setCategories(categoriesData.data)
        }

        // Fetch available trainers
        const trainersData = await apiService.getAvailableTrainers()
        if (trainersData?.data) {
          // Fetch categories for each trainer
          const trainersWithCategories = await Promise.all(
            trainersData.data.map(async (trainer: Trainer) => {
              try {
                const categoriesData = await apiService.getTrainerCategories(trainer.user_id)
                const categoryIds = categoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []
                return { ...trainer, categoryIds }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id)
                return { ...trainer, categoryIds: [] }
              }
            })
          )
          setTrainers(trainersWithCategories)
        }
      } catch (err) {
        console.error('Failed to load explore data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="p-4">
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
                <Card><CardContent className="p-4">No trainers found. Try again later.</CardContent></Card>
              ) : (
                trainers.map((t) => <TrainerRow key={t.user_id} t={t} categories={categories} />)
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
    </div>
  )
}

export default Explore
