import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Reset your password" };

export default function Page() {
  return (
    <AuthShell title="Reset your password">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
