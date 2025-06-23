import { BookingHistory } from "@/components/booking-history";

export default function DashboardPage() {
  return (
    <div className="container mx-auto animate-in fade-in-50 duration-500">
      <h1 className="text-3xl font-bold mb-6 font-headline">My Bookings</h1>
      <BookingHistory />
    </div>
  );
}
