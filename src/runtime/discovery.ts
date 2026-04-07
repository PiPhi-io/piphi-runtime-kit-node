import type { IntegrationDiscoveryResponse } from "../types.js";

/**
 * Normalize discovery inputs by trimming strings and dropping empty values.
 */
export function normalizeDiscoveryInputs(
  inputs: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputs ?? {})) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        normalized[key] = trimmed;
      }
      continue;
    }
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Build a consistent discovery response payload.
 */
export function buildDiscoveryResponse<TDevice extends object>(
  devices: Iterable<TDevice>,
): IntegrationDiscoveryResponse<TDevice> {
  return { devices: Array.from(devices) };
}

/**
 * Format a safe discovery attempt log line.
 */
export function formatDiscoveryAttemptLog(
  inputs: Record<string, unknown>,
): string {
  const inputKeys = Object.keys(inputs).sort();
  return [
    "discovery_attempt",
    `input_keys=${JSON.stringify(inputKeys)}`,
    `uses_username=${String(Boolean(inputs.username))}`,
    `uses_email=${String(Boolean(inputs.email))}`,
    `uses_password=${String(Boolean(inputs.password))}`,
  ].join(" ");
}
