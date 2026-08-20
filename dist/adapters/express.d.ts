import { type RuntimeAuthHeaders } from "../runtime/auth.js";
import { type RuntimeContext } from "../runtime/context.js";
import { AutomationRegistry, type AutomationActionRequest, type AutomationActionResult } from "../automations.js";
type ExpressHeaderValue = string | string[] | undefined;
export interface ExpressLikeRequest {
    headers: Record<string, ExpressHeaderValue>;
    body?: unknown;
    header(name: string): ExpressHeaderValue;
}
export declare function readExpressHeaderValue(value: ExpressHeaderValue): string | undefined;
export declare function getPayloadContainerIdFromExpressBody(body: unknown): string | null;
export declare function syncRuntimeAuthFromExpressRequest(runtime: RuntimeContext, req: ExpressLikeRequest, payloadContainerId?: string | null): RuntimeAuthHeaders;
export declare function formatExpressRuntimeAuthSyncLog(req: ExpressLikeRequest, payloadContainerId?: string | null): string;
/** Dispatch an automation command while honoring Core's idempotency header. */
export declare function dispatchAutomationActionFromExpress(registry: AutomationRegistry, req: ExpressLikeRequest, payload?: AutomationActionRequest | Record<string, unknown>): Promise<AutomationActionResult>;
export {};
