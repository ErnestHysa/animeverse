/**
 * Torrent Subtitle Loader
 * Extracts and loads subtitles from torrent files
 *
 * Phase 3: WebTorrent Player Integration
 * - Extract embedded subtitles from MKV
 * - Fallback to external .ass/.srt files
 * - Support multiple subtitle formats
 */

import type { MagnetLink } from "./torrent-finder";

// ===================================
// Types
// ===================================

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  kind: "subtitles" | "captions";
  src?: string; // For external subtitles
  srcLang?: string;
  default?: boolean;
  isEmbedded?: boolean;
  format: "vtt" | "srt" | "ass" | "ssa";
}

export interface TorrentSubtitleInfo {
  hasEmbeddedSubtitles: boolean;
  externalSubtitlesAvailable: boolean;
  tracks: SubtitleTrack[];
  defaultTrack?: SubtitleTrack;
}

// ===================================
// Embedded Subtitle Extraction (MKV)
// ===================================

/**
 * Check if file is MKV (Matroska) format
 * MKV files can contain embedded subtitle tracks
 */
export function isMKVFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".mkv");
}

/**
 * Parse MKV file for subtitle tracks
 * Note: This is a simplified implementation. Full MKV parsing requires
 * a library like mkvtoolnix or webassembly-based parser.
 *
 * For browser-based implementation, we use the video element's text tracks API
 */
export async function extractEmbeddedSubtitles(
  videoElement: HTMLVideoElement
): Promise<SubtitleTrack[]> {
  const tracks: SubtitleTrack[] = [];

  try {
    // Check if video has text tracks
    if (videoElement.textTracks && videoElement.textTracks.length > 0) {
      for (let i = 0; i < videoElement.textTracks.length; i++) {
        const track = videoElement.textTracks[i];

        if (track.kind === "subtitles" || track.kind === "captions") {
          tracks.push({
            id: `embedded-${i}`,
            label: track.label || `Track ${i + 1}`,
            language: track.language || "unknown",
            kind: track.kind as "subtitles" | "captions",
            isEmbedded: true,
            format: "vtt", // Browser converts embedded subs to VTT
            default: track.mode === "showing",
          });
        }
      }
    }
  } catch (error) {
    console.error("[Subtitle] Error extracting embedded subtitles:", error);
  }

  return tracks;
}

// ===================================
// External Subtitle Loading
// ===================================

/**
 * Search for external subtitle files in torrent
 */
export function findExternalSubtitleFiles(torrentFiles: any[]): SubtitleTrack[] {
  const subtitleExtensions = [".srt", ".ass", ".ssa", ".vtt"];
  const tracks: SubtitleTrack[] = [];

  for (const file of torrentFiles) {
    const fileName = file.name.toLowerCase();
    const extension = subtitleExtensions.find((ext) => fileName.endsWith(ext));

    if (extension) {
      // Extract language from filename
      const languageMatch = fileName.match(/\[([a-z]{2,3})\]|\.(en|ja|es|fr|de|it|pt|ru|ar|ko|zh)\./i);
      const language = languageMatch ? languageMatch[1] : "unknown";

      tracks.push({
        id: `external-${file.path}`,
        label: file.name,
        language,
        kind: "subtitles",
        isEmbedded: false,
        format: extension.replace(".", "") as "vtt" | "srt" | "ass" | "ssa",
      });
    }
  }

  return tracks;
}

/**
 * Convert SRT to WebVTT format
 */
export function convertSRTtoVTT(srtContent: string): string {
  // Add WebVTT header
  let vttContent = "WEBVTT\n\n";

  // SRT uses commas for decimal separator, VTT uses dots
  vttContent += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

  return vttContent;
}

/**
 * Convert ASS/SSA to WebVTT format
 * Note: This is a simplified conversion. Full ASS support requires more complex parsing.
 */
export function convertASStoVTT(assContent: string): string {
  let vttContent = "WEBVTT\n\n";

  // Remove ASS headers and styles
  const lines = assContent.split("\n");
  let inDialogue = false;
  let cueCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[Events]")) {
      inDialogue = true;
      continue;
    }

    if (inDialogue && trimmed.startsWith("Dialogue:")) {
      cueCount++;

      // Parse ASS dialogue: Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
      const parts = trimmed.substring(9).split(",");
      if (parts.length >= 10) {
        const start = convertASSTime(parts[1]);
        const end = convertASSTime(parts[2]);
        const text = parts.slice(9).join(",")
          .replace(/\{[^}]+\}/g, "") // Remove ASS styling tags
          .replace(/\\N/g, "\n"); // Convert line breaks

        vttContent += `${cueCount}\n${start} --> ${end}\n${text}\n\n`;
      }
    }
  }

  return vttContent;
}

/**
 * Convert ASS time format to WebVTT time format
 * ASS: H:MM:SS.CC (centiseconds)
 * VTT: HH:MM:SS.CCC (milliseconds)
 */
function convertASSTime(assTime: string): string {
  const match = assTime.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return "00:00:00.000";

  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  const seconds = match[3];
  const centiseconds = match[4].padEnd(3, "0");

  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

// ===================================
// Subtitle Loading from Torrent
// ===================================

/**
 * Load subtitles from torrent files
 */
export async function loadSubtitlesFromTorrent(
  torrent: any,
  videoFileIndex: number
): Promise<TorrentSubtitleInfo> {
  const info: TorrentSubtitleInfo = {
    hasEmbeddedSubtitles: false,
    externalSubtitlesAvailable: false,
    tracks: [],
  };

  try {
    // Get the video file
    const videoFile = torrent.files[videoFileIndex];
    if (!videoFile) {
      console.warn("[Subtitle] Video file not found at index:", videoFileIndex);
      return info;
    }

    // Check if MKV (has embedded subtitles)
    if (isMKVFile(videoFile.name)) {
      info.hasEmbeddedSubtitles = true;
      // Embedded subtitles will be extracted when video is loaded
      // Add placeholder tracks
      info.tracks.push({
        id: "embedded-placeholder",
        label: "Embedded Subtitles",
        language: "unknown",
        kind: "subtitles",
        isEmbedded: true,
        format: "vtt",
      });
    }

    // Find external subtitle files
    const externalSubs = findExternalSubtitleFiles(torrent.files);
    if (externalSubs.length > 0) {
      info.externalSubtitlesAvailable = true;
      info.tracks.push(...externalSubs);
    }

    // Set default track (prefer English)
    info.defaultTrack = info.tracks.find((t) => t.language === "en" || t.language === "eng") || info.tracks[0];
  } catch (error) {
    console.error("[Subtitle] Error loading subtitles from torrent:", error);
  }

  return info;
}

// ===================================
// Browser-Based Subtitle Loading
// ===================================

/**
 * Detect encoding of a subtitle file buffer using heuristic approaches:
 * - Check BOM for UTF-8/UTF-16
 * - Try strict UTF-8 validation
 * - Fall back to Shift-JIS detection or windows-1252
 */
function detectEncoding(buffer: Buffer): string {
  // Check BOM (Byte Order Mark)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'utf-8';
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf-16le';
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf-16be';

  // Try UTF-8 validation using fatal mode
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return 'utf-8';
  } catch {
    // Not valid UTF-8 — check for common Shift-JIS patterns
    // (high bytes 0x81-0x9F or 0xE0-0xEF followed by valid second byte)
    const hasShiftJIS = buffer.some((b, i) =>
      i > 0 &&
      ((buffer[i - 1] >= 0x81 && buffer[i - 1] <= 0x9F) || (buffer[i - 1] >= 0xE0 && buffer[i - 1] <= 0xEF)) &&
      b >= 0x40 && b <= 0xFC && b !== 0x7F
    );
    if (hasShiftJIS) return 'shift-jis';
    return 'windows-1252'; // safe fallback for most Latin text
  }
}

/**
 * Load subtitle file and create blob URL
 */
export async function loadSubtitleFile(file: any): Promise<string | null> {
  try {
    // Get file content as ArrayBuffer
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      file.getBlob((err: Error | null, blob: Blob) => {
        if (err) reject(err);
        else {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        }
      });
    });

    // Convert to text using encoding detection
    const buffer = Buffer.from(arrayBuffer);
    const encoding = detectEncoding(buffer);
    const decoder = new TextDecoder(encoding);
    let content = decoder.decode(buffer);

    // Convert to VTT if needed
    if (file.name.endsWith(".srt")) {
      content = convertSRTtoVTT(content);
    } else if (file.name.endsWith(".ass") || file.name.endsWith(".ssa")) {
      content = convertASStoVTT(content);
    }

    // Create blob URL
    const blob = new Blob([content], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("[Subtitle] Error loading subtitle file:", error);
    return null;
  }
}

/**
 * Attach subtitle to video element
 */
export function attachSubtitleToVideo(
  videoElement: HTMLVideoElement,
  subtitleUrl: string,
  label: string,
  language: string = "en",
  isDefault: boolean = false
): void {
  // Check if track already exists
  const existingTrack = Array.from(videoElement.textTracks).find(
    (track) => track.label === label
  );

  if (existingTrack) {
    return;
  }

  // Create new track
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = label;
  track.srclang = language;
  track.src = subtitleUrl;
  track.default = isDefault;

  videoElement.appendChild(track);

  // Load the track
  if (isDefault) {
    videoElement.textTracks[videoElement.textTracks.length - 1].mode = "showing";
  }
}

// ===================================
// Subtitle Detection and Auto-Selection
// ===================================

/**
 * Detect subtitle language from filename
 */
export function detectSubtitleLanguage(fileName: string): string {
  const languagePatterns: Record<string, RegExp[]> = {
    en: [/\[eng\]/i, /\[english\]/i, /\.en\./i, /\.eng\./i],
    ja: [/\[jap\]/i, /\[japanese\]/i, /\.ja\./i, /\.jap\./i],
    es: [/\[spa\]/i, /\[spanish\]/i, /\.es\./i, /\.spa\./i],
    fr: [/\[fre\]/i, /\[french\]/i, /\.fr\./i, /\.fre\./i],
    de: [/\[ger\]/i, /\[german\]/i, /\.de\./i, /\.ger\./i],
    it: [/\[ita\]/i, /\[italian\]/i, /\.it\./i, /\.ita\./i],
    pt: [/\[por\]/i, /\[portuguese\]/i, /\.pt\./i, /\.por\./i],
    ru: [/\[rus\]/i, /\[russian\]/i, /\.ru\./i, /\.rus\./i],
    ar: [/\[ara\]/i, /\[arabic\]/i, /\.ar\./i, /\.ara\./i],
    ko: [/\[kor\]/i, /\[korean\]/i, /\.ko\./i, /\.kor\./i],
    zh: [/\bchi\b/i, /\bchs\b/i, /\bcht\b/i, /\.zh\./i],
  };

  const lowerFileName = fileName.toLowerCase();

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerFileName)) {
        return lang;
      }
    }
  }

  return "unknown";
}

/**
 * Select best subtitle track based on user preferences
 */
export function selectBestSubtitleTrack(
  tracks: SubtitleTrack[],
  preferredLanguage: string = "en"
): SubtitleTrack | null {
  if (tracks.length === 0) return null;

  // Try exact language match
  const exactMatch = tracks.find((t) => t.language === preferredLanguage);
  if (exactMatch) return exactMatch;

  // Try language variant match (e.g., "en" for "eng")
  const variantMatch = tracks.find((t) => t.language.startsWith(preferredLanguage));
  if (variantMatch) return variantMatch;

  // Try English as fallback
  const englishMatch = tracks.find((t) => t.language === "en" || t.language === "eng");
  if (englishMatch) return englishMatch;

  // Return first track
  return tracks[0];
}

// ===================================
// Utility Functions
// ===================================

/**
 * Check if torrent has subtitle files
 */
export function hasSubtitleFiles(torrentFiles: any[]): boolean {
  const subtitleExtensions = [".srt", ".ass", ".ssa", ".vtt"];
  return torrentFiles.some((file) =>
    subtitleExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

/**
 * Get subtitle files from torrent
 */
export function getSubtitleFiles(torrentFiles: any[]): any[] {
  const subtitleExtensions = [".srt", ".ass", ".ssa", ".vtt"];
  return torrentFiles.filter((file) =>
    subtitleExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

/**
 * Parse subtitle format from filename
 */
export function parseSubtitleFormat(fileName: string): "vtt" | "srt" | "ass" | "ssa" | "unknown" {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".srt")) return "srt";
  if (lower.endsWith(".ass")) return "ass";
  if (lower.endsWith(".ssa")) return "ssa";

  return "unknown";
}
