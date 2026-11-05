"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const input =
  "mt-1 block w-full border border-[var(--rule)] bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--brand)]";
const button =
  "w-full bg-[var(--brand)] px-4 py-3 font-semibold text-[var(--brand-contrast)] disabled:opacity-60";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function useSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function run(fn: () => Promise<{ error: { message?: string } | null } | void>) {
    setError(null);
    setPending(true);
    try {
      const res = await fn();
      if (res && res.error) setError(res.error.message ?? "Something went wrong. Please try again.");
      return !(res && res.error);
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { error, pending, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  ) : null;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { error, pending, run } = useSubmit();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() =>
      authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")) }),
    );
    if (ok) {
      router.push(safeNext(params.get("next")));
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={input} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending} className={button}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">Forgot password?</Link>
        <Link href="/register" className="underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { error, pending, run } = useSubmit();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() =>
      authClient.signUp.email({
        name: String(f.get("name")),
        email: String(f.get("email")),
        password: String(f.get("password")),
      }),
    );
    if (ok) {
      router.push("/account");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Display name">
        <input name="name" autoComplete="nickname" required maxLength={50} className={input} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={input} />
      </Field>
      <Field label="Password (at least 10 characters)">
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className={input} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input name="adult" type="checkbox" required className="mt-1" />
        <span>I confirm I am 18 or over and of legal age to view adult content where I live.</span>
      </label>
      <ErrorText error={error} />
      <button disabled={pending} className={button}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { error, pending, run } = useSubmit();
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() =>
      authClient.requestPasswordReset({ email: String(f.get("email")), redirectTo: "/reset-password" }),
    );
    if (ok) setSent(true);
  }

  if (sent) {
    return <p>If an account exists for that email, we&apos;ve sent a link to reset the password. It expires in one hour.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={input} />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending} className={button}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { error, pending, run } = useSubmit();

  if (!token || params.get("error")) {
    return (
      <p>
        This reset link is invalid or has expired. <Link href="/forgot-password" className="underline">Request a new one</Link>.
      </p>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() => authClient.resetPassword({ newPassword: String(f.get("password")), token: token! }));
    if (ok) router.push("/login?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="New password (at least 10 characters)">
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className={input} />
      </Field>
      <ErrorText error={error} />
      <button disabled={pending} className={button}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="border border-[var(--rule)] px-4 py-2 text-sm font-semibold hover:border-[var(--brand)]"
    >
      Sign out
    </button>
  );
}
