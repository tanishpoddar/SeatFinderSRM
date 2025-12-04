'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
  xLabel?: string;
  yLabel?: string;
  barColor?: string;
  title?: string;
}

export function BarChart({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  barColor = '#3b82f6',
  title,
}: BarChartProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xKey} 
            label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis 
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              color: 'hsl(var(--foreground))'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
          <Bar dataKey={yKey} fill={barColor} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
