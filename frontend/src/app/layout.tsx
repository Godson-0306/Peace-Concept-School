import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import { SCHOOL_NAME, SCHOOL_SHORT, SCHOOL_WEBSITE_URL } from "@/lib/brand";
import {
  SCHOOL_OG_IMAGE,
  SCHOOL_SEO_DESCRIPTION,
  SCHOOL_SEO_KEYWORDS,
} from "@/lib/seo";
import GoogleAnalytics from "@/components/GoogleAnalytics";
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
  metadataBase: new URL(SCHOOL_WEBSITE_URL),
  title: {
    default: SCHOOL_NAME,
    template: `%s | ${SCHOOL_NAME}`,
  },
  description: SCHOOL_SEO_DESCRIPTION,
  applicationName: SCHOOL_SHORT,
  keywords: [...SCHOOL_SEO_KEYWORDS],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SCHOOL_WEBSITE_URL,
    siteName: SCHOOL_SHORT,
    title: SCHOOL_NAME,
    description: SCHOOL_SEO_DESCRIPTION,
    images: [{ url: SCHOOL_OG_IMAGE, alt: `${SCHOOL_NAME} campus` }],
  },
  twitter: {
    card: "summary_large_image",
    title: SCHOOL_NAME,
    description: SCHOOL_SEO_DESCRIPTION,
    images: [SCHOOL_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
