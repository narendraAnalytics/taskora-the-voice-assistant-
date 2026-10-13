import type { Metadata, Viewport } from "next";
import { Anek_Telugu, Mukta } from "next/font/google";
import "./globals.css";

const anek = Anek_Telugu({
  variable: "--font-anek",
  subsets: ["latin", "telugu"],
  axes: ["wdth"],
  display: "swap",
});

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taskora — the voice assistant for internship teams",
  description:
    "Interns give 20-second voice standups in Telugu, Hindi or English. Organizers ask who's behind and get the answer aloud. Taskora keeps the board up to date.",
};

export const viewport: Viewport = {
  themeColor: "#173f30",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anek.variable} ${mukta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
