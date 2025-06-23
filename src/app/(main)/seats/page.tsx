import { SeatMap } from "@/components/seat-map";

export default function SeatsPage() {
  return (
    <div className="container mx-auto animate-in fade-in-50 duration-500">
      <h1 className="text-3xl font-bold mb-6 font-headline">Seat Map</h1>
      <SeatMap />
    </div>
  );
}
