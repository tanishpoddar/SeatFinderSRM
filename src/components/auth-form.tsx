
"use client";

import { useState } from "react";
import Image from "next/image";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Loader2 } from "lucide-react";

const authSchema = z.object({
  email: z.string().email().refine(email => email.endsWith('@srmist.edu.in'), {
    message: "Only @srmist.edu.in emails are allowed.",
  }),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

type AuthFormValues = z.infer<typeof authSchema>;

export function AuthForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const signInForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });
  
  const handleEmailPasswordSignIn = async (values: AuthFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/user-disabled') {
        toast({ variant: "destructive", title: "Sign-in failed", description: "Invalid credentials or user not verified. Please check your email and password." });
      } else {
        toast({ variant: "destructive", title: "Sign-in failed", description: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSignUp = async (values: AuthFormValues) => {
    setLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        
        const actionCodeSettings = {
            url: `${window.location.origin}/auth/action`,
            handleCodeInApp: true,
        };
        await sendEmailVerification(userCredential.user, actionCodeSettings);

        toast({
          title: "Account Created!",
          description: "A verification link has been sent to your email. Please verify your account before logging in.",
        });
        signUpForm.reset();
    } catch (error: any) {
       if (error.code === 'auth/email-already-in-use') {
         toast({ variant: "destructive", title: "Sign-up failed", description: "An account with this email already exists." });
       } else {
         toast({ variant: "destructive", title: "Sign-up failed", description: error.message });
       }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4 md:p-6">
      <Card className="shadow-2xl w-full max-w-lg hover:shadow-primary/10">
        <CardHeader className="text-center">
            <Image 
                src="/images/image.png"
                width={250}
                height={62.5}
                alt="University Logo"
                className="mx-auto mb-4 rounded-md"
                priority
            />
          <CardTitle className="font-headline text-3xl">SeatFinderSRM</CardTitle>
          <CardDescription>Book your library seat with ease.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="pt-4">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleEmailPasswordSignIn)} className="space-y-6">
                  <FormField control={signInForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SRM Email</FormLabel>
                      <FormControl><Input placeholder="user@srmist.edu.in" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={signInForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup" className="pt-4">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleEmailPasswordSignUp)} className="space-y-6">
                  <FormField control={signUpForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SRM Email</FormLabel>
                      <FormControl><Input placeholder="user@srmist.edu.in" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={signUpForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                     {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
                     {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
