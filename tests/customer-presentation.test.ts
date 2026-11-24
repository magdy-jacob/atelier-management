import test from "node:test";
import assert from "node:assert/strict";
import {
  displayCustomerName,
  displayCustomerPhone,
} from "../src/lib/presentation";

test("displayCustomerName strips synthetic test prefix cleanly", () => {
  assert.equal(displayCustomerName("اختبار magdy jacob"), "magdy jacob");
  assert.equal(displayCustomerName("اختبار  سارة أحمد"), "سارة أحمد");
  assert.equal(displayCustomerName("عميلة تجريبية 1"), "عميلة تجريبية 1");
  assert.equal(displayCustomerName(null), "غير متاح");
  assert.equal(displayCustomerName(""), "غير متاح");
});

test("displayCustomerPhone strips synthetic TEST- prefix and normalizes country code", () => {
  assert.equal(displayCustomerPhone("TEST-01286100573"), "01286100573");
  assert.equal(displayCustomerPhone("TEST-201286100573"), "01286100573");
  assert.equal(displayCustomerPhone("01286100573"), "01286100573");
  assert.equal(displayCustomerPhone(null), "—");
  assert.equal(displayCustomerPhone(""), "—");
});

test("customer grouping aggregates duplicate customer entries sharing the same name", () => {
  const records = [
    {
      id: "id-1",
      full_name: "اختبار magdy jacob",
      phone: "TEST-201286100573",
      created_at: "2026-11-24T21:43:00Z",
    },
    {
      id: "id-2",
      full_name: "اختبار magdy jacob",
      phone: "TEST-201286100573",
      created_at: "2026-11-24T21:37:44Z",
    },
    {
      id: "id-3",
      full_name: "اختبار magdy jacob",
      phone: "TEST-01286100573",
      created_at: "2026-11-24T21:24:31Z",
    },
    {
      id: "id-4",
      full_name: "اختبار سارة أحمد",
      phone: "TEST-01286123456",
      created_at: "2026-11-24T21:17:33Z",
    },
  ];

  type GroupedCustomer = {
    primaryId: string;
    name: string;
    phones: string[];
    allIds: string[];
    count: number;
  };

  const groupsMap = new Map<string, GroupedCustomer>();

  for (const c of records) {
    const cleanName = displayCustomerName(c.full_name);
    const key = cleanName.toLowerCase();
    const cleanPhone = displayCustomerPhone(c.phone);

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        primaryId: c.id,
        name: cleanName,
        phones: cleanPhone && cleanPhone !== "—" ? [cleanPhone] : [],
        allIds: [c.id],
        count: 1,
      });
    } else {
      const group = groupsMap.get(key)!;
      group.allIds.push(c.id);
      group.count += 1;
      if (cleanPhone && cleanPhone !== "—" && !group.phones.includes(cleanPhone)) {
        group.phones.push(cleanPhone);
      }
    }
  }

  const grouped = Array.from(groupsMap.values());
  assert.equal(grouped.length, 2);

  const magdy = grouped.find((g) => g.name === "magdy jacob");
  assert.ok(magdy);
  assert.equal(magdy.count, 3);
  assert.equal(magdy.primaryId, "id-1");
  assert.deepEqual(magdy.allIds, ["id-1", "id-2", "id-3"]);
  assert.deepEqual(magdy.phones, ["01286100573"]);

  const sara = grouped.find((g) => g.name === "سارة أحمد");
  assert.ok(sara);
  assert.equal(sara.count, 1);
  assert.equal(sara.primaryId, "id-4");
  assert.deepEqual(sara.phones, ["01286123456"]);
});
