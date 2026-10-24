import assert from "node:assert/strict";
import test from "node:test";

import {
  ONBOARDING_MODES,
  validateOnboardingDeclaration,
} from "../dist/index.js";

test("accepts every canonical onboarding mode", () => {
  for (const mode of ONBOARDING_MODES) {
    assert.deepEqual(validateOnboardingDeclaration({ mode }), { mode });
  }
});

test("rejects runtime discovery strategies as onboarding modes", () => {
  assert.throws(
    () => validateOnboardingDeclaration({ mode: "passive" }),
    /onboarding\.mode must be one of/,
  );
});

test("rejects undeclared onboarding fields", () => {
  assert.throws(
    () => validateOnboardingDeclaration({ mode: "manual", discovery: "mdns" }),
    /may only declare mode/,
  );
});
