"use client";

import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export const TUTORIAL_URL =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1792594914/taskora-tutorial_qwaqs4.mp4";

/**
 * The walkthrough video in a pop-up. The content only mounts while the dialog is open, so the
 * video downloads nothing until someone asks for it and stops playing the moment it closes
 * (close button, Esc or a click outside).
 */
export function TutorialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1.5rem)] gap-3 rounded-[1.75rem] bg-paper p-3 text-neem shadow-[0_8px_0_#173f30] ring-2 ring-neem sm:max-w-[min(64rem,calc(100%-3rem))] sm:p-4"
      >
        <div className="flex items-center justify-between gap-3 pl-2">
          <div className="min-w-0">
            <DialogTitle className="font-hand truncate text-2xl font-bold leading-tight text-neem sm:text-3xl">
              See what you can say
            </DialogTitle>
            <DialogDescription className="font-note text-sm text-moss sm:text-base">
              A walkthrough of Taskora, start to finish.
            </DialogDescription>
          </div>
          <DialogClose
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-haldi py-1.5 pl-3 pr-4 text-base font-semibold text-neem shadow-[0_3px_0_#173f30] ring-2 ring-neem transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_#173f30] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-saffron"
          >
            <X className="size-4" aria-hidden />
            Close
          </DialogClose>
        </div>
        <div className="overflow-hidden rounded-2xl bg-neem ring-2 ring-neem">
          <video
            className="aspect-video w-full"
            src={TUTORIAL_URL}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
