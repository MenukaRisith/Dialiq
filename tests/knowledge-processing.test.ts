import { describe, expect, it } from "vitest";

import {
  chunkText,
  extractHtmlText,
  stripMarkdown,
  summarizeExcerpt,
  topKeywords,
} from "@/lib/knowledge/text-processing";

describe("knowledge text processing", () => {
  it("extracts readable text from html content", () => {
    const text = extractHtmlText(`
      <html>
        <body>
          <h1>Showroom Visits</h1>
          <p>Our showroom is open Monday to Friday from 9 AM to 6 PM.</p>
          <script>console.log("ignore me")</script>
        </body>
      </html>
    `);

    expect(text).toContain("Showroom Visits");
    expect(text).toContain("Monday to Friday from 9 AM to 6 PM");
    expect(text).not.toContain("ignore me");
  });

  it("converts markdown into chunkable plain text with keywords", () => {
    const markdown = `
      # Booking Policy

      Customers can book a discovery consultation for next week.

      - Consultation length: 45 minutes
      - Price range: from 80 EUR
    `;
    const plainText = stripMarkdown(markdown);
    const chunks = chunkText(plainText, 80);
    const keywords = topKeywords(plainText);

    expect(plainText).toContain("Booking Policy");
    expect(chunks.length).toBeGreaterThan(1);
    expect(keywords).toContain("consultation");
    expect(summarizeExcerpt(plainText, 90)).toContain("discovery consultation");
  });
});
