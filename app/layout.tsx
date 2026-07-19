import type { Metadata } from "next";
import { Navigation } from "./components/Navigation";
import { Onboarding } from "./components/Onboarding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venture Genie",
  description: "Sourcing, screening, diligence, and decision intelligence",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-950">
        <Navigation />
        <Onboarding />
        <main className="min-h-screen pb-16 pt-20 lg:pl-64 lg:pt-0">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</div>
        </main>
      </body>
    </html>
  );
}
