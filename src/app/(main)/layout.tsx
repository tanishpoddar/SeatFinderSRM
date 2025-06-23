
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import Image from 'next/image';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);


  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    const initials = names.map((n) => n[0]).join('');
    return initials.toUpperCase();
  };

  return (
    <SidebarProvider>
       <Sidebar variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Image 
              src="/images/logo.png"
              width={40}
              height={40}
              alt="SeatFinderSRM Logo"
              className="rounded-full"
            />
            <h1 className="text-xl font-semibold font-headline group-data-[collapsible=icon]:hidden">SeatFinderSRM</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/seats">
                  <LayoutGrid />
                  Seats
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard">
                  <User />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/scanner">
                  <QrCode />
                  QR Scanner
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-center gap-2 group-data-[collapsible=icon]:flex-col">
            <ThemeToggle />
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-center group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:aspect-square p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                    <AvatarFallback>
                      {getInitials(user.displayName ?? 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start truncate ml-2 group-data-[collapsible=icon]:hidden">
                    <span className="font-medium truncate text-sm">{user.displayName ?? "SRM User"}</span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName ?? "SRM User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:px-6">
           <SidebarTrigger className="sm:hidden" />
          {/* Header content can go here */}
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        <footer className="border-t bg-muted/20">
          <div className="container mx-auto py-6 text-center text-sm text-muted-foreground">
              Made with 
              <svg
                role="img"
                aria-label="love"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="mx-1 -mt-px inline-block h-4 w-4 text-red-500"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              by{' '}
              <a href="https://github.com/nidhi-nayana" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
                  Nidhi Nayana
              </a>
              ,{' '}
              <a href="https://github.com/tanishpoddar" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
                  Tanish Poddar
              </a>
              , and{' '}
              <a href="https://github.com/nishant-codess" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
                  Nishant Ranjan
              </a>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
