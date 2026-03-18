/**
 * Page Layout Wrapper
 * Includes Header, MobileNav, and proper spacing
 */

"use client";

import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Footer } from "./footer";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen pb-16 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
