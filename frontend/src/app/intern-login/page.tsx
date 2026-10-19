import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { InternLogin } from "@/components/auth/intern-login";

export const metadata = { title: "Intern sign in — Taskora" };

async function Gate({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [s, q] = await Promise.all([getSession(), searchParams]);
  if (s?.role === "intern") redirect("/me");
  if (s) redirect("/dashboard");
  return <InternLogin linkProblem={Boolean(q.error)} />;
}

export default function InternLoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-paper" />}>
      <Gate searchParams={props.searchParams} />
    </Suspense>
  );
}
