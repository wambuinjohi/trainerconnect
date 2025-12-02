import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

const Terms: React.FC = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="container max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-4">These terms govern your use of TrainerCoachConnect. By using the service you agree to these terms.</p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Using the Service</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You are responsible for your account and for providing accurate information. Trainers must represent their qualifications truthfully.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Bookings and Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Bookings are agreements between clients and trainers. Payments processed through the platform are subject to the provider's terms. TrainerCoachConnect is not a party to the training agreement beyond facilitating bookings.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Limitations and Liability</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">TrainerCoachConnect is provided "as is" and we disclaim liability to the fullest extent permitted by law. Review the full legal text before publishing.</p>
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

export default Terms
