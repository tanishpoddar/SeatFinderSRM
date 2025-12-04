'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/components/charts/bar-chart';
import { LineChart } from '@/components/charts/line-chart';
import { Clock, Calendar, Armchair, TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { UserStatistics, Booking } from '@/types';

export function UsageStatistics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAndCalculateStats = async () => {
      try {
        // Fetch bookings directly from Firebase (client-side)
        const bookingsRef = ref(db, `bookings/${user.uid}`);
        const snapshot = await get(bookingsRef);

        if (!snapshot.exists()) {
          setStats({
            totalBookings: 0,
            totalHoursBooked: 0,
            averageSessionDuration: 0,
            noShowCount: 0,
            overstayCount: 0,
            mostBookedSeats: [],
            preferredTimeSlots: [],
            weeklyUsage: [],
            monthlyUsage: [],
          });
          setLoading(false);
          return;
        }

        const bookings: Booking[] = [];
        snapshot.forEach((child) => {
          const booking = child.val() as Booking;
          bookings.push({
            ...booking,
            id: child.key!,
          });
        });

        // Calculate statistics
        const calculatedStats = calculateStatistics(bookings);
        setStats(calculatedStats);
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCalculateStats();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>No statistics available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Start booking seats to see your usage statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{stats.totalHoursBooked.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Hours booked</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{Math.round(stats.averageSessionDuration)}</div>
            <p className="text-xs text-muted-foreground mt-1">Minutes per session</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Shows</CardTitle>
            <Armchair className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{stats.noShowCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Missed bookings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline">Most Booked Seats</CardTitle>
            <CardDescription>Your favorite seats</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {stats.mostBookedSeats.length > 0 ? (
              <BarChart
                data={stats.mostBookedSeats}
                xKey="seatId"
                yKey="count"
                xLabel="Seat"
                yLabel="Bookings"
                barColor="#3b82f6"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Armchair className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline">Preferred Time Slots</CardTitle>
            <CardDescription>When you usually book</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {stats.preferredTimeSlots.length > 0 ? (
              <BarChart
                data={stats.preferredTimeSlots}
                xKey="hour"
                yKey="count"
                xLabel="Hour of Day"
                yLabel="Bookings"
                barColor="#10b981"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline">Weekly Usage</CardTitle>
            <CardDescription>Hours booked per week</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {stats.weeklyUsage.length > 0 ? (
              <LineChart
                data={stats.weeklyUsage}
                xKey="week"
                lines={[{ key: 'hours', color: '#3b82f6', label: 'Hours' }]}
                xLabel="Week"
                yLabel="Hours"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline">Monthly Usage</CardTitle>
            <CardDescription>Hours booked per month</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {stats.monthlyUsage.length > 0 ? (
              <LineChart
                data={stats.monthlyUsage}
                xKey="month"
                lines={[{ key: 'hours', color: '#10b981', label: 'Hours' }]}
                xLabel="Month"
                yLabel="Hours"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Calculate user statistics from bookings
 */
function calculateStatistics(bookings: Booking[]): UserStatistics {
  // Filter completed bookings with check-in
  const completedBookings = bookings.filter(
    (b) => b.status === 'completed' && b.entryTime
  );

  // Calculate total hours booked
  const totalHoursBooked = completedBookings.reduce((sum, booking) => {
    const start = new Date(booking.entryTime!);
    const end = new Date(booking.exitTime || booking.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return sum + Math.max(0, hours);
  }, 0);

  // Calculate average session duration (in minutes)
  const averageSessionDuration =
    completedBookings.length > 0
      ? (totalHoursBooked / completedBookings.length) * 60
      : 0;

  // Count no-shows and overstays
  const noShowCount = bookings.filter((b) => b.status === 'no-show').length;
  const overstayCount = bookings.filter((b) => {
    if (b.status !== 'completed' || !b.exitTime) return false;
    const exitTime = new Date(b.exitTime);
    const endTime = new Date(b.endTime);
    return exitTime > endTime;
  }).length;

  // Find most booked seats
  const seatCounts: Record<string, number> = {};
  completedBookings.forEach((booking) => {
    seatCounts[booking.seatId] = (seatCounts[booking.seatId] || 0) + 1;
  });

  const mostBookedSeats = Object.entries(seatCounts)
    .map(([seatId, count]) => ({ seatId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Find preferred time slots
  const hourCounts: Record<number, number> = {};
  completedBookings.forEach((booking) => {
    const hour = new Date(booking.startTime).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const preferredTimeSlots = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate weekly usage
  const weeklyUsage = calculateWeeklyUsage(completedBookings);

  // Calculate monthly usage
  const monthlyUsage = calculateMonthlyUsage(completedBookings);

  return {
    totalBookings: bookings.length,
    totalHoursBooked,
    averageSessionDuration,
    noShowCount,
    overstayCount,
    mostBookedSeats,
    preferredTimeSlots,
    weeklyUsage,
    monthlyUsage,
  };
}

/**
 * Calculate weekly usage
 */
function calculateWeeklyUsage(
  bookings: Booking[]
): Array<{ week: string; hours: number }> {
  const weeklyData: Record<string, number> = {};

  bookings.forEach((booking) => {
    if (!booking.entryTime) return;

    const start = new Date(booking.entryTime);
    const end = new Date(booking.exitTime || booking.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Get week identifier (ISO week)
    const weekStart = getWeekStart(start);
    const weekKey = weekStart.toISOString().split('T')[0];

    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + Math.max(0, hours);
  });

  return Object.entries(weeklyData)
    .map(([week, hours]) => ({ week, hours }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12); // Last 12 weeks
}

/**
 * Calculate monthly usage
 */
function calculateMonthlyUsage(
  bookings: Booking[]
): Array<{ month: string; hours: number }> {
  const monthlyData: Record<string, number> = {};

  bookings.forEach((booking) => {
    if (!booking.entryTime) return;

    const start = new Date(booking.entryTime);
    const end = new Date(booking.exitTime || booking.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Get month identifier (YYYY-MM)
    const monthKey = start.toISOString().substring(0, 7);

    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Math.max(0, hours);
  });

  return Object.entries(monthlyData)
    .map(([month, hours]) => ({ month, hours }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}
