"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleButton } from "@/components/google-button";
import { DemoEntryButton } from "@/components/demo-entry";
import { AuthSessionNotice } from "@/components/auth-session-notice";

type Mode = "password" | "otp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth" ? "Sign-in failed. Try again." : null
  );
  const [busy, setBusy] = useState(false);

  function enter() {
    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Email not confirmed"
          ? "Email not verified yet — click the link in your inbox first."
          : error.message
      );
      setBusy(false);
      return;
    }
    enter();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    // new emails get an account automatically (role assigned by the DB trigger)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(
        /rate limit/i.test(error.message)
          ? "Too many emails just now — wait a minute and try again, or sign in with a password."
          : error.message
      );
      return;
    }
    setCodeSent(true);
    setNotice(`Sign-in code sent to ${email} — check your inbox.`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code is invalid or expired — request a fresh one."
          : error.message
      );
      setBusy(false);
      return;
    }
    enter();
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode("");
    setCodeSent(false);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Staff sign in</CardTitle>
        <CardDescription>Owner, kitchen and floor access.</CardDescription>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border/70 p-1">
          {(
            [
              ["password", "Password"],
              ["otp", "One-time code"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <form onSubmit={mode === "password" ? submitPassword : codeSent ? verifyCode : sendCode}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              disabled={mode === "otp" && codeSent}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode === "password" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {mode === "otp" && codeSent && (
            <div className="space-y-2">
              <Label htmlFor="otp-code">Code from the email</Label>
              <Input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                required
                placeholder="••••••"
                className="text-center font-mono text-lg tracking-[0.35em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}

          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Working…"
              : mode === "password"
                ? "Sign in"
                : codeSent
                  ? "Verify & sign in"
                  : "Email me a code"}
          </Button>
          {mode === "otp" && codeSent && (
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setNotice(null);
              }}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Different email or need a new code?
            </button>
          )}
          <div className="flex w-full items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton label="Continue with Google" />
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-foreground underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthSessionNotice />
      <LoginForm />
      <div className="mt-6 rounded-lg border border-dashed border-border/80 p-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Trying it out? One-click demo entry
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <DemoEntryButton role="owner" label="Owner console" variant="secondary" />
          <DemoEntryButton role="kitchen" label="Kitchen" />
          <DemoEntryButton role="waiter" label="Waiter" />
        </div>
      </div>
    </Suspense>
  );
}
