import test from "node:test";
import assert from "node:assert/strict";
import { prototypeEnabled } from "../src/lib/prototype";
test("prototype guard is enabled unless explicitly disabled", () => {
  assert.equal(prototypeEnabled("true"), true);
  assert.equal(prototypeEnabled(""), true);
  assert.equal(prototypeEnabled("typo"), true);
  assert.equal(prototypeEnabled("false"), false);
});
