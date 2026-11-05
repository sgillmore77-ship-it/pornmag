import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <AuthShell title="Sign in">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
