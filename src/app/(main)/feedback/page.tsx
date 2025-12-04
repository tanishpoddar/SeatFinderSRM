'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackHistory } from '@/components/feedback-history';

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState('submit');

  const handleSubmitSuccess = () => {
    setActiveTab('history');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">Feedback & Support</h1>
        <p className="text-muted-foreground mt-2">
          Submit feedback, report issues, or view your ticket history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
          <TabsTrigger value="history">My Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <FeedbackForm onSubmitSuccess={handleSubmitSuccess} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <FeedbackHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
