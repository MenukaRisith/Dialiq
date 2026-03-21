import { createHash } from "node:crypto";

import { KnowledgeDocumentKind, KnowledgeSourceType, Prisma } from "@prisma/client";
import { PDFParse } from "pdf-parse";

import { AppError } from "@/lib/api/route-handler";
import { appConfig } from "@/lib/config/env";
import { getPrismaClient, isDatabaseConfigured, withDatabaseTimeout } from "@/lib/db/prisma";
import {
  calculateCoverage,
  chunkText,
  extractHtmlText,
  extractHtmlTitle,
  extractSameOriginLinks,
  inferTrustedFields,
  normalizeWhitespace,
  scoreTextAgainstQuery,
  stripMarkdown,
  summarizeExcerpt,
  tokenize,
  topKeywords,
} from "@/lib/knowledge/text-processing";
import { logError } from "@/lib/observability/logger";
import type { KnowledgeDocumentSummary } from "@/lib/types";

const WEBSITE_PAGE_LIMIT = 6;
const WEBSITE_MAX_TEXT_LENGTH = 18_000;
const WEBSITE_FETCH_TIMEOUT_MS = 4_000;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

interface ResolvedWorkspace {
  id: string;
  slug: string;
  name: string;
}

interface PreparedKnowledgeDocument {
  title: string;
  kind: KnowledgeDocumentKind;
  sourceUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  rawText: string;
  checksum: string;
  metadata?: Prisma.InputJsonValue;
}

export interface RetrievedKnowledgeMatch {
  documentTitle: string;
  excerpt: string;
  sourceLabel: string;
  trustedSource: string;
  sourceUrl?: string | null;
  score: number;
}

function ensureKnowledgeStorageReady() {
  if (!isDatabaseConfigured()) {
    throw new AppError("DATABASE_URL is required for knowledge ingestion.", {
      statusCode: 500,
      code: "DATABASE_NOT_CONFIGURED",
    });
  }
}

async function resolveWorkspace(workspaceSlug: string): Promise<ResolvedWorkspace> {
  ensureKnowledgeStorageReady();
  const prisma = getPrismaClient();
  const workspace = await withDatabaseTimeout(
    prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    }),
    "Knowledge workspace lookup",
  );

  if (!workspace) {
    throw new AppError(`Workspace "${workspaceSlug}" was not found.`, {
      statusCode: 404,
      code: "WORKSPACE_NOT_FOUND",
    });
  }

  return workspace;
}

function normalizeUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (!/^https?:$/i.test(url.protocol)) {
      throw new Error("Unsupported protocol");
    }

    url.hash = "";
    return url.toString();
  } catch {
    throw new AppError("Enter a valid website URL.", {
      statusCode: 400,
      code: "INVALID_WEBSITE_URL",
    });
  }
}

async function fetchWebsitePage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": `${appConfig.name}/1.0 knowledge-ingestion`,
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new AppError(`Website fetch failed with status ${response.status}.`, {
        statusCode: 400,
        code: "WEBSITE_FETCH_FAILED",
      });
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("text/html")) {
      throw new AppError("The provided URL did not return an HTML page.", {
        statusCode: 400,
        code: "WEBSITE_NOT_HTML",
      });
    }

    return response.text();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("The website could not be fetched within the allowed time.", {
      statusCode: 400,
      code: "WEBSITE_FETCH_TIMEOUT",
      details: error instanceof Error ? error.message : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlWebsiteDocuments(inputUrl: string) {
  const rootUrl = new URL(normalizeUrl(inputUrl));
  const queue = [rootUrl.toString()];
  const visited = new Set<string>();
  const documents: PreparedKnowledgeDocument[] = [];

  while (queue.length > 0 && documents.length < WEBSITE_PAGE_LIMIT) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const html = await fetchWebsitePage(currentUrl);
      const title = extractHtmlTitle(html) ?? `${rootUrl.hostname} page`;
      const rawText = extractHtmlText(html).slice(0, WEBSITE_MAX_TEXT_LENGTH);

      if (rawText.length < 180) {
        continue;
      }

      documents.push({
        title,
        kind: KnowledgeDocumentKind.WEBSITE_PAGE,
        sourceUrl: currentUrl,
        rawText,
        checksum: createHash("sha256").update(rawText).digest("hex"),
        metadata: {
          origin: rootUrl.hostname,
        },
      });

      for (const link of extractSameOriginLinks(html, new URL(currentUrl), WEBSITE_PAGE_LIMIT * 2)) {
        if (!visited.has(link) && queue.length < WEBSITE_PAGE_LIMIT * 2) {
          queue.push(link);
        }
      }
    } catch (error) {
      logError("knowledge.website_page_failed", error, {
        url: currentUrl,
      });
    }
  }

  if (documents.length === 0) {
    throw new AppError("No usable website content was extracted from that URL.", {
      statusCode: 400,
      code: "WEBSITE_CONTENT_EMPTY",
    });
  }

  return {
    sourceName: rootUrl.hostname.replace(/^www\./i, ""),
    sourceType: KnowledgeSourceType.WEBSITE,
    sourceUrl: rootUrl.toString(),
    documents,
  };
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

async function prepareUploadedDocument(file: File): Promise<{
  sourceName: string;
  sourceType: KnowledgeSourceType;
  documents: PreparedKnowledgeDocument[];
}> {
  if (!file.name) {
    throw new AppError("Choose a Markdown or PDF file.", {
      statusCode: 400,
      code: "FILE_REQUIRED",
    });
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError("Files must be between 1 byte and 8 MB.", {
      statusCode: 400,
      code: "INVALID_FILE_SIZE",
    });
  }

  const extension = getFileExtension(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  let rawText = "";
  let kind: KnowledgeDocumentKind;
  let sourceType: KnowledgeSourceType;

  if (extension === "md" || extension === "markdown" || file.type.includes("markdown")) {
    rawText = stripMarkdown(bytes.toString("utf8"));
    kind = KnowledgeDocumentKind.MARKDOWN;
    sourceType = KnowledgeSourceType.DOCUMENT;
  } else if (extension === "pdf" || file.type === "application/pdf") {
    const parser = new PDFParse({ data: bytes });
    const parsed = await parser.getText();
    await parser.destroy();
    rawText = normalizeWhitespace(parsed.text);
    kind = KnowledgeDocumentKind.PDF;
    sourceType = KnowledgeSourceType.PDF;
  } else {
    throw new AppError("Only .md and .pdf uploads are supported in this MVP.", {
      statusCode: 400,
      code: "UNSUPPORTED_FILE_TYPE",
    });
  }

  if (rawText.length < 120) {
    throw new AppError("The uploaded file did not contain enough readable text.", {
      statusCode: 400,
      code: "FILE_CONTENT_EMPTY",
    });
  }

  const title = file.name.replace(/\.[^.]+$/, "");
  return {
    sourceName: file.name,
    sourceType,
    documents: [
      {
        title,
        kind,
        fileName: file.name,
        mimeType: file.type || undefined,
        rawText,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        metadata: {
          sizeBytes: file.size,
        },
      },
    ],
  };
}

async function upsertKnowledgeSourceWithDocuments(input: {
  workspace: ResolvedWorkspace;
  name: string;
  type: KnowledgeSourceType;
  sourceUrl?: string;
  documents: PreparedKnowledgeDocument[];
}) {
  ensureKnowledgeStorageReady();
  const prisma = getPrismaClient();
  const textLength = input.documents.reduce((total, document) => total + document.rawText.length, 0);
  const chunkedDocuments = input.documents.map((document) => {
    const chunks = chunkText(document.rawText).map((content, index) => ({
      chunkIndex: index,
      content,
      tokenCount: tokenize(content).length,
      keywords: topKeywords(content),
    }));

    return {
      ...document,
      chunks,
    };
  });
  const chunkCount = chunkedDocuments.reduce((total, document) => total + document.chunks.length, 0);
  const trustedFields = inferTrustedFields(
    chunkedDocuments.map((document) => document.rawText).join("\n\n"),
    input.type === KnowledgeSourceType.WEBSITE ? ["website content"] : ["uploaded document"],
  );
  const coverage = calculateCoverage(textLength, chunkCount, trustedFields.length);

  return withDatabaseTimeout(
    prisma.$transaction(async (tx) => {
      const existingSource = await tx.knowledgeSource.findFirst({
        where: {
          workspaceId: input.workspace.id,
          name: input.name,
          type: input.type,
          sourceUrl: input.sourceUrl ?? null,
        },
        select: {
          id: true,
        },
      });

      const source = existingSource
        ? await tx.knowledgeSource.update({
            where: { id: existingSource.id },
            data: {
              status: "healthy",
              items: input.documents.length,
              coverage,
              sourceUrl: input.sourceUrl ?? null,
              trustedFields,
              lastSyncedAt: new Date(),
            },
          })
        : await tx.knowledgeSource.create({
            data: {
              workspaceId: input.workspace.id,
              name: input.name,
              type: input.type,
              status: "healthy",
              items: input.documents.length,
              coverage,
              sourceUrl: input.sourceUrl ?? null,
              trustedFields,
              lastSyncedAt: new Date(),
            },
          });

      if (existingSource) {
        await tx.knowledgeDocument.deleteMany({
          where: {
            knowledgeSourceId: source.id,
          },
        });
      }

      for (const document of chunkedDocuments) {
        const createdDocument = await tx.knowledgeDocument.create({
          data: {
            workspaceId: input.workspace.id,
            knowledgeSourceId: source.id,
            title: document.title,
            kind: document.kind,
            sourceUrl: document.sourceUrl ?? null,
            fileName: document.fileName ?? null,
            mimeType: document.mimeType ?? null,
            checksum: document.checksum,
            rawText: document.rawText,
            metadata: document.metadata ?? undefined,
          },
        });

        if (document.chunks.length > 0) {
          await tx.knowledgeChunk.createMany({
            data: document.chunks.map((chunk) => ({
              workspaceId: input.workspace.id,
              documentId: createdDocument.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              keywords: chunk.keywords,
            })),
          });
        }
      }

      return {
        sourceId: source.id,
        sourceName: source.name,
        documentCount: input.documents.length,
        chunkCount,
      };
    }),
    "Knowledge source save",
  );
}

function formatRelativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function mapDocumentKind(kind: KnowledgeDocumentKind): KnowledgeDocumentSummary["kind"] {
  if (kind === KnowledgeDocumentKind.PDF) {
    return "pdf";
  }

  if (kind === KnowledgeDocumentKind.MARKDOWN) {
    return "markdown";
  }

  return "website-page";
}

export async function ingestWebsiteKnowledge(input: {
  workspaceSlug: string;
  url: string;
}) {
  const workspace = await resolveWorkspace(input.workspaceSlug);
  const prepared = await crawlWebsiteDocuments(input.url);

  return upsertKnowledgeSourceWithDocuments({
    workspace,
    name: prepared.sourceName,
    type: prepared.sourceType,
    sourceUrl: prepared.sourceUrl,
    documents: prepared.documents,
  });
}

export async function ingestUploadedKnowledgeFile(input: {
  workspaceSlug: string;
  file: File;
}) {
  const workspace = await resolveWorkspace(input.workspaceSlug);
  const prepared = await prepareUploadedDocument(input.file);

  return upsertKnowledgeSourceWithDocuments({
    workspace,
    name: prepared.sourceName,
    type: prepared.sourceType,
    documents: prepared.documents,
  });
}

export async function listKnowledgeDocuments(workspaceSlug: string): Promise<KnowledgeDocumentSummary[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const workspace = await resolveWorkspace(workspaceSlug);
    const prisma = getPrismaClient();
    const documents = await withDatabaseTimeout(
      prisma.knowledgeDocument.findMany({
        where: {
          workspaceId: workspace.id,
        },
        include: {
          knowledgeSource: {
            select: {
              name: true,
              sourceUrl: true,
            },
          },
          chunks: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 12,
      }),
      "Knowledge document list",
    );

    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      kind: mapDocumentKind(document.kind),
      sourceLabel:
        document.knowledgeSource?.name ??
        document.fileName ??
        document.sourceUrl ??
        workspace.name,
      excerpt: summarizeExcerpt(document.rawText),
      chunkCount: document.chunks.length,
      updatedAt: formatRelativeDate(document.updatedAt),
      sourceUrl: document.sourceUrl ?? document.knowledgeSource?.sourceUrl ?? null,
    }));
  } catch (error) {
    logError("knowledge.document_list_failed", error, {
      workspaceSlug,
    });
    return [];
  }
}

export async function retrieveKnowledgeMatches(input: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedKnowledgeMatch[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const queryTokens = tokenize(input.query).slice(0, 6);

  if (queryTokens.length === 0) {
    return [];
  }

  try {
    const prisma = getPrismaClient();
    const chunks = await withDatabaseTimeout(
      prisma.knowledgeChunk.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: queryTokens.map((token) => ({
            content: {
              contains: token,
            },
          })),
        },
        include: {
          document: {
            select: {
              title: true,
              sourceUrl: true,
              fileName: true,
              knowledgeSource: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        take: 40,
      }),
      "Knowledge retrieval read",
    );

    return chunks
      .map((chunk) => {
        const keywords = Array.isArray(chunk.keywords)
          ? chunk.keywords.filter((keyword): keyword is string => typeof keyword === "string")
          : [];
        const score =
          scoreTextAgainstQuery(chunk.content, input.query, keywords) +
          scoreTextAgainstQuery(chunk.document.title, input.query);

        return {
          documentTitle: chunk.document.title,
          excerpt: summarizeExcerpt(chunk.content, 240),
          sourceLabel:
            chunk.document.knowledgeSource?.name ??
            chunk.document.fileName ??
            chunk.document.sourceUrl ??
            chunk.document.title,
          trustedSource:
            chunk.document.knowledgeSource?.name ??
            chunk.document.fileName ??
            chunk.document.title,
          sourceUrl: chunk.document.sourceUrl,
          score,
        };
      })
      .filter((chunk) => chunk.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.limit ?? 4);
  } catch (error) {
    logError("knowledge.retrieval_failed", error, {
      workspaceId: input.workspaceId,
    });
    return [];
  }
}
