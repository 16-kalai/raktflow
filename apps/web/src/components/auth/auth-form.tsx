"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name") || email.split("@")[0]) })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message ?? "Something went wrong");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex justify-center"><Logo /></Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "signup" ? "Create your coordinator account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {mode === "signup" ? "You'll join the demo bank, Sahyog Blood Centre, Pune." : "Log in to your blood bank dashboard."}
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="Meera" autoComplete="name" required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@bloodbank.org" autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
              </div>
            </CardContent>
            <CardFooter className="mt-6 flex-col gap-3">
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {mode === "signup" ? "Create account" : "Log in"}
              </Button>
              <p className="text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "New here? "}
                <Link className="text-primary underline-offset-4 hover:underline" href={mode === "signup" ? "/login" : "/signup"}>
                  {mode === "signup" ? "Log in" : "Create an account"}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
