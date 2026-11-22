import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingForWorkspace,
  firstWorkspaceImage,
  type WorkspaceBookingRecord,
} from "../src/lib/workspace-view";
const fixture: WorkspaceBookingRecord = {
  id: "fixture",
  starts_on: "2026-12-05",
  returns_on: "2026-12-06",
  status: "confirmed",
  agreed_price_piasters: 10000,
  dresses: { name: "Dress", dress_images: [] },
  customers: { full_name: "Customer" },
  payments: [{ amount_piasters: 2500 }],
  late_fees: [{ amount_piasters: 50 }],
};
test("workspace cards use recorded receipts and fees, not booking price as paid", () => {
  const row = bookingForWorkspace(fixture, (p) => p);
  assert.equal(row.remaining, "7550");
  assert.equal(row.image, "/placeholder.svg");
  assert.equal(row.customerName, "Customer");
});
test("cancelled and historically overpaid cards never invent an outstanding claim", () => {
  assert.equal(
    bookingForWorkspace({ ...fixture, status: "cancelled" }, (p) => p)
      .remaining,
    "0",
  );
  assert.equal(
    bookingForWorkspace(
      { ...fixture, payments: [{ amount_piasters: 20000 }] },
      (p) => p,
    ).remaining,
    "0",
  );
});
test("workspace first image uses deterministic image order without mutating source", () => {
  const images = [
    { id: "b", path: "second", sort_order: 0 },
    { id: "a", path: "first", sort_order: 0 },
  ];
  assert.equal(
    firstWorkspaceImage(images, (p) => "asset:" + p),
    "asset:first",
  );
  assert.equal(images[0].id, "b");
});
test("workspace mapping handles joined arrays, preserves exact large piasters and exposes only card fields", () => {
  const row = bookingForWorkspace(
    {
      ...fixture,
      agreed_price_piasters: "900719925474099329",
      payments: [],
      late_fees: [],
      dresses: [{ name: "Joined", dress_images: [] }],
      customers: [{ full_name: "Joined customer" }],
    },
    (p) => p,
  );
  assert.equal(row.remaining, "900719925474099329");
  assert.equal(row.dressName, "Joined");
  assert.deepEqual(
    Object.keys(row).sort(),
    [
      "id",
      "dressName",
      "image",
      "customerName",
      "starts_on",
      "returns_on",
      "status",
      "remaining",
    ].sort(),
  );
});
