/**
 * FAQ Page
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { HelpCircle } from "lucide-react";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about AnimeVerse.",
};

const faqs = [
  {
    id: "free-to-use",
    q: "Is AnimeVerse free to use?",
    a: "Yes! AnimeVerse is completely free to use. No subscriptions, no hidden fees, no premium tiers.",
  },
  {
    id: "account-required",
    q: "Do I need to create an account?",
    a: "No separate AnimeVerse account is required. You can use the app immediately, and optional AniList sign-in adds sync features for your anime data.",
  },
  {
    id: "video-quality",
    q: "What video quality options are available?",
    a: "We offer multiple quality options including 360p, 480p, 720p HD, and 1080p Full HD. You can change the quality anytime using the settings icon on the video player.",
  },
  {
    id: "new-episodes",
    q: "How often are new episodes added?",
    a: "New episodes are typically added within 1-2 hours after they air in Japan. We work continuously to ensure you have access to the latest content.",
  },
  {
    id: "offline-viewing",
    q: "Can I download episodes for offline viewing?",
    a: "Yes, compatible sources can be downloaded from the watch page. Availability depends on the provider and stream format, so some episodes may still be stream-only.",
  },
  {
    id: "availability",
    q: "Why isn't a particular anime available?",
    a: "Availability depends on licensing and source accessibility. Some anime may not be available in certain regions. We're constantly working to expand our library.",
  },
  {
    id: "report-broken",
    q: "How do I report a broken video?",
    a: "Use the report button on the video player to report any issues. We monitor reports and fix broken videos as quickly as possible.",
  },
  {
    id: "mobile-app",
    q: "Does AnimeVerse have an app?",
    a: "AnimeVerse is a Progressive Web App (PWA), which means you can install it on your device for an app-like experience. Look for 'Install' in your browser menu.",
  },
  {
    id: "subtitles",
    q: "Are subtitles available?",
    a: "Yes, most videos include subtitles. You can customize subtitle appearance in the video player settings.",
  },
  {
    id: "request-anime",
    q: "Can I request an anime to be added?",
    a: "While we can't fulfill all requests, we appreciate feedback! Join our community to discuss and vote for anime you'd like to see added.",
  },
] as const;

export default function FAQPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about AnimeVerse
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <GlassCard key={faq.id}>
                <div className="p-6">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Contact */}
          <GlassCard className="p-8 mt-12 text-center">
            <h2 className="text-2xl font-semibold mb-3">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              We&apos;re here to help! Reach out to our community for support.
            </p>
            <a
              href="https://anilist.co/forum"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Visit Community Forum
            </a>
          </GlassCard>
        </div>
      </main>
      <Footer />
    </>
  );
}
