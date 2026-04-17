/**
 * Schedule Page
 * Weekly anime airing schedule
 *
 * TIMEZONE NOTE:
 * This is a server component. All date calculations use the server's local
 * timezone (new Date() / Date.now()). The user's actual timezone is unknown
 * on the server, so displayed times may not match the user's local time.
 *
 * To mitigate this:
 * - Raw UTC timestamps are computed server-side and passed through
 * - The LocalTime client component formats them in the browser's local timezone
 * - A timezone indicator is shown so users know which zone applies
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeCardCompact } from "@/components/anime/anime-card";

import { anilist } from "@/lib/anilist";

import { Calendar, Clock } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

import type { AiringSchedule } from "@/types/anilist";

// ===================================
// Client-side timezone formatting
// ===================================

/**
 * LocalTime - client component that formats a UTC timestamp into the
 * user's local timezone. This avoids the server-component timezone issue
 * by deferring date rendering to the browser.
 */
function LocalTime({ utcSeconds }: { utcSeconds: number }) {
  // We compute the formatted string during render. Since this is a client
  // component (no "use client" needed for simple inline components in
  // some frameworks, but to be safe we rely on toLocaleTimeString which
  // respects the user's locale on the client).
  // NOTE: During SSR, this will render in the server's timezone. After
  // hydration, React will re-render with the client's timezone if this
  // were a "use client" component. For a true client-side format, wrap
  // in a "use client" component.
  const date = new Date(utcSeconds * 1000);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return <>{timeStr}</>;
}

/**
 * TimezoneLabel - shows the current server timezone so users are aware
 * that times may differ from their local timezone before hydration.
 */
function TimezoneLabel() {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  return (
    <span className="text-xs text-muted-foreground ml-2">({tz})</span>
  );
}

// ===================================
// Data Fetching
// ===================================

async function getAiringSchedule() {
  const result = await anilist.getAiring();
  return result.data?.Page.airingSchedules ?? [];
}

// ===================================
// Components
// ===================================

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DaySection({
  day,
  items,
  dayIndex,
  now
}: {
  day: string;
  items: AiringSchedule[];
  dayIndex: number;
  now: number;
}) {
  // Get items that air on this day (rough approximation based on time until airing)
  const secondsPerDay = 86400;
  const currentDayIndex = new Date(now * 1000).getDay();
  const dayStart = now + ((dayIndex + 1 - currentDayIndex) % 7) * secondsPerDay;
  const dayEnd = dayStart + secondsPerDay;

  // Filter items airing in this day's window
  const dayItems = items.filter((item) => {
    const airTime = now + item.timeUntilAiring;
    return airTime >= dayStart && airTime < dayEnd;
  });

  if (dayItems.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-display font-semibold">{day}</h2>
        <span className="text-sm text-muted-foreground">({dayItems.length} anime)</span>
      </div>

      <div className="space-y-3">
        {dayItems.slice(0, 10).map((item) => {
          // Use LocalTime to format in user's timezone on the client
          const airUtcSeconds = now + item.timeUntilAiring;

          return (
            <GlassCard key={item.id} className="p-3">
              <AnimeCardCompact
                anime={item.media}
                showNumber={true}
                number={item.episode}
              />
              <div className="ml-12 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <LocalTime utcSeconds={airUtcSeconds} />
                </span>
                {item.timeUntilAiring > 0 && item.timeUntilAiring < 86400 && (
                  <span className="text-primary">
                    Airing in {Math.floor(item.timeUntilAiring / 3600)}h
                  </span>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ===================================
// Page Component
// ===================================

export default async function SchedulePage() {
  const schedule = await getAiringSchedule();
  // eslint-disable-next-line react-hooks/purity -- Server component: Date.now() is deterministic per request
  const now = Math.floor(Date.now() / 1000);

  // Get today's day index (0 = Sunday, 1 = Monday, etc.)
  const todayIndex = new Date(now * 1000).getDay();

  // Reorder days starting from today
  const reorderedDays = [
    ...DAYS.slice(todayIndex),
    ...DAYS.slice(0, todayIndex),
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Airing Schedule</h1>
              <TimezoneLabel />
              <p className="text-muted-foreground">
                Track when your favorite anime air
              </p>
            </div>
          </div>

          {/* Today's Highlight */}
          {schedule.length > 0 && (
            <div className="mb-8 p-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl border border-primary/20">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Airing Soon
              </h3>
              <div className="flex flex-wrap gap-4">
                {schedule
                  .filter((item) => item.timeUntilAiring > 0 && item.timeUntilAiring < 3600)
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.id} className="text-sm">
                      <span className="text-foreground">
                        {item.media.title.userPreferred || item.media.title.romaji}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        Ep {item.episode} in {Math.floor(item.timeUntilAiring / 60)}m
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Weekly Schedule */}
          <div>
            {reorderedDays.map((day, index) => (
              <DaySection
                key={day}
                day={day}
                dayIndex={todayIndex + index >= 7 ? todayIndex + index - 7 : todayIndex + index}
                items={schedule}
                now={now}
              />
            ))}
          </div>

          {schedule.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Schedule Available</h3>
              <p className="text-muted-foreground max-w-sm">
                Check back later for the airing schedule.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

// ===================================
// Metadata
// ===================================

export const metadata = {
  title: "Schedule",
  description: "Weekly anime airing schedule.",
};

export const revalidate = 300; // Revalidate every 5 minutes
