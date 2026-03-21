const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "around",
  "been",
  "before",
  "being",
  "between",
  "both",
  "business",
  "call",
  "calls",
  "can",
  "does",
  "each",
  "from",
  "have",
  "help",
  "into",
  "just",
  "more",
  "next",
  "only",
  "ours",
  "over",
  "same",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "want",
  "what",
  "when",
  "which",
  "with",
  "would",
  "your",
]);

export function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function stripMarkdown(value: string) {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1"),
  );
}

export function extractHtmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(decodeHtmlEntities(match[1])) : null;
}

export function extractHtmlText(html: string) {
  const withoutNonContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNonContent
    .replace(/<\/(p|div|section|article|main|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n")
    .replace(/<(p|div|section|article|main|ul|ol|li|h1|h2|h3|h4|h5|h6|br)[^>]*>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(stripped));
}

export function extractSameOriginLinks(html: string, baseUrl: URL, limit = 8) {
  const links = new Set<string>();
  const pattern = /<a[^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null && links.size < limit) {
    try {
      const url = new URL(match[1], baseUrl);

      if (url.origin !== baseUrl.origin) {
        continue;
      }

      if (!/^https?:$/i.test(url.protocol)) {
        continue;
      }

      url.hash = "";
      links.add(url.toString());
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

export function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function splitLongParagraph(paragraph: string, maxLength: number) {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const words = paragraph.split(/\s+/);
    const segments: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLength && current) {
        segments.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }

  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > maxLength && current) {
      segments.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

export function chunkText(value: string, maxLength = 900) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .flatMap((paragraph) =>
      paragraph.length > maxLength ? splitLongParagraph(paragraph, maxLength) : [paragraph],
    )
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length > maxLength && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function topKeywords(value: string, limit = 8) {
  const counts = new Map<string, number>();

  for (const token of tokenize(value)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function summarizeExcerpt(value: string, maxLength = 220) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength);
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > 120 ? boundary : maxLength).trim()}...`;
}

export function inferTrustedFields(value: string, fallback: string[] = []) {
  const normalized = value.toLowerCase();
  const fields = new Set(fallback);

  if (/\b(price|pricing|cost|fee|eur|usd|\$)\b/.test(normalized)) {
    fields.add("pricing");
  }

  if (/\b(hour|hours|open|closed|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(normalized)) {
    fields.add("hours");
  }

  if (/\b(book|booking|appointment|consultation|calendar|slot)\b/.test(normalized)) {
    fields.add("booking rules");
  }

  if (/\b(return|refund|exchange|policy|warranty)\b/.test(normalized)) {
    fields.add("policy");
  }

  if (/\b(delivery|shipping|ship|dispatch)\b/.test(normalized)) {
    fields.add("delivery");
  }

  if (/\b(product|catalog|chair|desk|service|consultation|showroom)\b/.test(normalized)) {
    fields.add("product and service details");
  }

  return Array.from(fields);
}

export function calculateCoverage(textLength: number, chunkCount: number, trustedFieldsCount: number) {
  return Math.max(
    48,
    Math.min(100, 36 + Math.round(textLength / 400) + chunkCount * 4 + trustedFieldsCount * 6),
  );
}

export function scoreTextAgainstQuery(value: string, query: string, keywords: string[] = []) {
  const text = value.toLowerCase();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return 0;
  }

  let score = 0;

  for (const token of queryTokens) {
    if (text.includes(token)) {
      score += 4;
    }

    if (keywords.includes(token)) {
      score += 2;
    }
  }

  const normalizedQuery = normalizeWhitespace(query).toLowerCase();
  if (normalizedQuery.length > 5 && text.includes(normalizedQuery)) {
    score += 8;
  }

  return score;
}
