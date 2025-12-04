import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "SeatFinderSRM - Library Seat Booking System",
    template: "%s | SeatFinderSRM",
  },
  description: "Real-time library seat booking system for SRM University students. Book seats, track usage, and manage your library visits with QR code check-in.",
  keywords: [
    "SRM University",
    "SRMIST",
    "library seat booking",
    "seat reservation",
    "library management",
    "real-time booking",
    "QR code check-in",
    "student portal",
    "SRM library",
    "study seat booking",
  ],
  authors: [
    { name: "Nidhi Nayana", url: "https://github.com/nidhi-nayana" },
    { name: "Tanish Poddar", url: "https://github.com/tanishpoddar" },
    { name: "Nishant Ranjan", url: "https://github.com/nishant-codess" },
  ],
  creator: "Department of Computing Technologies, SRMIST",
  publisher: "SRM Institute of Science and Technology",
  applicationName: "SeatFinderSRM",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "SeatFinderSRM - Library Seat Booking System",
    description: "Real-time library seat booking system for SRM University students",
    siteName: "SeatFinderSRM",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
