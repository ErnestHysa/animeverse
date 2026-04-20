import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { getTorrentHealthSnapshot } from "@/lib/monitoring-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const torrents = await getTorrentHealthSnapshot();
    return NextResponse.json({
      torrents,
      total: torrents.length,
    });
  } catch (error) {
    console.error("[TorrentHealthAPI] Error:", error);
    return NextResponse.json(
      { error: "Failed to load torrent health", torrents: [] },
      { status: 500 }
    );
  }
}
