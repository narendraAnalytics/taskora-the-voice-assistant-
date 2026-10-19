import Link from "next/link";
import { Logo } from "@/components/landing/logo";

/** Shared paper page for the intern join and sign-in screens: washes, halftone dots, logo on top. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-paper px-4 py-10 text-neem">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 size-[36rem] rounded-full bg-haldi/40 blur-3xl motion-safe:animate-[aurora_18s_ease-in-out_infinite]" />
        <div className="absolute -left-32 bottom-0 size-[30rem] rounded-full bg-tulsi/30 blur-3xl motion-safe:animate-[aurora_22s_ease-in-out_-6s_infinite]" />
        <div className="absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(#173f3022_1.4px,transparent_1.6px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>
      <div className="relative w-full max-w-md">
        <Link href="/" aria-label="Taskora home" className="mb-6 flex justify-center">
          <Logo tone="neem" />
        </Link>
        {children}
      </div>
    </main>
  );
}
