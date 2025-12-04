"use client";

import React, { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutGrid,
  LogOut,
  QrCode,
  User,
  Loader2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

import { getAdminEmails } from '@/lib/admin-config';

// Admin email whitelist - loaded from environment
const ADMIN_EMAILS = getAdminEmails();

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // Check if user is admin - memoized to avoid recalculation
  const isAdmin = useMemo(() => {
    return user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  }, [user?.email]);

  useEffect(() => {
    if (!loading && !user) {
      setIsRedirecting(true);
      router.replace('/');
    }
  }, [user, loading, router]);

  // Redirect admins to admin dashboard immediately (no 404 shown)
  useEffect(() => {
    if (isAdmin && !pathname.startsWith('/admin')) {
      router.replace('/admin/analytics');
    }
  }, [isAdmin, pathname, router]);

  // Show nothing while redirecting (prevents flash of user pages)
  if (isAdmin && !pathname.startsWith('/admin')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading only while auth is initializing
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // If no user and not loading, redirect is happening
  if (!user || isRedirecting) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (email: string | null) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const navItems = [
    { href: '/seats', label: 'Seats', icon: LayoutGrid },
    { href: '/dashboard', label: 'Dashboard', icon: User },
    { href: '/scanner', label: 'Scanner', icon: QrCode },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link href="/seats" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image 
              src="/images/logo.png"
              width={36}
              height={36}
              alt="SeatFinderSRM"
              className="rounded-full"
            />
            <span className="font-headline text-lg sm:text-xl font-bold hidden sm:inline-block">SeatFinderSRM</span>
          </Link>

          {/* Desktop Navigation - Hidden for admins */}
          {!isAdmin && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button 
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn("gap-2", isActive && "shadow-sm")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {getInitials(user.email)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{isAdmin ? 'Admin' : 'SRM Student'}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/statistics" className="cursor-pointer">
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        <span>Usage Statistics</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/feedback" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Feedback & Support</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Navigation - Hidden for admins */}
        {!isAdmin && (
          <div className="md:hidden border-t">
            <div className="w-full max-w-7xl mx-auto">
              <nav className="flex items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} className="flex-1">
                      <Button 
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        className={cn("w-full gap-1.5", isActive && "shadow-sm")}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{item.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="container max-w-7xl mx-auto py-6 px-4">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-8">
        <div className="w-full max-w-7xl mx-auto text-center text-sm text-muted-foreground px-4">
          <p>
            Made with{' '}
            <span className="text-red-500">❤</span>
            {' '}by{' '}
            <a href="https://github.com/nidhi-nayana" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Nidhi
            </a>
            ,{' '}
            <a href="https://github.com/tanishpoddar" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Tanish
            </a>
            {' '}and{' '}
            <a href="https://github.com/nishant-codess" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Nishant
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
