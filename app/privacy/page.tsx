/**
 * Privacy Policy Page
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy",
  description: "AnimeVerse's privacy policy and how we handle your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-500" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-4">Privacy Policy</h1>
              <p className="text-muted-foreground">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse is designed to respect your privacy. We do not collect personal information
                    unless you voluntarily provide it.
                  </p>
                  <h3 className="font-medium text-foreground mt-4">Information Stored Locally</h3>
                  <p className="text-sm">
                    All user data is stored locally on your device using browser storage (localStorage).
                    This includes:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>Watch history and progress</li>
                    <li>Favorites and watchlist</li>
                    <li>User preferences and settings</li>
                    <li>Comment history</li>
                  </ul>
                  <p className="text-sm mt-2">
                    This data never leaves your device unless you choose to export it.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>We use your locally stored data to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Remember your place in videos</li>
                    <li>Provide personalized recommendations</li>
                    <li>Save your preferences</li>
                    <li>Maintain your favorites and watchlist</li>
                  </ul>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">3. Cookies and Tracking</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse does not use tracking cookies or third-party analytics services.
                    We use minimal technical cookies essential for the application to function.
                  </p>
                  <p className="text-sm">
                    We use AniList&apos;s API to fetch anime information. AniList may have its own
                    privacy policy which you can review at anilist.co.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">4. Data Sharing</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    We do not sell, trade, or rent your personal information to third parties.
                    Your data remains on your device and is never transmitted to our servers.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">5. Your Rights</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>You have the right to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Export your data at any time through Settings</li>
                    <li>Clear your data through Settings</li>
                    <li>Opt-out of any data collection by not using the features</li>
                  </ul>
                  <p className="text-sm mt-2">
                    Since data is stored locally, you remain in full control and can delete it
                    at any time through your browser settings or our Settings page.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">6. Children&apos;s Privacy</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse is not directed to children under 13. We do not knowingly collect
                    personal information from children under 13. If you are a parent or guardian
                    and believe your child has provided us with personal information, please contact us.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">7. Changes to This Policy</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    We may update this privacy policy from time to time. We will notify you of any
                    significant changes by posting the new policy on this page.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">8. Contact Us</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    If you have questions about this Privacy Policy, please contact us through
                    our community channels.
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
