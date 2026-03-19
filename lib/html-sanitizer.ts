/**
 * HTML Sanitizer for AniList descriptions
 * Safely converts common HTML tags to text/markdown
 */

export function sanitizeDescription(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // Replace common HTML tags with safer alternatives
  text = text.replace(/<br\s*\/?>/gi, "\n"); // <br> and <br/> to newline
  text = text.replace(/<\/?br>/gi, "\n"); // malformed br tags
  text = text.replace(/<i>(.*?)<\/i>/gi, "*$1*"); // <i>text</i> to *text*
  text = text.replace(/<b>(.*?)<\/b>/gi, "**$1**"); // <b>text</b> to **text**
  text = text.replace(/<strong>(.*?)<\/strong>/gi, "**$1**"); // <strong>text</strong>
  text = text.replace(/<em>(.*?)<\/em>/gi, "*$1*"); // <em>text</em>
  text = text.replace(/<[^>]+>/g, ""); // Remove any remaining HTML tags

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  return text.trim();
}
