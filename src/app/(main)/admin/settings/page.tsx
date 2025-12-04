'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const [operatingHours, setOperatingHours] = useState({
    monday: { open: '09:00', close: '18:00', isClosed: false },
    tuesday: { open: '09:00', close: '18:00', isClosed: false },
    wednesday: { open: '09:00', close: '18:00', isClosed: false },
    thursday: { open: '09:00', close: '18:00', isClosed: false },
    friday: { open: '09:00', close: '18:00', isClosed: false },
    saturday: { open: '10:00', close: '16:00', isClosed: false },
    sunday: { open: '00:00', close: '00:00', isClosed: true },
  });

  const handleSave = async () => {
    // TODO: Implement save functionality
    console.log('Saving settings:', operatingHours);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Library Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(operatingHours).map(([day, hours]) => (
            <div key={day} className="grid grid-cols-4 gap-4 items-center">
              <Label className="capitalize">{day}</Label>
              <Input
                type="time"
                value={hours.open}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    [day]: { ...hours, open: e.target.value },
                  })
                }
                disabled={hours.isClosed}
              />
              <Input
                type="time"
                value={hours.close}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    [day]: { ...hours, close: e.target.value },
                  })
                }
                disabled={hours.isClosed}
              />
              <Button
                variant={hours.isClosed ? 'outline' : 'destructive'}
                onClick={() =>
                  setOperatingHours({
                    ...operatingHours,
                    [day]: { ...hours, isClosed: !hours.isClosed },
                  })
                }
              >
                {hours.isClosed ? 'Open' : 'Close'}
              </Button>
            </div>
          ))}
          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
