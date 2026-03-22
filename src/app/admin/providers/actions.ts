"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedAdmin } from "@/lib/auth/admin-session";
import {
  saveProviderCredential,
  toggleProviderCredential,
} from "@/lib/repositories/provider-credentials";
import {
  providerCatalog,
  providerFieldCatalog,
} from "@/lib/provider-catalog";

const providerValues = providerCatalog.map((entry) => entry.value);
const providerFieldValues = providerFieldCatalog.map((entry) => entry.key);
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
  configKey: z
    .string()
    .refine((value) => providerFieldValues.includes(value as (typeof providerFieldValues)[number]), {
      message: "Select a valid config key.",
    }),
  environment: z.string().trim().min(1, "Environment is required."),
  purpose: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  value: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
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

export async function saveProviderCredentialAction(
  _previousState: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const admin = await requireAuthenticatedAdmin("/admin/providers");
  const parsed = credentialInputSchema.safeParse({
    provider: formData.get("provider"),
    configKey: formData.get("configKey"),
    environment: formData.get("environment"),
    purpose: formData.get("purpose"),
    value: formData.get("value"),
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
      configKey: parsed.data.configKey as (typeof providerFieldValues)[number],
      environment: parsed.data.environment,
      purpose: parsed.data.purpose ?? "",
      value: parsed.data.value,
      nextRotationAt: parsed.data.nextRotationAt || null,
      enabled: parsed.data.enabled === "true",
      actor: admin.email,
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
  const admin = await requireAuthenticatedAdmin("/admin/providers");
  const id = formData.get("id");
  const enabled = formData.get("enabled");

  if (typeof id !== "string" || typeof enabled !== "string") {
    throw new Error("Invalid toggle request.");
  }

  await toggleProviderCredential(id, enabled === "true", admin.email);

  revalidatePath("/admin");
  revalidatePath("/admin/providers");
}
