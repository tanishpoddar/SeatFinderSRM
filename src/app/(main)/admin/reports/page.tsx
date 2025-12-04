'use client';

import { useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format as formatDate } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<string[]>(['occupancy']);
  const [groupBy, setGroupBy] = useState('day');
  const [exportFormat, setExportFormat] = useState('csv');

  const handleGenerateReport = async () => {
    try {
      // Fetch data from Firebase client-side
      const bookingsRef = ref(db, 'bookings');
      const bookingsSnapshot = await get(bookingsRef);
      
      const allBookings: any[] = [];
      if (bookingsSnapshot.exists()) {
        bookingsSnapshot.forEach((userSnapshot) => {
          userSnapshot.forEach((bookingSnapshot) => {
            const booking = bookingSnapshot.val();
            const bookingDate = new Date(booking.entryTime || booking.startTime || booking.bookingTime);
            
            // Filter by date range
            if (bookingDate >= startDate && bookingDate <= endDate) {
              allBookings.push(booking);
            }
          });
        });
      }
      
      // Generate CSV
      if (exportFormat === 'csv') {
        const headers = ['Date', 'Seat ID', 'User', 'Status', 'Duration (min)', 'Entry Time', 'Exit Time'];
        const rows = allBookings.map(b => [
          new Date(b.bookingTime).toLocaleDateString(),
          b.seatId,
          b.userEmail?.split('@')[0] || 'Unknown',
          b.status,
          b.duration || 0,
          b.entryTime ? new Date(b.entryTime).toLocaleString() : 'N/A',
          b.exitTime ? new Date(b.exitTime).toLocaleString() : 'N/A',
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${formatDate(startDate, 'yyyy-MM-dd')}-to-${formatDate(endDate, 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.log('Report data:', allBookings);
        alert(`${exportFormat.toUpperCase()} export not yet implemented. Check console for data.`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Check console for details.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Report Generation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configure Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(startDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(endDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label>Group By</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerateReport} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
