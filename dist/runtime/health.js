/**
 * Build a runtime health response with common support fields.
 */
export function buildRuntimeHealthResponse(runtime, options) {
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
export function buildRuntimeDiagnosticsResponse(runtime, options) {
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
