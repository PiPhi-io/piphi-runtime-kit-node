/** Homeowner-facing first-use modes supported by PiPhi Core. */
export declare const ONBOARDING_MODES: readonly ["manual", "discovery", "account", "service", "none"];
export type OnboardingMode = (typeof ONBOARDING_MODES)[number];
export interface OnboardingDeclaration {
    mode: OnboardingMode;
}
/** Validate an integration manifest's `onboarding` object. */
export declare function validateOnboardingDeclaration(value: unknown): OnboardingDeclaration;
