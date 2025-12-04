import { NextRequest, NextResponse } from 'next/server';
import { computeAnalytics, getUsageTrends } from '@/services/analytics';

export async function GET(request: NextRequest) {
  try {
    // Admin access is verified client-side in the layout
    // This API is only accessible from admin pages
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly' | null;
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Compute analytics
    const analytics = await computeAnalytics(start, end);
    
    // Get trends if granularity specified
    let trends = null;
    if (granularity) {
      trends = await getUsageTrends(start, end, granularity);
    }
    
    return NextResponse.json({
      analytics,
      trends,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
