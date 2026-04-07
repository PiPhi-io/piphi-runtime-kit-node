import type { IntegrationDiscoveryResponse } from "../types.js";
/**
 * Normalize discovery inputs by trimming strings and dropping empty values.
 */
export declare function normalizeDiscoveryInputs(inputs: Record<string, unknown> | undefined): Record<string, unknown>;
/**
 * Build a consistent discovery response payload.
 */
export declare function buildDiscoveryResponse<TDevice extends object>(devices: Iterable<TDevice>): IntegrationDiscoveryResponse<TDevice>;
/**
 * Format a safe discovery attempt log line.
 */
export declare function formatDiscoveryAttemptLog(inputs: Record<string, unknown>): string;
