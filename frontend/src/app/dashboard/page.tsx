import { Suspense } from "react";
import { redirect } from "next/navigation";
import { planFor } from "@/lib/billing";
import { getSession, homeFor } from "@/lib/session";
import { getInvites } from "./actions";
import { getChat, getSentMessages, getStandups, getTasks } from "./task-actions";
import { OrganizerView } from "@/components/dashboard/organizer-view";
import { DashboardLoading } from "@/components/dashboard/loading";

export const metadata = { title: "Dashboard — Taskora" };

async function Gate() {
  const s = await getSession();
  if (!s) redirect("/");
  // Interns never see the organizer dashboard — enforced here on the server.
  if (s.role === "intern") redirect(homeFor(s.role));
  return <OrganizerView name={s.name} invites={await getInvites()} tasks={await getTasks()} standups={await getStandups()} messages={await getSentMessages()} chat={await getChat()} plan={await planFor(s.userId)} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Gate />
    </Suspense>
  );
}
