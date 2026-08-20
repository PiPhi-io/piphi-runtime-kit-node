import { type RuntimeAuthHeaders } from "../runtime/auth.js";
import { type RuntimeContext } from "../runtime/context.js";
import { AutomationRegistry, type AutomationActionRequest, type AutomationActionResult } from "../automations.js";
type FastifyHeaderValue = string | string[] | undefined;
export interface FastifyLikeRequest {
    headers: Record<string, FastifyHeaderValue>;
    body?: unknown;
}
export declare function readFastifyHeaderValue(value: FastifyHeaderValue): string | undefined;
export declare function getPayloadContainerIdFromFastifyBody(body: unknown): string | null;
export declare function syncRuntimeAuthFromFastifyRequest(runtime: RuntimeContext, req: FastifyLikeRequest, payloadContainerId?: string | null): RuntimeAuthHeaders;
export declare function formatFastifyRuntimeAuthSyncLog(req: FastifyLikeRequest, payloadContainerId?: string | null): string;
/** Dispatch an automation command while honoring Core's idempotency header. */
export declare function dispatchAutomationActionFromFastify(registry: AutomationRegistry, req: FastifyLikeRequest, payload?: AutomationActionRequest | Record<string, unknown>): Promise<AutomationActionResult>;
export {};
