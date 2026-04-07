import { type RuntimeAuthHeaders } from "../runtime/auth.js";
import { type RuntimeContext } from "../runtime/context.js";
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
export {};
