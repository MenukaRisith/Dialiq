"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ingestUploadedKnowledgeFile, ingestWebsiteKnowledge } from "@/lib/repositories/knowledge-base";
import { DEFAULT_TENANT_ID } from "@/lib/repositories/workspace-operations";

function buildRedirectUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/workspace/knowledge?${query}` : "/workspace/knowledge";
}

function messageForError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The knowledge source could not be processed.";
}

export async function ingestWebsiteKnowledgeAction(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const workspaceSlug = String(formData.get("workspaceSlug") ?? DEFAULT_TENANT_ID);
  let destination = buildRedirectUrl({ notice: "Website synced." });

  try {
    await ingestWebsiteKnowledge({
      workspaceSlug,
      url,
    });
    revalidatePath("/workspace/knowledge");
  } catch (error) {
    destination = buildRedirectUrl({ error: messageForError(error) });
  }

  redirect(destination);
}

export async function ingestKnowledgeFileAction(formData: FormData) {
  const file = formData.get("knowledgeFile");
  const workspaceSlug = String(formData.get("workspaceSlug") ?? DEFAULT_TENANT_ID);
  let destination = buildRedirectUrl({ notice: "Document uploaded." });

  try {
    if (!(file instanceof File)) {
      throw new Error("Choose a Markdown or PDF file.");
    }

    await ingestUploadedKnowledgeFile({
      workspaceSlug,
      file,
    });
    revalidatePath("/workspace/knowledge");
  } catch (error) {
    destination = buildRedirectUrl({ error: messageForError(error) });
  }

  redirect(destination);
}
