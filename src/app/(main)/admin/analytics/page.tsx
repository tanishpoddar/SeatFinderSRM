'use client';

import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { BarChart } from '@/components/charts/bar-chart';
import { CircularProgress } from '@/components/charts/circular-progress';
import { LineChart } from '@/components/charts/line-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Booking, Seat } from '@/types';

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    // Validate: can't select future dates
    if (date > new Date()) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date',
        description: 'Cannot select future dates',
      });
      return;
    }
    
    // If new start date is after end date, adjust end date
    if (date > endDate) {
      setEndDate(date);
      toast({
        title: 'Dates Adjusted',
        description: 'End date was adjusted to match start date',
      });
    }
    setStartDate(date);
    setStartDateOpen(false);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    // Validate: can't select future dates
    if (date > new Date()) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date',
        description: 'Cannot select future dates',
      });
      return;
    }
    
    // Validate: end date must be after start date
    if (date < startDate) {
      toast({
        variant: 'destructive',
        title: 'Invalid Date Range',
        description: 'End date must be after start date',
      });
      return;
    }
    
    setEndDate(date);
    setEndDateOpen(false);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch bookings from Firebase client-side
      const bookingsRef = ref(db, 'bookings');
      const bookingsSnapshot = await get(bookingsRef);
      
      const allBookings: Booking[] = [];
      if (bookingsSnapshot.exists()) {
        bookingsSnapshot.forEach((userSnapshot) => {
          userSnapshot.forEach((bookingSnapshot) => {
            const booking = bookingSnapshot.val() as Booking;
            allBookings.push(booking);
          });
        });
      }

      console.log('All bookings fetched:', allBookings.length);
      console.log('Sample bookings:', allBookings.slice(0, 3));
      console.log('Date fields in first booking:', allBookings[0] ? {
        bookingTime: allBookings[0].bookingTime,
        startTime: allBookings[0].startTime,
        endTime: allBookings[0].endTime,
        exitTime: allBookings[0].exitTime,
        status: allBookings[0].status
      } : 'No bookings');

      // Fetch seats from Firebase client-side
      const seatsRef = ref(db, 'seats');
      const seatsSnapshot = await get(seatsRef);
      
      const allSeats: Seat[] = [];
      if (seatsSnapshot.exists()) {
        seatsSnapshot.forEach((floorSnapshot) => {
          floorSnapshot.forEach((seatSnapshot) => {
            allSeats.push(seatSnapshot.val() as Seat);
          });
        });
      }

      console.log('Fetched seats:', allSeats.length, allSeats);

      // Calculate analytics
      const computedAnalytics = computeAnalytics(allBookings, allSeats, startDate, endDate);
      const computedTrends = computeTrends(allBookings, allSeats, startDate, endDate);

      console.log('Computed analytics:', computedAnalytics);
      console.log('Date range:', { startDate, endDate });

      setAnalytics(computedAnalytics);
      setTrends(computedTrends);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeAnalytics = (bookings: Booking[], seats: Seat[], start: Date, end: Date) => {
    console.log('Computing analytics for bookings:', bookings);
    const occupancyRate = calculateOccupancyRate(bookings, seats, start, end);
    const peakHours = calculatePeakHours(bookings);
    const averageDuration = calculateAverageDuration(bookings);
    const noShowRate = calculateNoShowRate(bookings);
    const activeBookings = bookings.filter(b => b.status === 'active' || b.status === 'pending').length;

    return {
      occupancyRate,
      peakHours,
      averageDuration,
      noShowRate,
      totalBookings: bookings.length,
      activeBookings,
    };
  };

  const computeTrends = (bookings: Booking[], seats: Seat[], start: Date, end: Date) => {
    const trends: any[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayBookings = bookings.filter(b => {
        const bookingDate = new Date(b.entryTime || b.startTime || b.bookingTime);
        return bookingDate >= dayStart && bookingDate < dayEnd;
      });

      const occupancyRate = calculateOccupancyRate(dayBookings, seats, dayStart, dayEnd);

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        bookings: dayBookings.length,
        occupancyRate,
      });

      current.setDate(current.getDate() + 1);
    }

    return trends;
  };

  const calculateOccupancyRate = (bookings: Booking[], seats: Seat[], start: Date, end: Date): number => {
    if (seats.length === 0) {
      console.log('No seats available for occupancy calculation');
      return 0;
    }
    
    if (bookings.length === 0) {
      console.log('No bookings available for occupancy calculation');
      return 0;
    }

    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (totalHours <= 0 || isNaN(totalHours)) {
      console.log('Invalid time range:', { start, end, totalHours });
      return 0;
    }
    
    const totalAvailableHours = totalHours * seats.length;
    console.log('Total available hours:', totalAvailableHours, '(', totalHours, 'hours x', seats.length, 'seats)');

    const relevantBookings = bookings.filter(b => b.status === 'completed' || b.status === 'active');
    console.log('Relevant bookings for occupancy:', relevantBookings.length, 'out of', bookings.length);

    const totalOccupiedMinutes = relevantBookings.reduce((sum, booking) => {
      // Use entryTime/exitTime (actual check-in/out) or fallback to startTime/endTime/bookingTime
      const bookingStart = new Date(booking.entryTime || booking.startTime || booking.bookingTime);
      const bookingEnd = new Date(booking.exitTime || booking.endTime || '');
      
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        console.log('Invalid dates in booking:', booking.id, { 
          entryTime: booking.entryTime, 
          exitTime: booking.exitTime,
          startTime: booking.startTime,
          endTime: booking.endTime,
          bookingTime: booking.bookingTime
        });
        return sum;
      }
      
      const clampedStart = bookingStart < start ? start : bookingStart;
      const clampedEnd = bookingEnd > end ? end : bookingEnd;
      
      if (clampedEnd <= clampedStart) return sum;
      
      const duration = (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60);
      console.log('Booking', booking.id, 'duration:', duration, 'minutes');
      return sum + Math.max(0, duration);
    }, 0);

    const totalOccupiedHours = totalOccupiedMinutes / 60;
    console.log('Total occupied hours:', totalOccupiedHours);
    
    const rate = totalAvailableHours > 0 ? (totalOccupiedHours / totalAvailableHours) * 100 : 0;
    console.log('Occupancy rate:', rate, '%');
    
    return isNaN(rate) ? 0 : Math.min(100, Math.max(0, rate));
  };

  const calculatePeakHours = (bookings: Booking[]) => {
    const hourCounts: Record<number, number> = {};

    bookings.forEach(booking => {
      const startTime = booking.entryTime || booking.startTime || booking.bookingTime;
      if (!startTime) return;
      
      const startHour = new Date(startTime).getHours();
      if (!isNaN(startHour)) {
        hourCounts[startHour] = (hourCounts[startHour] || 0) + 1;
      }
    });

    console.log('Peak hours data:', hourCounts);

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  };

  const calculateAverageDuration = (bookings: Booking[]): number => {
    const completedBookings = bookings.filter(
      b => (b.status === 'completed' || b.status === 'active') && (b.exitTime || b.endTime)
    );

    if (completedBookings.length === 0) return 0;

    const totalDuration = completedBookings.reduce((sum, booking) => {
      const start = new Date(booking.entryTime || booking.startTime || booking.bookingTime);
      const end = new Date(booking.exitTime || booking.endTime || '');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return sum;
      
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      return sum + Math.max(0, duration);
    }, 0);

    const avg = totalDuration / completedBookings.length;
    return isNaN(avg) ? 0 : Math.max(0, avg);
  };

  const calculateNoShowRate = (bookings: Booking[]): number => {
    if (bookings.length === 0) return 0;
    const noShowCount = bookings.filter(b => b.status === 'no-show' || b.status === 'expired').length;
    const rate = (noShowCount / bookings.length) * 100;
    return isNaN(rate) ? 0 : rate;
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-[240px]">
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{format(startDate, 'PPP')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={startDate} 
                  onSelect={handleStartDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <span className="text-sm text-muted-foreground self-center">to</span>
            
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-[240px]">
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{format(endDate, 'PPP')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={endDate} 
                  onSelect={handleEndDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button onClick={fetchAnalytics} disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Loading...' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Computing analytics...</p>
          </div>
        </div>
      )}

      {!loading && !analytics && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground mb-2">No data available</p>
            <p className="text-sm text-muted-foreground">Make sure Firebase rules allow admin access</p>
          </CardContent>
        </Card>
      )}

      {!loading && analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Occupancy Rate</CardTitle>
                <CardDescription>Current seat utilization</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <CircularProgress
                  percentage={analytics.occupancyRate}
                  label="Occupancy"
                  color="#3b82f6"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Bookings</CardTitle>
                <CardDescription>In selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{analytics.totalBookings}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  {analytics.activeBookings} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Duration</CardTitle>
                <CardDescription>Per booking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{Math.round(analytics.averageDuration)}</div>
                <p className="text-sm text-muted-foreground mt-2">minutes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>No-Show Rate</CardTitle>
                <CardDescription>Missed bookings</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <CircularProgress
                  percentage={analytics.noShowRate}
                  label="No-Shows"
                  color="#ef4444"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Peak Hours</CardTitle>
              <CardDescription>Busiest times of day</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={analytics.peakHours}
                xKey="hour"
                yKey="count"
                xLabel="Hour of Day"
                yLabel="Number of Bookings"
                barColor="#3b82f6"
              />
            </CardContent>
          </Card>

          {trends && trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>Daily booking patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={trends}
                  xKey="date"
                  lines={[
                    { key: 'bookings', color: '#3b82f6', label: 'Bookings' },
                    { key: 'occupancyRate', color: '#10b981', label: 'Occupancy %' },
                  ]}
                  xLabel="Date"
                  yLabel="Value"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
