import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const FiltersModal: React.FC<{ initial?: any, onApply: (f: any) => void, onClose?: () => void }> = ({ initial = {}, onApply, onClose }) => {
  const [minRating, setMinRating] = useState<number>(initial.minRating ?? 0)
  const [maxPrice, setMaxPrice] = useState<number | ''>(initial.maxPrice ?? '')
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(initial.onlyAvailable ?? false)
  const [radius, setRadius] = useState<number | ''>(initial.radius ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label>Minimum rating</Label>
                <Input type="number" min={0} max={5} step={0.1} value={String(minRating)} onChange={(e) => setMinRating(Number(e.target.value))} />
              </div>

              <div>
                <Label>Maximum price (per hour)</Label>
                <Input type="number" min={0} value={String(maxPrice)} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')} />
              </div>

              <div>
                <Label>Only Available</Label>
                <select value={onlyAvailable ? 'yes' : 'no'} onChange={(e) => setOnlyAvailable(e.target.value === 'yes')} className="w-full p-2 border border-border rounded-md bg-input">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div>
                <Label>Max service radius (km)</Label>
                <Input type="number" min={0} value={String(radius)} onChange={(e) => setRadius(e.target.value ? Number(e.target.value) : '')} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onClose?.()}>Cancel</Button>
                <Button onClick={() => { onApply({ minRating, maxPrice, onlyAvailable, radius }); onClose?.() }}>Apply</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
