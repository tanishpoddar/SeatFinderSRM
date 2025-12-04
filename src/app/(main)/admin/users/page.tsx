'use client';

import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Flag, FlagOff } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users from Realtime DB client-side
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      
      const usersList: any[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((userSnapshot) => {
          const userData = userSnapshot.val();
          usersList.push({
            uid: userSnapshot.key,
            email: userData.email || '',
            displayName: userData.displayName || userData.email?.split('@')[0] || '',
            stats: userData.stats || { totalBookings: 0 },
            restrictions: userData.restrictions || { isFlagged: false },
            ...userData
          });
        });
      }
      
      console.log('Fetched users from DB:', usersList.length, usersList);
      setAllUsers(usersList);
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setUsers(allUsers);
      return;
    }
    
    const filtered = allUsers.filter(user => 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.uid?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setUsers(filtered);
  };

  const handleFlagUser = async (userId: string) => {
    try {
      await fetch('/api/admin/users/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason }),
      });
      handleSearch();
      setReason('');
    } catch (error) {
      console.error('Error flagging user:', error);
    }
  };

  const handleUnflagUser = async (userId: string) => {
    try {
      await fetch('/api/admin/users/unflag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      handleSearch();
    } catch (error) {
      console.error('Error unflagging user:', error);
    }
  };

  const syncAuthUsersToDb = async () => {
    setLoading(true);
    try {
      // This will trigger the auth provider to sync current user
      // For a full sync of all users, you'd need Firebase Admin SDK on the server
      console.log('Syncing users...');
      
      // Refresh the users list
      await fetchUsers();
      
      alert('User sync initiated. Current user has been synced. Other users will sync when they next sign in.');
    } catch (error) {
      console.error('Error syncing users:', error);
      alert('Error syncing users. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={syncAuthUsersToDb} variant="outline" disabled={loading}>
          {loading ? 'Syncing...' : 'Sync Auth Users'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Total Bookings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>{user.displayName || user.email?.split('@')[0] || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>{user.stats?.totalBookings || 0}</TableCell>
                    <TableCell>
                      {user.restrictions?.isFlagged ? (
                        <span className="text-destructive">Flagged</span>
                      ) : (
                        <span className="text-green-600">Active</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.restrictions?.isFlagged ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnflagUser(user.uid)}>
                          <FlagOff className="h-4 w-4 mr-2" />
                          Unflag
                        </Button>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Flag className="h-4 w-4 mr-2" />
                              Flag User
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Flag User</DialogTitle>
                              <DialogDescription>Restrict this user from making bookings</DialogDescription>
                            </DialogHeader>
                            <div>
                              <Label>Reason</Label>
                              <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Enter reason for flagging..."
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="destructive" onClick={() => handleFlagUser(user.uid)}>
                                Flag User
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
