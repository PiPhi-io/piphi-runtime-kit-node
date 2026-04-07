import type { RuntimeDiagnosticsResponse, RuntimeHealthResponse } from "../types.js";
import { RuntimeContext } from "./context.js";
/**
 * Build a runtime health response with common support fields.
 */
export declare function buildRuntimeHealthResponse(runtime: RuntimeContext, options?: {
    integration?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}): RuntimeHealthResponse;
/**
 * Build a runtime diagnostics response with common support fields.
 */
export declare function buildRuntimeDiagnosticsResponse(runtime: RuntimeContext, options?: {
    integration?: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
}): RuntimeDiagnosticsResponse;
