
"use client";

import { BookingClient } from "@/components/booking-client";
import { useAuth } from "@/components/providers/auth-provider";
import { db } from "@/lib/firebase";
import { Booking } from "@/types";
import { ref, onValue, off, query, orderByChild, equalTo } from "firebase/database";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function BookSeatPage({ params }: { params: Promise<{ seatId: string }> }) {
    const { user, loading: authLoading } = useAuth();
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [seatId, setSeatId] = useState<string>("");

    useEffect(() => {
        params.then(p => setSeatId(p.seatId));
    }, [params]);

    useEffect(() => {
        if (!user) {
            if(!authLoading) setLoading(false);
            return;
        }
        
        const activeBookingQuery = query(ref(db, `bookings/${user.uid}`), orderByChild('status'), equalTo('booked'));
        
        const listener = onValue(activeBookingQuery, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const [bookingId, bookingData] = Object.entries(data)[0];
                setActiveBooking({ id: bookingId, ...(bookingData as any) });
            } else {
                setActiveBooking(null);
            }
            setLoading(false);
        });

        return () => off(activeBookingQuery, 'value', listener);

    }, [user, authLoading]);

    if (authLoading || loading || !seatId) {
        return (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
    }

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4">
      <BookingClient seatId={seatId} activeBooking={activeBooking} />
    </div>
  );
}
