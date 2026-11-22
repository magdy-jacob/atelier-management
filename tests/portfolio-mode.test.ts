import test from "node:test";
import assert from "node:assert/strict";
import {
  functionalPortfolioEnabled,
  portfolioWriteContext,
} from "../src/lib/portfolio-mode";
test("functional portfolio is explicit and keeps prototype context fail-closed", () => {
  for (const value of ["", "false", "TRUE", "1"])
    assert.equal(functionalPortfolioEnabled(value), false);
  assert.equal(functionalPortfolioEnabled("true"), true);
  for (const functional of [false, true])
    for (const databaseSynthetic of [false, true])
      assert.equal(
        portfolioWriteContext({
          prototype: true,
          functional,
          databaseSynthetic,
        }),
        functional && databaseSynthetic,
      );
});
