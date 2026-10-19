import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentInternInvite, getInternSession, getSession } from "@/lib/session";
import { WelcomeCard } from "@/components/auth/welcome-card";

export const metadata = { title: "Welcome — Taskora" };

/** Where the invite link lands after sign-in. Marks the intern as joined (via getSession) and welcomes them. */
async function Gate() {
  // The intern session wins here, so an organizer signed in to Clerk in the same browser still joins correctly.
  const s = (await getInternSession()) ?? (await getSession());
  if (!s) redirect("/intern-login");
  if (s.role !== "intern") redirect("/dashboard");
  const found = await currentInternInvite();
  if (!found) redirect("/intern-login");
  const i = found.invite;
  return (
    <WelcomeCard
      name={i.name ?? s.name}
      position={i.position}
      college={i.college}
      months={i.durationMonths}
      startDate={i.startDate}
      language={i.language}
      skills={i.skills}
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<main className="min-h-svh bg-paper" />}>
      <Gate />
    </Suspense>
  );
}
