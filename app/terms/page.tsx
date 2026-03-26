/**
 * Terms of Service Page
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service",
  description: "AnimeVerse's terms of service and usage guidelines.",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-4">Terms of Service</h1>
              <p className="text-muted-foreground">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    By accessing and using AnimeVerse, you accept and agree to be bound by these Terms
                    of Service. If you do not agree to these terms, please do not use our service.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse provides a platform for streaming anime content and related information.
                    We do not host any video content on our servers. All videos are streamed from
                    third-party sources.
                  </p>
                  <p className="text-sm">
                    We reserve the right to modify, suspend, or discontinue any aspect of the service
                    at any time without prior notice.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">3. User Responsibilities</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>As a user of AnimeVerse, you agree to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Use the service for personal, non-commercial purposes only</li>
                    <li>Not attempt to circumvent any technical measures we have in place</li>
                    <li>Not use bots, scrapers, or other automated means to access the service</li>
                    <li>Not upload malicious code or attempt to harm the service</li>
                    <li>Respect other users in comments and reviews</li>
                    <li>Comply with all applicable laws and regulations</li>
                  </ul>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">4. Intellectual Property</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    All anime, manga, and related content is copyrighted by their respective owners.
                    AnimeVerse does not claim ownership of any content streamed through our service.
                  </p>
                  <p className="text-sm">
                    The design, functionality, and code of AnimeVerse are our proprietary property.
                    You may not reproduce, modify, or distribute our code without permission.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">5. Disclaimer of Warranties</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse is provided &quot;as is&quot; without any warranties, expressed or implied.
                    We do not guarantee that the service will be uninterrupted, secure, or error-free.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse and its creators shall not be liable for any indirect, incidental,
                    special, consequential, or punitive damages resulting from your use of the service.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">7. Copyright Policy</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    We respect intellectual property rights. If you believe your copyrighted work
                    has been copied in a way that constitutes copyright infringement, please contact
                    us with the following information:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Your electronic or physical signature</li>
                    <li>Identification of the copyrighted work</li>
                    <li>Identification of the material claimed to be infringing</li>
                    <li>Your contact information</li>
                    <li>A statement of good faith belief</li>
                  </ul>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">8. Termination</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    We reserve the right to terminate or suspend access to our service immediately,
                    without prior notice, for any breach of these Terms of Service.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">9. Governing Law</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    These terms shall be governed by the laws of the jurisdiction in which our service
                    operates. Any disputes arising under these terms shall be resolved in accordance
                    with applicable law.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">10. Changes to Terms</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    We reserve the right to modify these terms at any time. Your continued use of the
                    service after such modifications constitutes your acceptance of the new terms.
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
