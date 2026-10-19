import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentInternInvite, getInternSession, getSession } from "@/lib/session";
import { InternView } from "@/components/dashboard/intern-view";
import { DashboardLoading } from "@/components/dashboard/loading";

export const metadata = { title: "My workspace — Taskora" };

async function Gate() {
  const intern = await getInternSession();
  if (intern) {
    const i = (await currentInternInvite())?.invite;
    const profile = i
      ? { position: i.position, college: i.college, degree: i.degree, studyYear: i.studyYear, months: i.durationMonths, startDate: i.startDate, language: i.language, skills: i.skills }
      : null;
    return <InternView name={intern.name} profile={profile} />;
  }
  const s = await getSession();
  if (!s) redirect("/");
  if (s.role !== "intern") redirect("/dashboard");
  return <InternView name={s.name} />;
}

export default function MePage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Gate />
    </Suspense>
  );
}
