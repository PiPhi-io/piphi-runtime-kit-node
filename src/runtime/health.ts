import type { RuntimeDiagnosticsResponse, RuntimeHealthResponse } from "../types.js";
import { RuntimeContext } from "./context.js";

/**
 * Build a runtime health response with common support fields.
 */
export function buildRuntimeHealthResponse(
  runtime: RuntimeContext,
  options?: {
    integration?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
): RuntimeHealthResponse {
  return {
    ok: true,
    runtimeAuthPresent: Boolean(runtime.auth.containerId && runtime.auth.internalToken),
    coreClientBound: Boolean(runtime.processState.coreFetch),
    pendingTaskCount: runtime.processState.backgroundTasks.size,
    currentGeneration: runtime.processState.currentGeneration,
    configGeneration: runtime.processState.currentGeneration,
    ...(options?.integration ? { integration: options.integration } : {}),
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  };
}

/**
 * Build a runtime diagnostics response with common support fields.
 */
export function buildRuntimeDiagnosticsResponse(
  runtime: RuntimeContext,
  options?: {
    integration?: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  },
): RuntimeDiagnosticsResponse {
  return {
    ok: true,
    runtimeAuthPresent: Boolean(runtime.auth.containerId && runtime.auth.internalToken),
    coreClientBound: Boolean(runtime.processState.coreFetch),
    pendingTaskCount: runtime.processState.backgroundTasks.size,
    currentGeneration: runtime.processState.currentGeneration,
    configGeneration: runtime.processState.currentGeneration,
    ...(options?.integration ? { integration: options.integration } : {}),
    ...(options?.diagnostics ? { diagnostics: options.diagnostics } : {}),
  };
}
