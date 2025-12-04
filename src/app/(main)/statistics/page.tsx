import { UsageStatistics } from '@/components/usage-statistics';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Usage Statistics',
  description: 'View your library usage statistics, booking history, and study patterns. Track total hours spent and booking trends.',
  keywords: ['usage stats', 'booking history', 'study hours', 'analytics'],
});

export default function StatisticsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">Usage Statistics</h1>
        <p className="text-muted-foreground mt-2">
          View your booking history and usage patterns
        </p>
      </div>

      <UsageStatistics />
    </div>
  );
}
