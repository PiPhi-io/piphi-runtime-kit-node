export declare const RUNTIME_PORT_ENV_NAME: "PORT";
/** Resolve the listener port assigned by Core, falling back only when unmanaged. */
export declare function runtimePort(defaultPort: number, environment?: Readonly<Record<string, string | undefined>>): number;
