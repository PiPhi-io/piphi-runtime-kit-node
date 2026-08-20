import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
/**
 * Shared runtime context for one integration process.
 */
export declare class RuntimeContext {
    readonly auth: RuntimeAuthContext;
    readonly processState: RuntimeProcessState;
    constructor(options?: {
        auth?: RuntimeAuthContext;
        processState?: RuntimeProcessState;
    });
    /**
     * Bind a shared fetch implementation for Core calls.
     */
    setCoreFetch(coreFetch: typeof fetch | null): void;
    /**
     * Set the active config generation for this runtime.
     */
    setCurrentGeneration(generation: number | null): void;
}
