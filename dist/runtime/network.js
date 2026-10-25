export const RUNTIME_PORT_ENV_NAME = "PORT";
/** Resolve the listener port assigned by Core, falling back only when unmanaged. */
export function runtimePort(defaultPort, environment = process.env) {
    validatePort(defaultPort, "defaultPort");
    const raw = environment[RUNTIME_PORT_ENV_NAME];
    if (raw === undefined)
        return defaultPort;
    if (!/^\d+$/.test(raw))
        throw new RangeError("PORT must be an integer between 1 and 65535.");
    return validatePort(Number(raw), RUNTIME_PORT_ENV_NAME);
}
function validatePort(port, source) {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new RangeError(`${source} must be an integer between 1 and 65535.`);
    }
    return port;
}
