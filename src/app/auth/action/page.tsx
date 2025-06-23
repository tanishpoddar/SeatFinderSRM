
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { applyActionCode, getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailCheck, ShieldAlert, LogIn } from 'lucide-react';
import Link from 'next/link';

function AuthActionHandler() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const auth = getAuth();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const actionCode = searchParams.get('oobCode');

    if (mode === 'verifyEmail' && actionCode) {
      applyActionCode(auth, actionCode)
        .then(() => {
          setStatus('success');
        })
        .catch((error) => {
          if (error.code === 'auth/invalid-action-code') {
            setErrorMessage('This verification link is invalid or has expired. Please try signing up or resending the verification email again.');
          } else {
            setErrorMessage(error.message);
          }
          setStatus('error');
        });
    } else {
      setErrorMessage('Invalid action link. Please return to the login page.');
      setStatus('error');
    }
  }, [searchParams, auth]);

  if (status === 'loading') {
    return (
      <Card className="shadow-2xl w-full max-w-lg flex flex-col items-center justify-center p-8 gap-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="text-muted-foreground text-lg">Verifying your email...</p>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="shadow-2xl w-full max-w-lg">
        <CardHeader className="text-center items-center">
          <div className="mx-auto bg-destructive text-destructive-foreground rounded-full p-4 w-fit mb-4">
            <ShieldAlert className="h-12 w-12" />
          </div>
          <CardTitle className="font-headline text-3xl">Verification Failed</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg">
            <Link href="/"><LogIn /> Return to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-2xl w-full max-w-lg">
      <CardHeader className="text-center items-center">
        <div className="mx-auto bg-primary text-primary-foreground rounded-full p-4 w-fit mb-4">
          <MailCheck className="h-12 w-12" />
        </div>
        <CardTitle className="font-headline text-3xl">Email Verified!</CardTitle>
        <CardDescription>
          Your email has been successfully verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          You can now sign in to your account with your credentials.
        </p>
        <Button asChild className="w-full" size="lg">
          <Link href="/"><LogIn /> Proceed to Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}


export default function AuthActionPage() {
    return (
        <main className="flex items-center justify-center min-h-screen bg-background p-4 md:p-6">
            <Suspense fallback={
              <Card className="shadow-2xl w-full max-w-md flex flex-col items-center justify-center p-8 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </Card>
            }>
                <AuthActionHandler />
            </Suspense>
        </main>
    )
}
