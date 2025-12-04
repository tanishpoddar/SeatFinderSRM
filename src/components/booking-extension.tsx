'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Booking, ExtensionResult } from '@/types';

interface BookingExtensionProps {
  booking: Booking;
  onExtensionComplete?: () => void;
}

export function BookingExtension({ booking, onExtensionComplete }: BookingExtensionProps) {
  const [loading, setLoading] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState<string>('');
  const [result, setResult] = useState<ExtensionResult | null>(null);
  const { toast } = useToast();

  const extensionOptions = [
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
  ];

  const handleExtend = async () => {
    if (!extensionMinutes) {
      toast({
        variant: 'destructive',
        title: 'Select Duration',
        description: 'Please select how long you want to extend your booking.',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/bookings/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          additionalMinutes: parseInt(extensionMinutes),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extend booking');
      }

      setResult(data);

      if (data.success) {
        toast({
          title: 'Booking Extended',
          description: `Your booking has been extended until ${new Date(data.newEndTime).toLocaleTimeString()}`,
        });
        onExtensionComplete?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Extension Unavailable',
          description: data.message || 'Could not extend booking at this time.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Extension Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentEndTime = new Date(booking.endTime);
  const timeRemaining = Math.max(0, currentEndTime.getTime() - Date.now());
  const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extend Your Booking</CardTitle>
        <CardDescription>
          Current booking ends at {currentEndTime.toLocaleTimeString()} ({minutesRemaining} minutes remaining)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="extension-duration" className="text-sm font-medium">
            Extension Duration
          </label>
          <Select value={extensionMinutes} onValueChange={setExtensionMinutes}>
            <SelectTrigger id="extension-duration">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {extensionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {extensionMinutes && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>New End Time</AlertTitle>
            <AlertDescription>
              Your booking will end at{' '}
              {new Date(currentEndTime.getTime() + parseInt(extensionMinutes) * 60000).toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        {result && !result.success && result.alternatives && result.alternatives.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Extension Unavailable</AlertTitle>
            <AlertDescription>
              This seat is not available for the requested time. Alternative seats available:{' '}
              {result.alternatives.map((s) => s.number).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {result && result.success && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">Extension Successful</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              Your booking has been extended until {new Date(result.newEndTime!).toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleExtend} disabled={loading || !extensionMinutes} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extending...
            </>
          ) : (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Extend Booking
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
