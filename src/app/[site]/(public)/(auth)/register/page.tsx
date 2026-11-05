import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Create an account" };

export default function Page() {
  return (
    <AuthShell title="Create an account">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
