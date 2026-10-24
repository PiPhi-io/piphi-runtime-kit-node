/** Homeowner-facing first-use modes supported by PiPhi Core. */
export const ONBOARDING_MODES = [
    "manual",
    "discovery",
    "account",
    "service",
    "none",
];
/** Validate an integration manifest's `onboarding` object. */
export function validateOnboardingDeclaration(value) {
    if (!isRecord(value)) {
        throw new TypeError("onboarding must be an object");
    }
    const keys = Object.keys(value);
    if (keys.length !== 1 || keys[0] !== "mode") {
        throw new TypeError("onboarding may only declare mode");
    }
    if (!ONBOARDING_MODES.includes(value.mode)) {
        throw new TypeError(`onboarding.mode must be one of: ${ONBOARDING_MODES.join(", ")}`);
    }
    return { mode: value.mode };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
