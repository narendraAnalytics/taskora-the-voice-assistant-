import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Join your team — Taskora" };

/** Landing spot for the invitation email link (it carries a __clerk_ticket the form picks up). */
export default function SignUpPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-paper px-4 py-10">
      <div className="flex flex-col items-center gap-6">
        <h1 className="font-hand text-center text-5xl font-bold text-neem">Welcome to the team</h1>
        <Suspense fallback={<p className="font-note text-lg text-moss">Loading…</p>}>
          <SignUp fallbackRedirectUrl="/dashboard" signInUrl="/" />
        </Suspense>
      </div>
    </main>
  );
}
