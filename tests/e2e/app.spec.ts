import { test, expect } from "@playwright/test";
test("catalogue, filters, product privacy, responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("heading", { name: "اختاري حكايتك" }).waitFor();
  await page.screenshot({
    path: "evidence/catalogue-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "خطوبة", exact: true }).click();
  await expect(page.getByRole("link", { name: /وردة المساء/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /همسة زيتون/ })).toHaveCount(0);
  await page.getByRole("button", { name: "الكل", exact: true }).click();
  await page.getByLabel("ابحثي بالاسم أو الكود").fill("AT-001");
  await expect(page.getByRole("link", { name: /همسة زيتون/ })).toBeVisible();
  await page.getByRole("link", { name: /همسة زيتون/ }).click();
  await expect(page.getByRole("heading", { name: "همسة زيتون" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("3000");
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/catalogue-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("demo role separation, conflict rejection, accepted booking and calendar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo");
  await page
    .getByRole("heading", { name: "كل تفاصيل يومك، في مكان واحد." })
    .waitFor();
  await page.screenshot({
    path: "evidence/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("الدور التجريبي").selectOption("employee");
  await expect(
    page.getByRole("button", { name: "المالية", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("المبالغ المسجلة", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("الدور التجريبي").selectOption("admin");
  await page.getByRole("button", { name: "حجز تجريبي جديد" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="customer"]').fill("اختبار الحجز");
  await dialog.locator('[name="phone"]').fill("01000000000");
  await dialog.locator('[name="start"]').fill("2026-12-07");
  await dialog.locator('[name="end"]').fill("2026-12-07");
  await dialog.getByRole("button", { name: "إضافة للتجربة فقط" }).click();
  await expect(dialog.getByRole("alert")).toContainText("٨ ديسمبر ٢٠٢٦");
  await page.screenshot({
    path: "evidence/booking-conflict.png",
    fullPage: false,
  });
  await dialog.locator('[name="start"]').fill("2026-12-08");
  await dialog.locator('[name="end"]').fill("2026-12-09");
  await dialog.getByRole("button", { name: "إضافة للتجربة فقط" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("اختبار الحجز", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "التقويم", exact: true }).click();
  await expect(page.getByRole("heading", { name: /ديسمبر/ })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10000,
  });
  await page.screenshot({
    path: "evidence/calendar-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "نظرة عامة", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10000,
  });
  await page.screenshot({
    path: "evidence/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("no-configuration login and workspace fail closed", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "تسجيل الدخول", exact: true }),
  ).toBeDisabled();
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "مساحة العمل غير مهيأة بعد" }),
  ).toBeVisible();
});

test("inventory editor preview is clear, responsive and cannot mutate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/inventory");
  await expect(
    page.getByRole("heading", { name: "إدارة الفستان", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "معاينة فقط، الحفظ غير مفعل" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "الرفع غير مفعل في المعاينة" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "evidence/inventory-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/inventory-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("read-only records render on desktop/mobile; protected routes stay closed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/records?view=activity");
  await expect(
    page.getByRole("heading", { name: "سجل النشاط", exact: true }),
  ).toBeVisible();
  await page
    .getByText("عرض القيم السابقة والجديدة", { exact: true })
    .first()
    .click();
  await expect(page.locator("pre").first()).toBeVisible();
  await page.screenshot({
    path: "evidence/records-desktop.png",
    fullPage: true,
  });
  for (const view of ["history", "ledger"]) {
    await page.goto(`/demo/records?view=${view}`);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "evidence/ledger-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/workspace/activity");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/workspace/team");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/workspace/customers");
  await expect(page).toHaveURL(/\/login$/);
});
