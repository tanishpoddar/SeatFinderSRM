
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthForm } from "@/components/auth-form";
import { Loader2 } from "lucide-react";
import { VerifyEmailMessage } from "@/components/verify-email-message";

export default function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user?.emailVerified) {
      router.replace("/seats");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return <VerifyEmailMessage email={user.email} onLogout={logout} />;
  }
  
  return <AuthForm />;
}
