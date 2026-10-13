import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, tone = "paper" }: { className?: string; tone?: "paper" | "neem" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/logo.png" alt="" width={40} height={40} className="size-10 object-contain" priority />
      <span
        className={cn(
          "display-wide text-[1.45rem] lowercase leading-none",
          tone === "paper" ? "text-paper" : "text-neem",
        )}
      >
        taskora
      </span>
    </span>
  );
}
