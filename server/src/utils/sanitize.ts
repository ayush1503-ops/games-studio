import sanitizeHtmlLib from 'sanitize-html';

/**
 * Output-side HTML sanitisation for the newsroom.
 *
 * The public site renders article bodies, so rich text is sanitised twice:
 * on the way in (admin save) and again on the way out (public API), which keeps
 * already-stored content safe if the allow-list is ever tightened.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr',
];

export function sanitizeRichText(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      // Force every link to be safe against tab-nabbing + referrer leaks.
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      // Downgrade h1 to h2 so a stored post can never fight the page <h1>.
      h1: 'h2',
      script: 'p',
      style: 'p',
    },
    exclusiveFilter: (frame) =>
      // Drop empty paragraphs produced by pasting.
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  }).trim();
}

/** Converts plain-text (old posts, API clients) into paragraph HTML. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('### ')) {
        return `<h3>${trimmed.slice(4).trim()}</h3>`;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function htmlToPlainText(html: string): string {
  return sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+\n/g, '\n')
    .trim();
}

/** Strips control characters and trims — used for short text fields. */
export function cleanText(value: string, maxLength = 5000): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Strips markup entirely — for fields rendered as text (CMS blocks, names). */
export function cleanPlainText(value: string, maxLength = 5000): string {
  return cleanText(htmlToPlainText(value), maxLength);
}

export function estimateReadTime(html: string): string {
  const words = htmlToPlainText(html).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} MIN READ`;
}

export function estimateExcerpt(html: string, length = 200): string {
  const text = htmlToPlainText(html).replace(/\s+/g, ' ');
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, '')}…`;
}
