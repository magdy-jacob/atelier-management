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
  await expect
    .poll(async () => {
      const logo = await page
        .getByRole("link", { name: "Lovely، الصفحة الرئيسية", exact: true })
        .boundingBox();
      const banner = await page
        .getByRole("note", { name: "نسخة اختبار فقط" })
        .boundingBox();
      return !!logo && !!banner && logo.y >= banner.y + banner.height;
    })
    .toBeTruthy();
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
  await expect(
    page.getByRole("link", {
      name: "فتح بيانات مساحة العمل، بدخول الفريق",
      exact: true,
    }),
  ).toHaveAttribute("href", "/workspace");
  await expect(page.locator("[data-image-id]")).toHaveCount(3);
  await expect(
    page.getByRole("button", {
      name: "حفظ الترتيب معطل في المعاينة",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "تأخير الصورة 1", exact: true })
    .click();
  await expect(page.locator("[data-image-id]").first()).toHaveAttribute(
    "data-image-id",
    "sample-2",
  );
  await expect(page.getByText(/ترتيب جديد غير محفوظ/)).toBeVisible();
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

test("critical collision notice is prominent and does not promise an automatic hold", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/notifications/collision");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: "تنبيه مهم للأدمن: راجع الحجز التالي",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/لا يلغي أو يحرك حجزًا/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "فتح الحجز المتأثر", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تعليم كمقروء", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/collision-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/notifications/collision");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/collision-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Lovely identity and status-only handover/return preview are readable and cannot submit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/workflow?view=handover");
  await expect(
    page.getByRole("img", {
      name: "شعار Lovely لتأجير وتفصيل الفساتين",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/يكفي مقدم مستلم ومسجل/)).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(
    page.getByRole("button", { name: "تأكيد خروج الفستان", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/handover-desktop.png",
    fullPage: true,
  });
  await page.goto("/demo/workflow?view=return");
  await page.getByLabel("نتيجة فحص العودة").selectOption("maintenance");
  await page.getByLabel("إكسسوارات", { exact: true }).check();
  await page.getByLabel("سوستة", { exact: true }).check();
  await expect(page.locator('input[name="issues"]:checked')).toHaveCount(2);
  await page.getByRole("checkbox").last().check();
  await expect(
    page.getByRole("button", {
      name: "تأكيد العودة والفحص ورد الضمان",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    page.locator('input[type="text"],input[type="number"]'),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/return-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("نتيجة فحص العودة").selectOption("sound");
  await expect(page.locator('input[name="issues"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/workflow?view=return");
  await page.getByLabel("نتيجة فحص العودة").selectOption("maintenance");
  await page.getByLabel("إكسسوارات", { exact: true }).check();
  await page.getByLabel("سوستة", { exact: true }).check();
  await page.getByRole("checkbox").last().check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "evidence/return-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/demo/workflow?view=unpaid");
  await expect(
    page.getByText(/لا يمكن إتمام العودة أو إغلاقها قبل/),
  ).toBeVisible();
  await page.goto("/demo/workflow?view=returned");
  await expect(page.getByText(/استلام مسجل/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تأكيد اكتمال التجهيز", exact: true }),
  ).toBeDisabled();
  await page.goto("/workspace/bookings/demo-booking");
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});

test("a recorded late return keeps its critical preparation impact visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/notifications/collision?returned=1");
  await expect(page.getByText(/سُجلت العودة في/)).toBeVisible();
  await expect(
    page.getByText(/ما زال الحجز التالي يتأثر بيوم التجهيز المسجل/),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "evidence/collision-after-return.png",
    fullPage: true,
  });
});

test("receipt report explains its cash basis and downloads only reconciled synthetic CSV in preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo/reports");
  await expect(
    page.getByRole("heading", { name: "دفتر القبض والتصدير", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/ليس قيمة الحجوزات/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "تنزيل CSV مصطنع فقط", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lovely-DEMO-ONLY-receipts.csv");
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.startsWith("\uFEFF")).toBeTruthy();
  expect(csv).toContain("DEMO-NO-PHONE-01");
  expect(csv).toContain("1000.25");
  await page.screenshot({
    path: "evidence/reports-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/reports-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/workspace/reports");
  await expect(page).toHaveURL(/login/);
  await page.goto("/workspace/reports/download?from=2026-12-01&to=2026-12-05");
  await expect(page).toHaveURL(/login/);
});
