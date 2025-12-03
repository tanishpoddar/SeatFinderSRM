import { SeatMap } from "@/components/seat-map";

export default function SeatsPage() {
  return (
    <div className="w-full space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">Library Seats</h1>
        <p className="text-muted-foreground mt-2">Select an available seat to book</p>
      </div>
      <SeatMap />
    </div>
  );
}
