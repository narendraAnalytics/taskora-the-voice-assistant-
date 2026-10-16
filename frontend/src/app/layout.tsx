import type { Metadata, Viewport } from "next";
import { Anek_Telugu, Caveat, Edu_QLD_Hand, Mukta } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { UserSync } from "@/components/auth/user-sync";
import { UsernamePrompt } from "@/components/auth/username-prompt";
import "./globals.css";

// Clerk's forms follow the Taskora palette: paper surfaces, neem text, haldi/saffron actions.
const clerkAppearance = {
  variables: {
    colorPrimary: "#e8622a",
    colorBackground: "#fce7b2",
    colorText: "#173f30",
    colorTextSecondary: "#4e6b57",
    colorInputBackground: "#fdf0c8",
    colorInputText: "#173f30",
    colorNeutral: "#173f30",
    colorDanger: "#b23a48",
    colorSuccess: "#24543f",
    fontFamily: "var(--font-mukta), sans-serif",
    borderRadius: "0.9rem",
  },
};

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

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

const eduQldHand = Edu_QLD_Hand({
  variable: "--font-edu-qld-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taskora — the voice assistant for internship teams",
  description:
    "Interns give 20-second voice standups. Organizers ask who's behind and get the answer aloud. Taskora keeps the board up to date.",
};

export const viewport: Viewport = {
  themeColor: "#173f30",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anek.variable} ${mukta.variable} ${caveat.variable} ${eduQldHand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={clerkAppearance}>
          {children}
          <UsernamePrompt />
          <UserSync />
        </ClerkProvider>
      </body>
    </html>
  );
}
