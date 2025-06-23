
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off, set, update } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { Seat } from '@/components/seat';
import type { Seat as SeatType } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers/auth-provider';

const FLOORS = ["Ground", "First", "Second", "Third"];
const SEATS_PER_FLOOR = 50;

export function SeatMap() {
  const [seats, setSeats] = useState<Record<string, Record<string, SeatType>>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const initializeSeats = useCallback(async () => {
    try {
      const seatStructure: Record<string, Record<string, any>> = {};
      FLOORS.forEach(floor => {
        const floorKey = floor.toLowerCase();
        seatStructure[floorKey] = {};
        for (let i = 1; i <= SEATS_PER_FLOOR; i++) {
          const seatId = `${floor.charAt(0).toUpperCase()}${i.toString().padStart(2, '0')}`;
          seatStructure[floorKey][seatId] = {
            id: seatId,
            status: 'available',
            bookedBy: null,
            bookedAt: null,
            bookingId: null,
            occupiedUntil: null,
          };
        }
      });
      await set(ref(db, 'seats'), seatStructure);
      toast({ title: "Success", description: "Seat map has been initialized for the first time." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Database Error", description: `Failed to initialize seats: ${error.message}` });
    }
  }, [toast]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const seatsRef = ref(db, 'seats');
    const listener = onValue(seatsRef, (snapshot) => {
      const data = snapshot.val();

      // Core expiry logic: any user loading the map cleans up expired seats.
      if (data) {
        const updates: {[key: string]: any} = {};
        const now = Date.now();
        const BOOKING_EXPIRY_MS = 150 * 1000; // 2.5 minutes for pre-booking

        Object.entries(data as Record<string, Record<string, SeatType>>).forEach(([floor, seatsOnFloor]) => {
          Object.entries(seatsOnFloor).forEach(([seatId, seatData]) => {
            const seatPath = `seats/${floor}/${seatId}`;

            // Case 1: Handle 'booked' seats that were not confirmed in time
            if (seatData.status === 'booked' && seatData.bookedAt && seatData.bookedBy && seatData.bookingId) {
              if ((now - seatData.bookedAt) > BOOKING_EXPIRY_MS) {
                updates[`${seatPath}/status`] = 'available';
                updates[`${seatPath}/bookedBy`] = null;
                updates[`${seatPath}/bookedAt`] = null;
                updates[`${seatPath}/bookingId`] = null;
                updates[`${seatPath}/occupiedUntil`] = null;

                const bookingPath = `bookings/${seatData.bookedBy}/${seatData.bookingId}`;
                updates[`${bookingPath}/status`] = 'expired';
              }
            }

            // Case 2: Handle 'occupied' seats where the user has overstayed or the account is orphaned.
            if (seatData.status === 'occupied' && seatData.occupiedUntil) {
                if (now > seatData.occupiedUntil) {
                    updates[`${seatPath}/status`] = 'available';
                    updates[`${seatPath}/bookedBy`] = null;
                    updates[`${seatPath}/bookedAt`] = null;
                    updates[`${seatPath}/bookingId`] = null;
                    updates[`${seatPath}/occupiedUntil`] = null;

                    // Also update the corresponding booking to 'completed'
                    if (seatData.bookedBy && seatData.bookingId) {
                        const bookingPath = `bookings/${seatData.bookedBy}/${seatData.bookingId}`;
                        updates[`${bookingPath}/status`] = 'completed';
                        updates[`${bookingPath}/exitTime`] = new Date(seatData.occupiedUntil).toISOString();
                    }
                }
            }
          });
        });

        if (Object.keys(updates).length > 0) {
          update(ref(db), updates);
        }
      }
      
      // Standard rendering logic
      if (data) {
        setSeats(data);
      } else {
        console.log("No seats found in database, initializing...");
        initializeSeats();
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase read failed: " + error.message);
      setLoading(false);
      if (auth.currentUser) {
        toast({ 
          variant: 'destructive', 
          title: "Database Connection Error", 
          description: "Could not read from the database. Please check your security rules." 
        });
      }
    });

    return () => off(seatsRef, 'value', listener);
  }, [initializeSeats, toast, user]);

  return (
    <>
      <Tabs defaultValue="ground" className="w-full">
        <div className="flex justify-center items-center mb-6">
          <TabsList>
            {FLOORS.map(floor => (
              <TabsTrigger key={floor} value={floor.toLowerCase()}>{floor} Floor</TabsTrigger>
            ))}
          </TabsList>
        </div>
        {loading ? (
          <div className="grid grid-cols-5 md:grid-cols-10 gap-4 p-4">
            {Array.from({ length: SEATS_PER_FLOOR }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : (
          FLOORS.map(floor => (
            <TabsContent key={floor} value={floor.toLowerCase()}>
              <div className="p-4 bg-card rounded-lg border shadow-sm">
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-4">
                  {Object.entries(seats[floor.toLowerCase()] || {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([seatId, seatData]) => (
                    <Seat key={seatId} id={seatId} status={seatData.status} />
                  ))}
                </div>
              </div>
            </TabsContent>
          ))
        )}
      </Tabs>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm">
        <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-lg bg-card border-2 border-primary/80"></div><span>Available</span></div>
        <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-lg bg-accent/80 border-2 border-accent"></div><span>Booked</span></div>
        <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-lg bg-green-500/80 border-2 border-green-600"></div><span>Occupied</span></div>
      </div>
    </>
  );
}
