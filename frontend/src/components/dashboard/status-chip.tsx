import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Status } from "@/lib/demo-data";

const TONE: Record<Status, string> = {
  todo: "bg-sage text-neem",
  progress: "bg-haldi text-neem",
  blocked: "bg-kumkum text-paper",
  done: "bg-tulsi text-neem",
  overdue: "bg-saffron text-neem",
};

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const tones = ["bg-saffron", "bg-haldi", "bg-tulsi", "bg-kumkum text-paper", "bg-neem-soft text-paper", "bg-sage"];
  const tone = tones[name.length % tones.length];
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-neem", tone, className)}>
      {initials}
    </span>
  );
}
