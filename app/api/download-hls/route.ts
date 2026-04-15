/**
 * HLS Download Proxy API with Subtitle Support
 * Bypasses CORS restrictions and packages video with subtitles
 */

import { NextRequest, NextResponse } from 'next/server';
import { isProxyAuthenticated } from '@/lib/auth';
import { isUrlAllowed, getAllowedOrigin } from '@/lib/ssrf-protection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy fetch for HLS content
 */
async function proxyFetch(url: string): Promise<ReadableStream> {
  // SSRF protection
  if (!(await isUrlAllowed(url))) {
    throw new Error('URL not allowed: private/internal addresses are blocked');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return response.body;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const concatenated = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, position);
    position += chunk.length;
  }

  return Buffer.from(concatenated);
}

interface HLSSegment {
  url: string;
  type: 'video' | 'subtitle';
  language?: string;
}

interface HLSManifestData {
  videoSegments: HLSSegment[];
  subtitleSegments: Map<string, HLSSegment[]>;
}

/**
 * Parse HLS manifest and extract video and subtitle segments
 */
async function parseHLSManifest(manifestUrl: string): Promise<HLSManifestData> {
  const manifestStream = await proxyFetch(manifestUrl);
  const manifestText = await streamToBuffer(manifestStream);
  const lines = manifestText.toString().split('\n');

  const videoSegments: HLSSegment[] = [];
  const subtitleSegments = new Map<string, HLSSegment[]>();
  let currentSubtitleLang: string | null = null;

  // Check for master playlist
  const isMasterPlaylist = lines.some(l => l.includes('#EXT-X-STREAM-INF'));

  if (isMasterPlaylist) {
    // Handle master playlist - find first variant stream
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('#EXT-X-STREAM-INF')) {
        const urlLine = lines.slice(i + 1).find(l => l.trim() && !l.trim().startsWith('#'));
        if (urlLine) {
          const mediaUrl = urlLine.trim().startsWith('http')
            ? urlLine.trim()
            : new URL(urlLine.trim(), manifestUrl).toString();
          return await parseHLSManifest(mediaUrl);
        }
      }
    }
  }

  // Parse for subtitle tracks declarations
  for (const line of lines) {
    if (line.includes('#EXT-X-MEDIA:TYPE=SUBTITLES')) {
      const langMatch = line.match(/LANGUAGE="([^"]+)"/);
      if (langMatch) {
        currentSubtitleLang = langMatch[1];
      }
    }
  }

  // Parse media playlist for segments
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : '';

    // Check for subtitle segment (.vtt or .webvtt)
    if (trimmed.endsWith('.vtt') || trimmed.endsWith('.webvtt')) {
      const segUrl = trimmed.startsWith('http')
        ? trimmed
        : new URL(trimmed, manifestUrl).toString();

      if (currentSubtitleLang) {
        if (!subtitleSegments.has(currentSubtitleLang)) {
          subtitleSegments.set(currentSubtitleLang, []);
        }
        subtitleSegments.get(currentSubtitleLang)!.push({
          url: segUrl,
          type: 'subtitle',
          language: currentSubtitleLang
        });
      }
      continue;
    }

    // Video segments after #EXTINF
    if (prevLine.startsWith('#EXTINF') && !trimmed.startsWith('#')) {
      const segUrl = trimmed.startsWith('http')
        ? trimmed
        : new URL(trimmed, manifestUrl).toString();
      videoSegments.push({ url: segUrl, type: 'video' });
    }
  }

  return { videoSegments, subtitleSegments };
}

const MAX_SEGMENTS_PER_DOWNLOAD = 50;

/**
 * GET /api/download-hls?url=<manifest-url>&title=<anime-title>&episode=<number>
 * Downloads video with subtitles as a ZIP file
 */
export async function GET(request: NextRequest) {
  // Auth check: require valid JWT (no referer bypass)
  if (!(await isProxyAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const manifestUrl = searchParams.get('url');
  const animeTitle = searchParams.get('title') || 'video';
  const episodeNumber = searchParams.get('episode') || '1';

  if (!manifestUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL
  try {
    const parsedUrl = new URL(manifestUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }
    // SSRF protection (with DNS resolution)
    if (!(await isUrlAllowed(manifestUrl))) {
      return NextResponse.json({ error: 'URL not allowed: private/internal addresses are blocked' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    // Parse manifest
    const { videoSegments, subtitleSegments } = await parseHLSManifest(manifestUrl);

    if (videoSegments.length === 0) {
      return NextResponse.json({ error: 'No segments found in manifest' }, { status: 400 });
    }

    // Cap the number of segments to prevent abuse
    if (videoSegments.length > MAX_SEGMENTS_PER_DOWNLOAD) {
      videoSegments.splice(MAX_SEGMENTS_PER_DOWNLOAD);
    }

    // Dynamically import archiver
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default;

    // Create a buffer to store ZIP data
    const zipBuffers: Buffer[] = [];

    // Create archive with a custom output stream
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Capture archive data
    archive.on('data', (data: Buffer) => {
      zipBuffers.push(data);
    });

    // Promise that resolves when archive finishes
    const archiveFinished = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (err: Error) => reject(err));
      archive.on('warning', (err: Error) => {
        // Log archive warnings for debugging
        console.warn('Archive warning:', err);
      });
    });

    // Add video file (concatenated segments)
    const videoBuffers: Buffer[] = [];
    const failedVideoSegments: number[] = [];
    let segmentIndex = 0;

    for (const segment of videoSegments) {
      segmentIndex++;
      try {
        const segmentStream = await proxyFetch(segment.url);
        const buffer = await streamToBuffer(segmentStream);
        videoBuffers.push(buffer);
      } catch (error) {
        // Track failed segments for warning in README
        failedVideoSegments.push(segmentIndex);
        console.error(`Failed to download video segment ${segmentIndex}:`, error);
      }
    }

    if (videoBuffers.length > 0) {
      const videoBuffer = Buffer.concat(videoBuffers);
      const safeTitle = animeTitle.replace(/[^a-z0-9]/gi, '_');
      archive.append(videoBuffer, { name: `${safeTitle}_EP${episodeNumber}.ts` });
    }

    // Add subtitle files
    const subtitleFailures: Map<string, number[]> = new Map();
    for (const [lang, segments] of subtitleSegments) {
      const subBuffers: Buffer[] = [];
      let subIndex = 0;

      for (const segment of segments) {
        subIndex++;
        try {
          const segmentStream = await proxyFetch(segment.url);
          const buffer = await streamToBuffer(segmentStream);
          subBuffers.push(buffer);
        } catch (error) {
          // Track failed subtitle segments
          if (!subtitleFailures.has(lang)) {
            subtitleFailures.set(lang, []);
          }
          subtitleFailures.get(lang)!.push(subIndex);
          console.error(`Failed to download ${lang} subtitle segment ${subIndex}:`, error);
        }
      }

      if (subBuffers.length > 0) {
        const subBuffer = Buffer.concat(subBuffers);
        const safeTitle = animeTitle.replace(/[^a-z0-9]/gi, '_');
        archive.append(subBuffer, { name: `${safeTitle}_EP${episodeNumber}_${lang}.vtt` });
      }
    }

    // Add README
    const readmeContent = `Downloaded from AnimeVerse

Title: ${animeTitle}
Episode: ${episodeNumber}

Files:
- ${animeTitle.replace(/[^a-z0-9]/gi, '_')}_EP${episodeNumber}.ts (Video - MPEG-TS format)
${subtitleSegments.size > 0 ? Array.from(subtitleSegments.keys()).map(lang =>
  `  - ${animeTitle.replace(/[^a-z0-9]/gi, '_')}_EP${episodeNumber}_${lang}.vtt (${lang} subtitles)`
).join('\n') : ''}

${failedVideoSegments.length > 0 ? `
WARNING: Some video segments failed to download (${failedVideoSegments.length}/${videoSegments.length} segments).
The video may have gaps or missing parts. Failed segments: ${failedVideoSegments.join(', ')}
` : ''}

${subtitleFailures.size > 0 ? `
WARNING: Some subtitle segments failed to download:
${Array.from(subtitleFailures.entries()).map(([lang, fails]) =>
  `  - ${lang}: segments ${fails.join(', ')}`
).join('\n')}
` : ''}

How to play with subtitles:
1. VLC Media Player: Video → Subtitle → Add Subtitle File → Select .vtt file
2. MPC-HC: File → Load Subtitle → Select .vtt file
3. Most players auto-load subtitles if named similarly to video file
`;

    archive.append(readmeContent, { name: 'README.txt' });

    // Finalize archive
    archive.finalize();

    // Wait for archive to complete
    await archiveFinished;

    // Combine all buffers
    const zipBuffer = Buffer.concat(zipBuffers);

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${animeTitle.replace(/[^a-z0-9]/gi, '_')}_EP${episodeNumber}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('HLS download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
