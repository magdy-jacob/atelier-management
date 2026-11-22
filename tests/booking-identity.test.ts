import test from "node:test";
import assert from "node:assert/strict";
import {
  validBookingPhone,
  validSyntheticName,
} from "../src/lib/booking-identity";
import { imageAttachmentConfirmed } from "../src/lib/image-attachment";
test("portfolio identities use non-contact identifiers consistently with server validation", () => {
  for (const phone of ["TEST-001", "TEST-SCENARIO", "TEST-a_b-c"])
    assert.equal(validBookingPhone(phone, true), true);
  for (const phone of [
    "01000000000",
    "TEST-",
    "test-001",
    "TEST-xxxxxxxxxxxxxxxxxxx",
    "TEST-a b",
  ])
    assert.equal(validBookingPhone(phone, true), false);
  assert.equal(validSyntheticName("اختبار عميلة جديدة"), true);
  assert.equal(validSyntheticName("اختبار "), false);
  assert.equal(validSyntheticName("عميلة تجريبية"), false);
  assert.equal(validBookingPhone("TEST-001", false), false);
  assert.equal(validBookingPhone("00000000000", false), true);
});
test("image upload confirms a recovered committed link but never treats uncertainty as success", async () => {
  assert.equal(
    await imageAttachmentConfirmed(false, async () => {
      throw new Error("not needed");
    }),
    true,
  );
  assert.equal(await imageAttachmentConfirmed(true, async () => true), true);
  assert.equal(await imageAttachmentConfirmed(true, async () => false), false);
  assert.equal(
    await imageAttachmentConfirmed(true, async () => {
      throw new Error("network");
    }),
    false,
  );
});
