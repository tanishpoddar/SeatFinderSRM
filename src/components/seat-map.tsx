
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { Seat } from '@/components/seat';
import type { Seat as SeatType, Booking } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers/auth-provider';

const FLOORS = ["Ground", "First", "Second", "Third"];
const SEATS_PER_FLOOR = 50;

export function SeatMap() {
  const [seats, setSeats] = useState<Record<string, Record<string, SeatType>>>({});
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
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

  // Listen for user's active booking
  useEffect(() => {
    if (!user) {
      setActiveBooking(null);
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
    });

    return () => off(activeBookingQuery, 'value', listener);
  }, [user]);

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
            if (seatData.status === 'booked') {
              // If bookedAt is missing or invalid, free the seat immediately
              if (!seatData.bookedAt || !seatData.bookedBy || !seatData.bookingId) {
                updates[`${seatPath}/status`] = 'available';
                updates[`${seatPath}/bookedBy`] = null;
                updates[`${seatPath}/bookedAt`] = null;
                updates[`${seatPath}/bookingId`] = null;
                updates[`${seatPath}/occupiedUntil`] = null;
              } else if ((now - seatData.bookedAt) > BOOKING_EXPIRY_MS) {
                // Booking expired
                updates[`${seatPath}/status`] = 'available';
                updates[`${seatPath}/bookedBy`] = null;
                updates[`${seatPath}/bookedAt`] = null;
                updates[`${seatPath}/bookingId`] = null;
                updates[`${seatPath}/occupiedUntil`] = null;

                // Only try to update booking if it's the current user's booking
                if (seatData.bookedBy === user?.uid) {
                  const bookingPath = `bookings/${seatData.bookedBy}/${seatData.bookingId}`;
                  updates[`${bookingPath}/status`] = 'expired';
                }
              }
            }

            // Case 2: Handle 'occupied' seats where the user has overstayed
            if (seatData.status === 'occupied') {
              // If occupiedUntil is missing or invalid, free the seat after 24 hours from bookedAt
              if (!seatData.occupiedUntil) {
                const maxOccupiedTime = seatData.bookedAt ? seatData.bookedAt + (24 * 60 * 60 * 1000) : now;
                if (now > maxOccupiedTime) {
                  updates[`${seatPath}/status`] = 'available';
                  updates[`${seatPath}/bookedBy`] = null;
                  updates[`${seatPath}/bookedAt`] = null;
                  updates[`${seatPath}/bookingId`] = null;
                  updates[`${seatPath}/occupiedUntil`] = null;
                }
              } else if (now > seatData.occupiedUntil) {
                // Normal expiry
                updates[`${seatPath}/status`] = 'available';
                updates[`${seatPath}/bookedBy`] = null;
                updates[`${seatPath}/bookedAt`] = null;
                updates[`${seatPath}/bookingId`] = null;
                updates[`${seatPath}/occupiedUntil`] = null;

                // Only try to update booking if it's the current user's booking
                if (seatData.bookedBy === user?.uid && seatData.bookingId) {
                  const bookingPath = `bookings/${seatData.bookedBy}/${seatData.bookingId}`;
                  updates[`${bookingPath}/status`] = 'completed';
                  updates[`${bookingPath}/exitTime`] = new Date(seatData.occupiedUntil).toISOString();
                }
              }
            }
          });
        });

        if (Object.keys(updates).length > 0) {
          update(ref(db), updates).catch(error => {
            console.error("Failed to update seats:", error);
          });
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

  const getSeatCounts = (floor: string) => {
    const floorSeats = seats[floor.toLowerCase()] || {};
    const counts = { available: 0, booked: 0, occupied: 0 };
    Object.values(floorSeats).forEach((seat) => {
      counts[seat.status]++;
    });
    return counts;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Tabs defaultValue="ground" className="w-full">
        <div className="flex justify-center items-center mb-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4 h-auto">
            {FLOORS.map(floor => {
              const counts = loading ? null : getSeatCounts(floor);
              return (
                <TabsTrigger 
                  key={floor} 
                  value={floor.toLowerCase()} 
                  className="flex flex-col gap-1 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <span className="font-semibold text-sm sm:text-base">{floor}</span>
                  {counts && (
                    <span className="text-xs opacity-80">
                      {counts.available}/{SEATS_PER_FLOOR}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        
        {loading ? (
          <div className="bg-card rounded-lg border p-4">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-10 gap-2 sm:gap-3">
              {Array.from({ length: SEATS_PER_FLOOR }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          FLOORS.map(floor => (
            <TabsContent key={floor} value={floor.toLowerCase()} className="mt-0">
              <div className="bg-card rounded-lg border p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-10 gap-2 sm:gap-3 md:gap-4">
                  {Object.entries(seats[floor.toLowerCase()] || {})
                    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                    .map(([seatId, seatData]) => (
                      <Seat 
                        key={seatId} 
                        id={seatId} 
                        status={seatData.status}
                        bookedBy={seatData.bookedBy}
                        currentUserId={user?.uid}
                        userHasActiveBooking={!!activeBooking}
                      />
                    ))}
                </div>
              </div>
            </TabsContent>
          ))
        )}
      </Tabs>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm bg-muted/50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-card border-2 border-primary/80"></div>
          <span className="font-medium">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-accent/80 border-2 border-accent"></div>
          <span className="font-medium">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-green-500/80 border-2 border-green-600"></div>
          <span className="font-medium">Occupied</span>
        </div>
        {activeBooking && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-yellow-500/80 border-2 border-yellow-600"></div>
            <span className="font-medium">Your Booking</span>
          </div>
        )}
      </div>
    </div>
  );
}
