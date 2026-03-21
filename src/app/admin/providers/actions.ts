"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  saveProviderCredential,
  toggleProviderCredential,
} from "@/lib/repositories/provider-credentials";
import { providerCatalog } from "@/lib/provider-catalog";

const providerValues = providerCatalog.map((entry) => entry.value);
const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const credentialInputSchema = z.object({
  provider: z
    .string()
    .refine((value) => providerValues.includes(value as (typeof providerValues)[number]), {
      message: "Select a valid provider.",
    }),
  environment: z.string().trim().min(1, "Environment is required."),
  purpose: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  secret: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  nextRotationAt: z.preprocess(blankToUndefined, z.string().optional()),
  enabled: z.enum(["true", "false"]).default("true"),
});

export interface CredentialActionState {
  status: "idle" | "success" | "error";
  message: string;
}

export const initialCredentialActionState: CredentialActionState = {
  status: "idle",
  message: "",
};

// TODO: Enforce real admin auth before exposing these mutations publicly.
export async function saveProviderCredentialAction(
  _previousState: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const parsed = credentialInputSchema.safeParse({
    provider: formData.get("provider"),
    environment: formData.get("environment"),
    purpose: formData.get("purpose"),
    secret: formData.get("secret"),
    nextRotationAt: formData.get("nextRotationAt"),
    enabled: formData.get("enabled"),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      status: "error",
      message: firstIssue?.message ?? "Invalid provider credential input.",
    };
  }

  try {
    await saveProviderCredential({
      provider: parsed.data.provider as (typeof providerValues)[number],
      environment: parsed.data.environment,
      purpose: parsed.data.purpose ?? "",
      secret: parsed.data.secret,
      nextRotationAt: parsed.data.nextRotationAt || null,
      enabled: parsed.data.enabled === "true",
    });

    revalidatePath("/admin");
    revalidatePath("/admin/providers");

    return {
      status: "success",
      message: "Provider credential saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to save provider credential.",
    };
  }
}

export async function toggleProviderCredentialAction(formData: FormData) {
  const id = formData.get("id");
  const enabled = formData.get("enabled");

  if (typeof id !== "string" || typeof enabled !== "string") {
    throw new Error("Invalid toggle request.");
  }

  await toggleProviderCredential(id, enabled === "true");

  revalidatePath("/admin");
  revalidatePath("/admin/providers");
}
