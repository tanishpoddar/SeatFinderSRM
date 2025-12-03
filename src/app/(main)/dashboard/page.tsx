import { BookingHistory } from "@/components/booking-history";

export default function DashboardPage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">My Dashboard</h1>
        <p className="text-muted-foreground mt-2">View your active and past bookings</p>
      </div>
      <BookingHistory />
    </div>
  );
}
