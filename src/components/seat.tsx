
"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SeatStatus } from '@/types';
import { Armchair } from 'lucide-react';

interface SeatProps {
  id: string;
  status: SeatStatus;
}

const seatVariants = {
  available: 'border-primary/30 bg-card text-primary/80 hover:bg-primary/10 hover:text-primary hover:border-primary hover:shadow-lg hover:shadow-primary/20 cursor-pointer',
  booked: 'bg-accent/80 text-accent-foreground border-accent cursor-not-allowed shadow-md shadow-accent/10',
  occupied: 'bg-green-500/80 text-green-50 border-green-600 cursor-not-allowed shadow-md shadow-green-500/10',
};

const SeatComponent = ({ id, status }: SeatProps) => {
  const isAvailable = status === 'available';

  const content = (
      <div
        className={cn(
          'w-full h-full rounded-lg flex flex-col items-center justify-center transition-all duration-200 border-2 shadow-sm',
          seatVariants[status]
        )}
      >
        <Armchair className="h-6 w-6 sm:h-8 sm:w-8" />
        <span className="text-xs font-bold mt-1">{id}</span>
      </div>
  );

  if (!isAvailable) {
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
