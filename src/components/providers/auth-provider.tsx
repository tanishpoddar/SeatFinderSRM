
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Automatically sync user to Realtime Database
      if (user) {
        try {
          const userRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userRef);
          
          // Only create/update if user doesn't exist or needs update
          if (!snapshot.exists()) {
            // Creating user in Realtime DB
            const newUserData: any = {
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: new Date().toISOString(),
              stats: {
                totalBookings: 0,
                totalHours: 0,
                noShows: 0,
              },
              restrictions: {
                isFlagged: false,
              },
            };
            
            // Only add photoURL if it exists (not null/undefined)
            if (user.photoURL) {
              newUserData.photoURL = user.photoURL;
            }
            
            await set(userRef, newUserData);
          } else {
            // Update email/displayName if changed
            const userData = snapshot.val();
            if (userData.email !== user.email || userData.displayName !== user.displayName) {
              const updatedData: any = {
                ...userData,
                email: user.email || userData.email,
                displayName: user.displayName || user.email?.split('@')[0] || userData.displayName,
              };
              
              // Only update photoURL if it exists
              if (user.photoURL) {
                updatedData.photoURL = user.photoURL;
              } else if (userData.photoURL === undefined) {
                // Remove undefined photoURL from existing data
                delete updatedData.photoURL;
              }
              
              await set(userRef, updatedData);
            }
          }
        } catch (error) {
          console.error('Error syncing user to Realtime DB:', error);
        }
      }
      
      setLoading(false);
      clearTimeout(timeout);
    }, (error) => {
      console.error("Auth state change error:", error);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [loading]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
