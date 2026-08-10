import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import { SCHOOL_NAME } from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const karla = Karla({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: SCHOOL_NAME,
    template: `%s | ${SCHOOL_NAME}`,
  },
  description: `${SCHOOL_NAME} — Day Care, Nursery, Basic, Junior and Senior Secondary education for the 2025/2026 academic session.`,
  keywords: [
    SCHOOL_NAME,
    "Peace Concept",
    "Day Care",
    "Nursery",
    "Basic",
    "JSS",
    "SS",
    "admissions",
    "2025/2026",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
