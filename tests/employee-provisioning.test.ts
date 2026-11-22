import test from "node:test";
import assert from "node:assert/strict";
import {
  provisionEmployee,
  validEmployeePassword,
  type EmployeeJob,
  type EmployeeIdentity,
} from "../src/lib/employee-provisioning";
const job: EmployeeJob = {
  id: "job",
  user_id: "fixed-target",
  actor_id: "admin",
  full_name: "اختبار موظف",
  email: "test-staff@example.invalid",
  status: "pending",
};
const identity: EmployeeIdentity = {
  id: job.user_id,
  email: job.email,
  app_metadata: { lovely_staff_job: job.id, lovely_staff_actor: job.actor_id },
};
const unknown = async () => {
  throw new Error("unknown response");
};
test("employee creation binds the fixed provider identity before completing the profile", async () => {
  let created = 0,
    completed = 0;
  assert.deepEqual(
    await provisionEmployee(job, "ephemeral", {
      read: async () => null,
      create: async (p) => {
        assert.equal(p, "ephemeral");
        created++;
        return identity;
      },
      complete: async () => {
        completed++;
      },
    }),
    { status: "completed", recovered: false },
  );
  assert.equal(created, 1);
  assert.equal(completed, 1);
});
test("an existing same-job identity recovers without applying a newly submitted password", async () => {
  let creates = 0;
  assert.deepEqual(
    await provisionEmployee(job, "different", {
      read: async () => identity,
      create: async () => {
        creates++;
        return identity;
      },
      complete: async () => {},
    }),
    { status: "completed", recovered: true },
  );
  assert.equal(creates, 0);
});
test("uncertain provider reads never authorize account creation", async () => {
  let creates = 0;
  assert.deepEqual(
    await provisionEmployee(job, "value", {
      read: unknown,
      create: async () => {
        creates++;
        return identity;
      },
      complete: async () => {},
    }),
    { status: "pending" },
  );
  assert.equal(creates, 0);
});
test("a lost create response can recover only the exact fixed target", async () => {
  let reads = 0;
  assert.deepEqual(
    await provisionEmployee(job, "value", {
      read: async () => (++reads === 1 ? null : identity),
      create: unknown,
      complete: async () => {},
    }),
    { status: "completed", recovered: true },
  );
  assert.equal(reads, 2);
});
test("uncertain create and reread remain pending without cleanup or a second target", async () => {
  let reads = 0,
    creates = 0,
    completes = 0;
  assert.deepEqual(
    await provisionEmployee(job, "value", {
      read: async () => {
        if (++reads === 1) return null;
        throw new Error("unknown");
      },
      create: async () => {
        creates++;
        throw new Error("unknown");
      },
      complete: async () => {
        completes++;
      },
    }),
    { status: "pending" },
  );
  assert.equal(creates, 1);
  assert.equal(completes, 0);
});
for (const [label, value] of Object.entries({
  id: { ...identity, id: "different" },
  email: { ...identity, email: "other@example.invalid" },
  job: {
    ...identity,
    app_metadata: { ...identity.app_metadata, lovely_staff_job: "other" },
  },
  actor: {
    ...identity,
    app_metadata: { ...identity.app_metadata, lovely_staff_actor: "other" },
  },
  missingMetadata: { ...identity, app_metadata: undefined },
}))
  test(`provider ${label} mismatch cannot complete an employee`, async () => {
    let completes = 0;
    assert.deepEqual(
      await provisionEmployee(job, "value", {
        read: async () => value,
        create: async () => identity,
        complete: async () => {
          completes++;
        },
      }),
      { status: "conflict" },
    );
    assert.equal(completes, 0);
  });
test("a completed job with missing Auth identity never recreates an account", async () => {
  let creates = 0;
  assert.deepEqual(
    await provisionEmployee({ ...job, status: "completed" }, "value", {
      read: async () => null,
      create: async () => {
        creates++;
        return identity;
      },
      complete: async () => {},
    }),
    { status: "pending" },
  );
  assert.equal(creates, 0);
});
test("verification-only recovery never creates even when Auth target is absent", async () => {
  let creates = 0;
  assert.deepEqual(
    await provisionEmployee(job, "", {
      read: async () => null,
      create: async () => {
        creates++;
        return identity;
      },
      complete: async () => {},
    }),
    { status: "pending" },
  );
  assert.equal(creates, 0);
});
test("uncertain profile completion keeps the existing identity for the next exact recovery", async () => {
  assert.deepEqual(
    await provisionEmployee(job, "", {
      read: async () => identity,
      create: unknown,
      complete: unknown,
    }),
    { status: "pending" },
  );
});
test("employee passwords have a minimum and a UTF-8 byte bound", () => {
  assert.equal(validEmployeePassword("x".repeat(11)), false);
  assert.equal(validEmployeePassword("x".repeat(12)), true);
  assert.equal(validEmployeePassword("x".repeat(72)), true);
  assert.equal(validEmployeePassword("x".repeat(73)), false);
  assert.equal(validEmployeePassword("ع".repeat(36)), true);
  assert.equal(validEmployeePassword("ع".repeat(37)), false);
});
