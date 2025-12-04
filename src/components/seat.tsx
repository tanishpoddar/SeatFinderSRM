
"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SeatStatus } from '@/types';
import { Armchair } from 'lucide-react';

interface SeatProps {
  id: string;
  status: SeatStatus;
  bookedBy?: string | null;
  currentUserId?: string | null;
  userHasActiveBooking?: boolean;
}

const seatVariants = {
  available: 'border-primary/30 bg-card text-primary/80 hover:bg-primary/10 hover:text-primary hover:border-primary hover:shadow-lg hover:shadow-primary/20 cursor-pointer',
  reserved: 'bg-accent/80 text-accent-foreground border-accent cursor-not-allowed shadow-md shadow-accent/10',
  occupied: 'bg-green-500/80 text-green-50 border-green-600 cursor-not-allowed shadow-md shadow-green-500/10',
  disabled: 'bg-muted/50 text-muted-foreground border-muted cursor-not-allowed opacity-50',
  myBooking: 'bg-yellow-500/80 text-yellow-950 border-yellow-600 cursor-pointer shadow-md shadow-yellow-500/10 hover:bg-yellow-500 hover:shadow-lg',
  maintenance: 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-400 dark:border-gray-600 cursor-not-allowed',
  'out-of-service': 'bg-red-500/20 text-red-600 border-red-500 cursor-not-allowed',
};

const SeatComponent = ({ id, status, bookedBy, currentUserId, userHasActiveBooking }: SeatProps) => {
  // Check if this seat is booked by the current user
  const isMyBooking = (status === 'reserved' || status === 'occupied') && bookedBy === currentUserId;
  
  // Determine if seat should be clickable
  const isClickable = status === 'available' && !userHasActiveBooking || isMyBooking;
  
  // Determine visual variant
  let variant: 'available' | 'occupied' | 'disabled' | 'reserved' | 'myBooking' | 'maintenance' | 'out-of-service';
  if (isMyBooking) {
    variant = 'myBooking';
  } else if (status === 'available' && userHasActiveBooking) {
    variant = 'disabled';
  } else if (status === 'reserved' || status === 'occupied') {
    variant = 'occupied';
  } else {
    variant = status;
  }

  const content = (
      <div
        className={cn(
          'w-full h-full rounded-lg flex flex-col items-center justify-center transition-all duration-200 border-2 shadow-sm',
          seatVariants[variant]
        )}
      >
        <Armchair className="h-6 w-6 sm:h-8 sm:w-8" />
        <span className="text-xs font-bold mt-1">{id}</span>
      </div>
  );

  if (!isClickable) {
    return <div className="aspect-square">{content}</div>;
  }
  
  return (
    <Link href={`/book/${id}`} className="aspect-square transform transition-transform hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg">
        {content}
    </Link>
  );
};

// Memoize to prevent unnecessary re-renders
export const Seat = React.memo(SeatComponent);
