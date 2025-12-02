import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const Privacy: React.FC = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="container max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-4">This policy explains how TrainerCoachConnect collects, uses and stores your personal information.</p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Information we collect</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Account information: email, name, phone number.</li>
            <li>Profile details: location, bio, disciplines and service area for trainers.</li>
            <li>Transactional information: bookings, payments and receipts.</li>
            <li>Usage information: device and app usage data to improve the service.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>How we use data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">We use your data to enable core functionality: creating accounts, finding trainers near you, processing bookings and payments, and sending notifications about your sessions. We may also use anonymized data for analytics and improvement.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Your choices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You can edit your profile and location in the app. To request deletion of your account, contact support@trainercoachconnect.com.</p>
        </CardContent>
      </Card>

      <div className="mt-4">
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  </div>
)

export default Privacy
