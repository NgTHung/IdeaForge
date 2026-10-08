import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});

const { signupPasswordError } = await import("../src/lib/password-policy.ts");

test("sign-up password policy requires eight characters, a letter, and a number", () => {
  assert.match(signupPasswordError("A1short") ?? "", /at least 8/);
  assert.equal(signupPasswordError("12345678"), "Include at least one letter.");
  assert.equal(signupPasswordError("abcdefgh"), "Include at least one number.");
  assert.equal(signupPasswordError("abcdefgh1"), null);
  assert.equal(signupPasswordError("àààààààà1"), null);
  assert.match(signupPasswordError(`${"A".repeat(128)}1`) ?? "", /128 characters/);
});
