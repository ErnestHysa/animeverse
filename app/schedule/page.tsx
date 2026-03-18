/**
 * Schedule Page
 * Weekly anime airing schedule
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeCardCompact } from "@/components/anime/anime-card";
import { anilist } from "@/lib/anilist";
import { Calendar, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

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

interface ScheduleItem {
  id: number;
  timeUntilAiring: number;
  episode: number;
  media: any;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DaySection({ day, items, dayIndex }: { day: string; items: ScheduleItem[]; dayIndex: number }) {
  // Get items that air on this day (rough approximation based on time until airing)
  const now = Math.floor(Date.now() / 1000);
  const secondsPerDay = 86400;
  const dayStart = now + ((dayIndex + 1 - new Date().getDay()) % 7) * secondsPerDay;
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
          const airTime = new Date((now + item.timeUntilAiring) * 1000);
          const timeStr = airTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <GlassCard key={item.id} className="p-3">
              <AnimeCardCompact
                anime={item.media as any}
                showNumber={true}
                number={item.episode}
              />
              <div className="ml-12 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {timeStr}
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

  // Get today's day index (0 = Sunday, 1 = Monday, etc.)
  const todayIndex = new Date().getDay();

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
                  .filter((item: any) => item.timeUntilAiring > 0 && item.timeUntilAiring < 3600)
                  .slice(0, 5)
                  .map((item: any) => (
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
