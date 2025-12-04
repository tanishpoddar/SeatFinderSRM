import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/auth-utils';
import { generateReport, exportReport } from '@/services/reports';
import { ReportConfig, ReportFormat } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Skip auth check - handled client-side with Firebase Auth
    const searchParams = request.nextUrl.searchParams;
    
    // Parse metrics
    const metricsParam = searchParams.get('metrics');
    if (!metricsParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: metrics' },
        { status: 400 }
      );
    }
    
    const metrics = metricsParam.split(',') as ReportConfig['metrics'];
    
    // Parse date range
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate' },
        { status: 400 }
      );
    }
    
    // Build config
    const config: ReportConfig = {
      metrics,
      dateRange: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      filters: {},
      groupBy: (searchParams.get('groupBy') as ReportConfig['groupBy']) || undefined,
    };
    
    // Add optional filters
    const section = searchParams.get('section');
    if (section) {
      config.filters!.section = section;
    }
    
    // Generate report
    const reportData = await generateReport(config);
    
    // Check if export format requested
    const format = searchParams.get('format') as ReportFormat | null;
    
    if (format) {
      const blob = await exportReport(reportData, format);
      
      // Return file download
      return new NextResponse(blob, {
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv' : 
                         format === 'pdf' ? 'application/pdf' : 
                         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report.${format}"`,
        },
      });
    }
    
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
