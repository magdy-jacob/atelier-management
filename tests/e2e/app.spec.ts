import { test, expect } from "@playwright/test";
test("catalogue, filters, product privacy, responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("heading", { name: "اختاري حكايتك" }).waitFor();
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBeTruthy();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
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

test("real booking/payment form preview calculates balance but cannot submit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/booking");
  await expect(
    page.getByRole("heading", { name: "نماذج الحجز والدفعات" }),
  ).toBeVisible();
  await page.getByLabel("السعر النهائي المتفق عليه (جنيه)").fill("3000");
  await page.getByLabel("المقدم المستلم (جنيه)").fill("1000");
  await expect(page.locator("output")).toContainText("٢");
  await expect(
    page.getByRole("button", { name: "الحفظ الفعلي غير مفعل" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "تسجيل الدفعة في السجل" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "evidence/booking-form-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/booking");
  await page.getByLabel("السعر النهائي المتفق عليه (جنيه)").fill("3000");
  await page.getByLabel("المقدم المستلم (جنيه)").fill("1000");
  await expect(
    page.getByLabel("طريقة استلام المقدم (اختياري)"),
  ).not.toHaveAttribute("required");
  await page.getByLabel("طريقة استلام المقدم (اختياري)").fill("طريقة أخرى");
  await page.getByLabel("طريقة استلام المقدم (اختياري)").fill("");
  await page.screenshot({
    path: "evidence/booking-form-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Cairo-day operations calendar distinguishes return alerts and planned preparation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/operations");
  await expect(
    page.getByRole("heading", { name: "العمليات والتقويم" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "عودة مطلوبة اليوم (١)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "متأخر عن العودة المسجلة (١)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /تقويم ديسمبر/ }),
  ).toBeVisible();
  await expect(
    page.getByText("تجهيز مخطط", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "evidence/operations-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/operations-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "الشهر التالي" }).click();
  await expect(
    page.getByRole("heading", { name: /تقويم يناير/ }),
  ).toBeVisible();
  await page.goto("/workspace/operations");
  await expect(page).toHaveURL(/login/);
});

test("admin summary has explicit money definitions and remains protected", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/admin");
  await expect(
    page.getByRole("note", { name: "نسخة اختبار فقط" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "لوحة الأدمن" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "الصورة المالية المسجلة" }),
  ).toBeVisible();
  await expect(
    page.getByText("مبالغ مستلمة مسجلة في الفترة", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "evidence/admin-dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/admin");
  await page.screenshot({
    path: "evidence/admin-dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/workspace/dashboard");
  await expect(page).toHaveURL(/login/);
});

test("notification center keeps read operational causes visible and filters types", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/notifications");
  await expect(
    page.getByRole("heading", { name: "مركز الإشعارات" }),
  ).toBeVisible();
  await expect(
    page.getByText("مقروء، وما زال السبب قائمًا", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تعليم كمقروء" }).first(),
  ).toBeDisabled();
  await page.screenshot({
    path: "evidence/notifications-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/notifications");
  await page.screenshot({
    path: "evidence/notifications-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("link", { name: "متأخر عن العودة", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.goto("/workspace/notifications");
  await expect(page).toHaveURL(/login/);
});

test("overdue fee is optional, explicit and disabled in prototype preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/notifications/overdue");
  await page
    .locator("summary")
    .filter({ hasText: "إضافة غرامة تأخير" })
    .click();
  await page.getByLabel("مبلغ الغرامة (جنيه)").fill("50.25");
  await page.getByLabel("سبب الغرامة").fill("سبب تجريبي اختياري");
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "إضافة الغرامة للمستحق", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/ولا يخصم أموالًا/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(async () =>
      Math.round(
        (await page
          .getByRole("note", { name: "نسخة اختبار فقط" })
          .boundingBox())!.y,
      ),
    )
    .toBe(0);
  await page.screenshot({
    path: "evidence/late-fee-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/notifications/overdue");
  await page
    .locator("summary")
    .filter({ hasText: "إضافة غرامة تأخير" })
    .click();
  await page.getByLabel("مبلغ الغرامة (جنيه)").fill("50.25");
  await page.getByLabel("سبب الغرامة").fill("سبب تجريبي اختياري");
  await page.getByRole("checkbox").check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(async () =>
      Math.round(
        (await page
          .getByRole("note", { name: "نسخة اختبار فقط" })
          .boundingBox())!.y,
      ),
    )
    .toBe(0);
  await page.screenshot({
    path: "evidence/late-fee-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/demo/notifications/incoming");
  await expect(
    page.getByRole("button", { name: "إضافة الغرامة للمستحق", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("category editing preview preserves used dress history and is responsive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/categories");
  await expect(
    page.getByRole("heading", { name: "إدارة التصنيفات", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  const used = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "سهرة · تجريبي", exact: true }),
  });
  await used.getByText("حذف تصنيف غير مستخدم", { exact: true }).click();
  await expect(used.getByRole("checkbox")).toBeDisabled();
  await expect(
    used.getByRole("button", { name: "حذف التصنيف غير المستخدم", exact: true }),
  ).toBeDisabled();
  const unused = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "تصنيف غير مستخدم · تجريبي",
      exact: true,
    }),
  });
  await unused.getByLabel("اسم التصنيف").fill("تصنيف جديد · معاينة");
  await unused.getByText("حذف تصنيف غير مستخدم", { exact: true }).click();
  await unused.getByRole("checkbox").check();
  await expect(
    unused.getByRole("button", { name: "حفظ اسم التصنيف", exact: true }),
  ).toBeDisabled();
  await expect(
    unused.getByRole("button", {
      name: "حذف التصنيف غير المستخدم",
      exact: true,
    }),
  ).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/categories-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/categories");
  await page
    .getByRole("article")
    .first()
    .getByText("حذف تصنيف غير مستخدم", { exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/categories-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/workspace/categories");
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});
