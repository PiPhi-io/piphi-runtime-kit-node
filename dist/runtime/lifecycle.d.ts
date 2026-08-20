import { RuntimeContext } from "./context.js";
export declare const DEFAULT_RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export declare const DEFAULT_RUNTIME_INTERNAL_TOKEN_ENV_NAME = "PIPHI_INTEGRATION_INTERNAL_TOKEN";
export declare const DEFAULT_CORE_CLIENT_TIMEOUT_MS = 10000;
export interface RuntimeEnvironment {
    [key: string]: string | undefined;
}
export declare function bootstrapRuntimeAuthFromEnv(runtime: RuntimeContext, options?: {
    env?: RuntimeEnvironment;
    containerEnvName?: string;
    tokenEnvName?: string;
}): {
    containerId: string;
    internalToken: string;
};
export declare function createCoreFetch(options?: {
    fetchImplementation?: typeof fetch;
    timeoutMs?: number;
}): typeof fetch;
export declare function withCoreFetch<T>(runtime: RuntimeContext, callback: (coreFetch: typeof fetch) => Promise<T>, options?: {
    coreFetch?: typeof fetch;
    timeoutMs?: number;
}): Promise<T>;
export interface RuntimeLifecycleOptions<T> {
    env?: RuntimeEnvironment;
    containerEnvName?: string;
    tokenEnvName?: string;
    coreFetch?: typeof fetch;
    coreClientTimeoutMs?: number;
    backgroundTaskGracePeriodMs?: number;
    onStartup?: (runtime: RuntimeContext, coreFetch: typeof fetch) => Promise<void>;
    run: (runtime: RuntimeContext) => Promise<T>;
    onShutdown?: (runtime: RuntimeContext) => Promise<void>;
}
export declare function runRuntimeLifecycle<T>(runtime: RuntimeContext, options: RuntimeLifecycleOptions<T>): Promise<T>;
export declare const bootstrap_runtime_auth_from_env: typeof bootstrapRuntimeAuthFromEnv;
export declare const runtime_lifespan: typeof runRuntimeLifecycle;
