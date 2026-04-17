/**
 * DMCA Page
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "DMCA",
  description: "AnimeVerse's DMCA policy and copyright infringement reporting procedure.",
};

export default function DMCAPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-4xl font-display font-bold mb-4">DMCA & Copyright Policy</h1>
              <p className="text-muted-foreground">
                How to report copyright infringement on AnimeVerse
              </p>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Copyright Infringement Claims</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    AnimeVerse respects the intellectual property rights of others and expects
                    users of our service to do the same. We comply with the Digital Millennium
                    Copyright Act (DMCA) and respond to notices of alleged infringement.
                  </p>
                  <p className="text-sm">
                    If you believe your copyrighted work has been copied in a way that constitutes
                    copyright infringement and is accessible on this site, please notify us
                    immediately.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">DMCA Notice Requirements</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Your DMCA notice must include the following information (17 U.S.C. §512(c)(3)(A)):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>
                      <span className="font-medium text-foreground">Physical or electronic signature</span>
                      <p className="text-sm mt-1">
                        A physical or electronic signature of a person authorized to act on behalf
                        of the owner of an exclusive right that is allegedly infringed.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Identification of the copyrighted work</span>
                      <p className="text-sm mt-1">
                        Identification of the copyrighted work claimed to have been infringed, or,
                        if multiple copyrighted works, a representative list of such works.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Identification of the infringing material</span>
                      <p className="text-sm mt-1">
                        Identification of the material that is claimed to be infringing or to be the
                        subject of infringing activity, and information reasonably sufficient to
                        permit us to locate the material.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Contact information</span>
                      <p className="text-sm mt-1">
                        Information reasonably sufficient to permit us to contact you, such as an
                        address, telephone number, and email address.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Statement of good faith</span>
                      <p className="text-sm mt-1">
                        A statement that you have a good faith belief that the use of the material
                        in the manner complained of is not authorized by the copyright owner, its agent,
                        or the law.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Statement of accuracy</span>
                      <p className="text-sm mt-1">
                        A statement that the information in the notification is accurate, and under
                        penalty of perjury, that you are authorized to act on behalf of the owner of
                        an exclusive right that is allegedly infringed.
                      </p>
                    </li>
                  </ol>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">How to Submit a DMCA Notice</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    To submit a DMCA notice, please send a written communication that includes
                    the above information to:
                  </p>
                  <div className="bg-white/5 p-4 rounded-lg mt-4">
                    <p className="font-medium">DMCA Agent</p>
                    <p className="text-sm">AnimeVerse</p>
                    <p className="text-sm text-primary">
                      For copyright concerns, please contact us at{" "}
                      <a href="mailto:dmca@animeverse.app" className="underline">
                        dmca@animeverse.app
                      </a>
                    </p>
                  </div>
                  <p className="text-sm mt-4">
                    You may also use our in-app report feature to flag specific content for review.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Counter-Notification</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    If you believe that content you posted on AnimeVerse was removed or disabled
                    by mistake or misidentification, you may send a counter-notification.
                  </p>
                  <p className="text-sm">
                    Your counter-notification must include:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Your physical or electronic signature</li>
                    <li>Identification of the material that has been removed or disabled</li>
                    <li>A statement under penalty of perjury that you have a good faith belief
                      that the material was removed or disabled as a result of mistake</li>
                    <li>Your name, address, and telephone number</li>
                    <li>A statement consenting to jurisdiction in your local area</li>
                  </ul>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h2 className="text-xl font-semibold mb-4">Repeat Infringer Policy</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    In accordance with the DMCA and other applicable laws, we have adopted a policy
                    of terminating, in appropriate circumstances, users who are repeat infringers.
                  </p>
                  <p className="text-sm">
                    We reserve the right to terminate access to our service for any user found
                    to be repeatedly infringing on copyrights.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-6 border-red-500/30">
                <h2 className="text-xl font-semibold mb-4 text-red-400">Important Notice</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    <strong>Please note:</strong> AnimeVerse does not host any video content on its
                    servers. All videos are streamed from third-party sources. If you have concerns
                    about copyrighted content, we recommend contacting the source directly.
                  </p>
                  <p className="text-sm">
                    We take copyright seriously and will respond to all valid DMCA notices in
                    accordance with the law.
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
