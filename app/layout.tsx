import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/providers/theme-provider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://yggdrasil.stream"),
  title: {
    default: "AnimeVerse Stream - Anime Streaming",
    template: "%s | AnimeVerse Stream",
  },
  description: "Watch your favorite anime in HD quality. Stream thousands of anime episodes with advanced features like P2P streaming, offline support, and more.",
  keywords: ["anime", "streaming", "webtorrent", "p2p", "free anime", "watch anime", "anime online", "hd anime"],
  authors: [{ name: "AnimeVerse Stream" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://yggdrasil.stream",
    siteName: "AnimeVerse Stream",
    title: "AnimeVerse Stream - Anime Streaming",
    description: "Watch your favorite anime with free P2P streaming.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AnimeVerse Stream",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AnimeVerse Stream - Anime Streaming",
    description: "Watch your favorite anime with free P2P streaming.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AnimeVerse Stream",
  },
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${plusJakartaSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
