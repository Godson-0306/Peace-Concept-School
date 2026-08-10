import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Peace Concept School",
    template: "%s | Peace Concept School",
  },
  description:
    "Peace Concept School — a Nigerian secondary school offering Junior and Senior Secondary education (JSS1–SSS3) for the 2025/2026 academic session.",
  keywords: [
    "Peace Concept School",
    "Nigerian secondary school",
    "JSS",
    "SSS",
    "admissions",
    "2025/2026",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
