'use client';

import { useState, useEffect } from 'react';
import { BookingHistory } from "@/components/booking-history";
import { BookingExtension } from "@/components/booking-extension";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { ref, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';
import { MessageSquare, BarChart3, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Booking } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;

    const activeBookingQuery = query(
      ref(db, `bookings/${user.uid}`),
      orderByChild('status'),
      equalTo('active')
    );

    const listener = onValue(activeBookingQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const [bookingId, bookingData] = Object.entries(data)[0];
        setActiveBooking({ id: bookingId, ...(bookingData as any) });
      } else {
        setActiveBooking(null);
      }
    });

    return () => off(activeBookingQuery, 'value', listener);
  }, [user]);

  const handleExtensionComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">My Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage your bookings and view statistics</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Find Seats</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/seats">
              <Button variant="outline" className="w-full">
                View Seat Map
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage Stats</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/statistics">
              <Button variant="outline" className="w-full">
                View Statistics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/feedback">
              <Button variant="outline" className="w-full">
                Submit Feedback
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Booking Extension */}
      {activeBooking && (
        <BookingExtension
          key={refreshKey}
          booking={activeBooking}
          onExtensionComplete={handleExtensionComplete}
        />
      )}

      {/* Booking History */}
      <BookingHistory />
    </div>
  );
}
