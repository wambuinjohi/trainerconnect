import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface WaitlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WaitlistDialog: React.FC<WaitlistDialogProps> = ({ open, onOpenChange }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    isCoach: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isCoach: checked,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Add your API call here
      console.log('Waitlist submission:', formData)
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        telephone: '',
        isCoach: false,
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting waitlist form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-center">TRAINER</h2>
            <p className="text-sm text-muted-foreground text-center">
              Launching April 2026 in Nairobi.
            </p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Your full name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="border-input"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="border-input"
            />
          </div>

          {/* Telephone Input */}
          <div className="space-y-2">
            <Label htmlFor="telephone" className="text-foreground">
              Telephone
            </Label>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              placeholder="+254 XX XXX XXXX"
              value={formData.telephone}
              onChange={handleInputChange}
              required
              className="border-input"
            />
          </div>

          {/* Coach Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <Checkbox
              id="isCoach"
              checked={formData.isCoach}
              onCheckedChange={handleCheckboxChange}
            />
            <Label htmlFor="isCoach" className="text-foreground font-normal cursor-pointer">
              I am a coach
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-trainer-primary hover:bg-trainer-primary/90 text-white font-semibold py-2"
          >
            {isSubmitting ? 'Joining...' : 'JOIN THE WAITLIST'}
          </Button>

          {/* Footer Text */}
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">@trainerapp.ke</p>
            <p className="text-xs text-muted-foreground pt-4">YOUR GROWTH, YOUR CHOICE.</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WaitlistDialog
