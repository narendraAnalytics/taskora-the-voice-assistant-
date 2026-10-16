import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { InternView } from "@/components/dashboard/intern-view";
import { DashboardLoading } from "@/components/dashboard/loading";

export const metadata = { title: "My workspace — Taskora" };

async function Gate() {
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
