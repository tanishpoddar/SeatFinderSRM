'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ref, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { FeedbackTicket, FeedbackStatus } from '@/types';

export function FeedbackHistory() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Read feedback directly from Firebase (client-side)
    const feedbackRef = ref(db, 'feedback');
    const userFeedbackQuery = query(
      feedbackRef,
      orderByChild('userId'),
      equalTo(user.uid)
    );

    const listener = onValue(userFeedbackQuery, (snapshot) => {
      if (snapshot.exists()) {
        const feedbackData: FeedbackTicket[] = [];
        snapshot.forEach((child) => {
          feedbackData.push({
            ...child.val(),
            id: child.key!,
          });
        });
        
        // Sort by creation date (newest first)
        feedbackData.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setTickets(feedbackData);
      } else {
        setTickets([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching feedback:', error);
      setTickets([]);
      setLoading(false);
    });

    return () => off(userFeedbackQuery, 'value', listener);
  }, [user]);

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'resolved':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'closed':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
      default:
        return '';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'bug': 'Bug Report',
      'feature-request': 'Feature Request',
      'seat-issue': 'Seat Issue',
      'general': 'General',
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback History</CardTitle>
          <CardDescription>Loading your submitted tickets...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback History</CardTitle>
          <CardDescription>You haven't submitted any feedback yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No feedback tickets found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback History</CardTitle>
          <CardDescription>{tickets.length} ticket(s) submitted</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                    selectedTicket?.id === ticket.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold line-clamp-1">{ticket.subject}</h4>
                    <Badge variant="outline" className={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {ticket.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryLabel(ticket.category)}
                    </Badge>
                    {ticket.responses && ticket.responses.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {ticket.responses.length} response(s)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
          <CardDescription>
            {selectedTicket ? 'Conversation thread' : 'Select a ticket to view details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTicket ? (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
                    <Badge variant="outline" className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.status}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="mb-3">
                    {getCategoryLabel(selectedTicket.category)}
                  </Badge>
                  <p className="text-sm text-muted-foreground mb-2">
                    Submitted on {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm">{selectedTicket.description}</p>
                </div>

                {selectedTicket.responses && selectedTicket.responses.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-semibold">Responses</h4>
                      {selectedTicket.responses.map((response, idx) => {
                        const resp = response as any;
                        return (
                        <div key={`${selectedTicket.id}-response-${idx}`} className="bg-muted p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {resp.isAdmin ? '👨‍💼 Admin' : resp.authorName || 'User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(resp.respondedAt || resp.timestamp || Date.now()).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{resp.message}</p>
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a ticket to view the conversation</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
