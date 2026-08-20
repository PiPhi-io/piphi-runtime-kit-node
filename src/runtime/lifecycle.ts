import { RuntimeContext } from "./context.js";
import { shutdownBackgroundTasks } from "./tasks.js";

export const DEFAULT_RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export const DEFAULT_RUNTIME_INTERNAL_TOKEN_ENV_NAME = "PIPHI_INTEGRATION_INTERNAL_TOKEN";
export const DEFAULT_CORE_CLIENT_TIMEOUT_MS = 10_000;

export interface RuntimeEnvironment { [key: string]: string | undefined }

export function bootstrapRuntimeAuthFromEnv(
  runtime: RuntimeContext,
  options: { env?: RuntimeEnvironment; containerEnvName?: string; tokenEnvName?: string } = {},
): { containerId: string; internalToken: string } {
  const env = options.env ?? process.env;
  const containerId = (env[options.containerEnvName ?? DEFAULT_RUNTIME_CONTAINER_ID_ENV_NAME] ?? "").trim();
  const internalToken = (env[options.tokenEnvName ?? DEFAULT_RUNTIME_INTERNAL_TOKEN_ENV_NAME] ?? "").trim();
  runtime.auth.update({ containerId, internalToken });
  return { containerId, internalToken };
}

export function createCoreFetch(options: {
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
} = {}): typeof fetch {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CORE_CLIENT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be greater than zero");
  return async (input, init = {}) => {
    if (init.signal !== undefined && init.signal !== null) return fetchImplementation(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImplementation(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export async function withCoreFetch<T>(
  runtime: RuntimeContext,
  callback: (coreFetch: typeof fetch) => Promise<T>,
  options: { coreFetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<T> {
  const coreFetch = options.coreFetch ?? createCoreFetch(
    options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs },
  );
  runtime.setCoreFetch(coreFetch);
  try { return await callback(coreFetch); }
  finally { runtime.setCoreFetch(null); }
}

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

export async function runRuntimeLifecycle<T>(
  runtime: RuntimeContext,
  options: RuntimeLifecycleOptions<T>,
): Promise<T> {
  bootstrapRuntimeAuthFromEnv(runtime, options);
  return withCoreFetch(runtime, async (coreFetch) => {
    await options.onStartup?.(runtime, coreFetch);
    try { return await options.run(runtime); }
    finally {
      await shutdownBackgroundTasks(
        runtime.processState,
        options.backgroundTaskGracePeriodMs === undefined
          ? {}
          : { gracePeriodMs: options.backgroundTaskGracePeriodMs },
      );
      await options.onShutdown?.(runtime);
    }
  }, {
    ...(options.coreFetch === undefined ? {} : { coreFetch: options.coreFetch }),
    ...(options.coreClientTimeoutMs === undefined ? {} : { timeoutMs: options.coreClientTimeoutMs }),
  });
}

export const bootstrap_runtime_auth_from_env = bootstrapRuntimeAuthFromEnv;
export const runtime_lifespan = runRuntimeLifecycle;
