
"use client";

import { useState } from "react";
import { sendEmailVerification, getAuth } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MailCheck, LogOut, Send, Loader2 } from "lucide-react";

interface VerifyEmailMessageProps {
  email: string | null;
  onLogout: () => void;
}

export function VerifyEmailMessage({ email, onLogout }: VerifyEmailMessageProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      };
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
      toast({
        title: "Verification Email Sent",
        description: "A new verification link has been sent to your email address.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4 md:p-6">
      <Card className="shadow-2xl w-full max-w-lg">
        <CardHeader className="text-center items-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-4 w-fit mb-4">
            <MailCheck className="h-12 w-12" />
          </div>
          <CardTitle className="font-headline text-3xl">Verify Your Email</CardTitle>
          <CardDescription className="max-w-sm">
            Please check your inbox for a verification link sent to <br />
            <span className="font-medium text-primary">{email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Click the link in the email to activate your account. You can log in after your email has been verified.
          </p>
          <Button onClick={handleResendVerification} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="animate-spin"/> : <Send />}
            {loading ? "Sending..." : "Resend Verification Email"}
          </Button>
          <Button onClick={onLogout} variant="outline" className="w-full" size="lg">
            <LogOut /> Logout
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
