import test from "node:test";
import assert from "node:assert/strict";
import { finishImageCleanup } from "../src/lib/image-cleanup";
test("image cleanup confirms absence before completing even after uncertain delete transport", async () => {
  const calls: string[] = [];
  assert.equal(
    await finishImageCleanup({
      remove: async () => {
        calls.push("remove");
        throw new Error("network");
      },
      exists: async () => {
        calls.push("exists");
        return false;
      },
      complete: async () => {
        calls.push("complete");
      },
    }),
    "completed",
  );
  assert.deepEqual(calls, ["remove", "exists", "complete"]);
});
test("image cleanup keeps its durable pending job on existing object, auth or completion uncertainty", async () => {
  let completed = 0;
  for (const exists of [
    async () => true,
    async (): Promise<boolean> => {
      throw new Error("permission");
    },
  ]) {
    assert.equal(
      await finishImageCleanup({
        remove: async () => {},
        exists,
        complete: async () => {
          completed++;
        },
      }),
      "pending",
    );
  }
  assert.equal(completed, 0);
  assert.equal(
    await finishImageCleanup({
      remove: async () => {},
      exists: async () => false,
      complete: async () => {
        throw new Error("unknown completion");
      },
    }),
    "pending",
  );
});
test("image cleanup handles an already missing object idempotently", async () => {
  let called = 0;
  assert.equal(
    await finishImageCleanup({
      remove: async () => [],
      exists: async () => false,
      complete: async () => {
        called++;
      },
    }),
    "completed",
  );
  assert.equal(called, 1);
});
