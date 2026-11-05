import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
