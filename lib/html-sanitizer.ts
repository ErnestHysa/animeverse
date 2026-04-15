/**
 * HTML Sanitizer for AniList descriptions
 * Safely converts common HTML tags to text/markdown
 */

export function sanitizeDescription(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // Replace common HTML tags with safer alternatives before stripping
  text = text.replace(/<br\s*\/?>/gi, "\n"); // <br> and <br/> to newline
  text = text.replace(/<\/?br>/gi, "\n"); // malformed br tags
  text = text.replace(/<i>(.*?)<\/i>/gi, "*$1*"); // <i>text</i> to *text*
  text = text.replace(/<b>(.*?)<\/b>/gi, "**$1**"); // <b>text</b> to **text**
  text = text.replace(/<strong>(.*?)<\/strong>/gi, "**$1**"); // <strong>text</strong>
  text = text.replace(/<em>(.*?)<\/em>/gi, "*$1*"); // <em>text</em>

  // Decode HTML entities BEFORE stripping tags (prevents bypass via entities)
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Strip event handlers that might survive tag stripping (e.g. on* attributes)
  text = text.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "");

  // Strip javascript: URLs
  text = text.replace(/javascript:/gi, "");

  // Strip data: URLs (potential for HTML injection)
  text = text.replace(/data:\s*text\/html/gi, "");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  return text.trim();
}
