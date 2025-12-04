'use client';

import { useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react';

interface FeedbackTicket {
  id: string;
  userId: string;
  userEmail: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  responses?: Array<{
    message: string;
    respondedBy: string;
    respondedAt: string;
    isAdmin: boolean;
  }>;
}

export default function AdminFeedbackPage() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);
  const [response, setResponse] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { user } = useAuth();

  useEffect(() => {
    fetchFeedback();
  }, []);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredTickets(tickets);
    } else {
      setFilteredTickets(tickets.filter(t => t.status === statusFilter));
    }
  }, [statusFilter, tickets]);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const feedbackRef = ref(db, 'feedback');
      const snapshot = await get(feedbackRef);
      
      const allTickets: FeedbackTicket[] = [];
      if (snapshot.exists()) {
        // Feedback is stored at feedback/{ticketId} (flat structure)
        snapshot.forEach((ticketSnapshot) => {
          const ticket = ticketSnapshot.val();
          allTickets.push({
            id: ticketSnapshot.key!,
            userId: ticket.userId || '',
            userEmail: ticket.userEmail || '',
            category: ticket.category || 'general',
            subject: ticket.subject || 'No subject',
            description: ticket.description || '',
            status: ticket.status || 'open',
            priority: ticket.priority || 'low',
            createdAt: ticket.createdAt || new Date().toISOString(),
            responses: ticket.responses || [],
          });
        });
      }
      
      // Sort by created date, newest first
      allTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log('Fetched feedback tickets:', allTickets.length, allTickets);
      setTickets(allTickets);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (ticketId: string, userId: string) => {
    if (!response.trim() || !user) return;
    
    try {
      const ticketRef = ref(db, `feedback/${ticketId}`);
      const snapshot = await get(ticketRef);
      
      if (snapshot.exists()) {
        const ticketData = snapshot.val();
        const responses = ticketData.responses || [];
        
        responses.push({
          message: response,
          respondedBy: user.email || 'Admin',
          respondedAt: new Date().toISOString(),
          isAdmin: true,
        });
        
        await update(ticketRef, {
          responses,
          status: 'in-progress',
          updatedAt: new Date().toISOString(),
        });
        
        setResponse('');
        setSelectedTicket(null);
        fetchFeedback();
      }
    } catch (error) {
      console.error('Error responding to feedback:', error);
    }
  };

  const handleUpdateStatus = async (ticketId: string, userId: string, newStatus: string) => {
    try {
      const ticketRef = ref(db, `feedback/${ticketId}`);
      await update(ticketRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      
      fetchFeedback();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: { variant: 'destructive', icon: XCircle },
      'in-progress': { variant: 'default', icon: Clock },
      resolved: { variant: 'outline', icon: CheckCircle },
      closed: { variant: 'secondary', icon: CheckCircle },
    };
    const config = variants[status] || variants.open;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      high: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    
    return (
      <Badge variant="outline" className={colors[priority] || colors.low}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Feedback Management</h1>
        <Button onClick={fetchFeedback} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="text-sm text-muted-foreground">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">No feedback tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{ticket.userEmail}</span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(ticket.priority)}
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Category: {ticket.category}</p>
                  <p className="text-sm text-muted-foreground">{ticket.description}</p>
                </div>

                {ticket.responses && ticket.responses.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Responses ({ticket.responses.length})</p>
                    {ticket.responses.map((resp, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg text-sm ${
                          resp.isAdmin
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {resp.isAdmin ? '👨‍💼 Admin' : '👤 User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(resp.respondedAt).toLocaleString()}
                          </span>
                        </div>
                        <p>{resp.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setSelectedTicket(ticket)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Respond
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Respond to Ticket</DialogTitle>
                        <DialogDescription>{ticket.subject}</DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Type your response..."
                        rows={5}
                      />
                      <DialogFooter>
                        <Button onClick={() => handleRespond(ticket.id, ticket.userId)}>
                          Send Response
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Select
                    value={ticket.status}
                    onValueChange={(value) => handleUpdateStatus(ticket.id, ticket.userId, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
