// Local PostgreSQL integration tests, not a live Supabase test.
// auth/storage stubs stand in for vendor-owned schemas. No cloud account is used.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atelier-pg-"));
const cluster = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "local-test-only",
  port: 55439,
  persistent: false,
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(message),
});
let client;
let checks = 0;
const admin = "11111111-1111-4111-8111-111111111111",
  employee = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  inactive = "44444444-4444-4444-8444-444444444444";
const dress = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function asUser(uid, sql, params = []) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      uid,
    ]);
    const result = await client.query(sql, params);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
async function deny(uid, sql, params = [], pattern) {
  await assert.rejects(() => asUser(uid, sql, params), pattern);
  checks++;
}
async function check(label, fn) {
  await fn();
  console.log("PASS", label);
  checks++;
}
try {
  await cluster.initialise();
  await cluster.start();
  client = cluster.getPgClient();
  await client.connect();
  await client.query(`create role anon nologin;create role authenticated nologin;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
  const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.query(await fs.readFile(new URL(file, migrationsDir), "utf8"));
  }
  await client.query(`insert into auth.users values($1),($2),($3),($4)`, [
    admin,
    employee,
    other,
    inactive,
  ]);
  await client.query(
    `insert into public.profiles(id,full_name,role,active) values($1,'Admin','admin',true),($2,'Employee','employee',true),($3,'Other','employee',true),($4,'Inactive','employee',false)`,
    [admin, employee, other, inactive],
  );
  const category = (
    await client.query(
      "insert into public.categories(name) values('Test') returning id",
    )
  ).rows[0].id;
  await asUser(
    admin,
    "insert into public.dresses(id,code,name,color,size,category_id,public_availability) values($1,'TEST-001','Test dress','sage','M',$2,'available')",
    [dress, category],
  );
  await asUser(
    admin,
    "insert into public.dress_prices(dress_id,advisory_price_piasters) values($1,300000)",
    [dress],
  );
  await check("version increments and rejects a stale edit", async () => {
    const version = (
      await asUser(admin, "select version from public.dresses where id=$1", [
        dress,
      ])
    ).rows[0].version;
    assert.equal(
      (
        await asUser(
          admin,
          "update public.dresses set name='Updated' where id=$1 and version=$2 returning version",
          [dress, version],
        )
      ).rows[0].version,
      version + 1,
    );
    assert.equal(
      (
        await asUser(
          admin,
          "update public.dresses set name='Stale' where id=$1 and version=$2 returning id",
          [dress, version],
        )
      ).rowCount,
      0,
    );
  });
  await check("employee cannot update or archive dress", async () =>
    assert.equal(
      (
        await asUser(
          employee,
          "update public.dresses set archived=true where id=$1 returning id",
          [dress],
        )
      ).rowCount,
      0,
    ),
  );
  await check(
    "anon can read safe catalogue; cannot read customers",
    async () => {
      await client.query("begin");
      await client.query("set local role anon");
      assert.equal(
        (await client.query("select * from public.dresses")).rowCount,
        1,
      );
      await assert.rejects(
        () => client.query("select * from public.customers"),
        /permission denied/,
      );
      await client.query("rollback");
    },
  );
  await check("employee cannot read private dress prices", async () =>
    assert.equal(
      (await asUser(employee, "select * from public.dress_prices")).rowCount,
      0,
    ),
  );
  await deny(
    employee,
    "update public.profiles set role='admin' where id=$1",
    [employee],
    /permission denied/,
  );
  await deny(
    employee,
    "insert into public.dresses(code,name,color,size,category_id) values('BAD','Bad','x','M',$1)",
    [category],
    /row-level security/,
  );
  await deny(
    inactive,
    "select public.create_booking(gen_random_uuid(),$1,'x','01000000000','2099-12-05','2099-12-06',300000,100000,'cash')",
    [dress],
    /not_authorized/,
  );
  await deny(
    employee,
    "select public.create_booking(gen_random_uuid(),$1,'x','01000000000','2099-12-05','2099-12-06',300000,100000,'cash')",
    [dress],
    /policy_decisions_pending/,
  );
  await asUser(
    admin,
    "update public.settings set live_bookings_enabled=true,date_precision='day',business_timezone='Africa/Cairo',same_day_allowed=false,payment_methods=array['cash'] where id=true",
  );
  const request = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const booking = (
    await asUser(
      employee,
      "select public.create_booking($1,$2,'Test customer','01000000000','2099-12-05','2099-12-06',300000,100000,'cash') as id",
      [request, dress],
    )
  ).rows[0].id;
  await check(
    "staff form config exposes only safe confirmed settings",
    async () => {
      const c = (
        await asUser(employee, "select public.get_staff_booking_config() as c")
      ).rows[0].c;
      assert.equal(c.date_precision, "day");
      assert.equal(c.payment_method_optional, true);
      assert.equal(c.same_day_allowed, false);
      assert.equal(c.business_timezone, "Africa/Cairo");
      assert.equal("password" in c, false);
    },
  );
  await check(
    "next available day includes return and preparation days",
    async () =>
      assert.equal(
        (
          await asUser(
            employee,
            "select public.next_available_day($1,'2099-12-06',0)::text as d",
            [dress],
          )
        ).rows[0].d,
        "2099-12-08",
      ),
  );
  await check("booking and deposit stored atomically", async () => {
    assert.equal(
      (
        await asUser(
          employee,
          "select * from public.payments where booking_id=$1",
          [booking],
        )
      ).rowCount,
      1,
    );
  });
  await check(
    "retry idempotency does not create duplicate booking or payment",
    async () => {
      assert.equal(
        (
          await asUser(
            employee,
            "select public.create_booking($1,$2,'Test customer','01000000000','2099-12-05','2099-12-06',300000,100000,'cash') as id",
            [request, dress],
          )
        ).rows[0].id,
        booking,
      );
      assert.equal(
        (await client.query("select count(*)::int n from public.payments"))
          .rows[0].n,
        1,
      );
    },
  );
  await deny(
    employee,
    "select public.create_booking($1,$2,'Test customer','01000000000','2099-12-05','2099-12-06',400000,100000,'cash')",
    [request, dress],
    /request_id_payload_mismatch/,
  );
  await deny(
    employee,
    "select public.create_booking(gen_random_uuid(),$1,'Same day','01000000000',(now() at time zone 'Africa/Cairo')::date,(now() at time zone 'Africa/Cairo')::date,300000,0,null)",
    [dress],
    /invalid_dates_or_same_day_policy/,
  );
  await deny(
    employee,
    "select public.create_booking(gen_random_uuid(),$1,'Conflict','01000000001','2099-12-06','2099-12-06',300000,0,null)",
    [dress],
    /no_dress_overlap/,
  );
  await deny(
    employee,
    "select public.create_booking(gen_random_uuid(),$1,'Preparation conflict','01000000001','2099-12-07','2099-12-07',300000,0,null)",
    [dress],
    /no_dress_overlap/,
  );
  await check("failed overlap rolls back customer creation", async () =>
    assert.equal(
      (await client.query("select count(*)::int n from public.customers"))
        .rows[0].n,
      1,
    ),
  );
  await check("December 8 accepted after full preparation day", async () => {
    await asUser(
      employee,
      "select public.create_booking(gen_random_uuid(),$1,'Next booking','01000000002','2099-12-08','2099-12-09',250000,0,null)",
      [dress],
    );
  });
  await check(
    "unassigned employee cannot access booking, customer or payments",
    async () => {
      for (const table of ["bookings", "customers", "payments"])
        assert.equal(
          (await asUser(other, `select * from public.${table}`)).rowCount,
          0,
        );
    },
  );
  await deny(
    other,
    "select public.record_payment(gen_random_uuid(),$1,200000,'cash')",
    [booking],
    /not_authorized/,
  );
  await deny(
    employee,
    "insert into public.payments(request_id,booking_id,amount_piasters,method,kind,recorded_by) values(gen_random_uuid(),$1,100,'cash','payment',$2)",
    [booking, employee],
    /permission denied/,
  );
  await deny(
    employee,
    "select public.record_payment(gen_random_uuid(),$1,200001,'cash')",
    [booking],
    /invalid_amount_or_overpayment/,
  );
  await deny(
    employee,
    "select public.record_payment(gen_random_uuid(),$1,200000,repeat('x',41))",
    [booking],
    /invalid_payment_method/,
  );
  await check("remaining payment exact integer piasters", async () => {
    await asUser(
      employee,
      "select public.record_payment(gen_random_uuid(),$1,200000,'cash')",
      [booking],
    );
    assert.equal(
      (
        await client.query(
          "select sum(amount_piasters)::int n from public.payments where booking_id=$1",
          [booking],
        )
      ).rows[0].n,
      300000,
    );
  });
  await check(
    "exact payment retry returns prior payment without duplication",
    async () => {
      const p = (
        await asUser(
          employee,
          "select id,request_id from public.payments where booking_id=$1 and kind='payment'",
          [booking],
        )
      ).rows[0];
      assert.equal(
        (
          await asUser(
            employee,
            "select public.record_payment($1,$2,200000,'cash') as id",
            [p.request_id, booking],
          )
        ).rows[0].id,
        p.id,
      );
    },
  );
  const previousPayment = (
    await asUser(
      employee,
      "select request_id from public.payments where booking_id=$1 and kind='payment'",
      [booking],
    )
  ).rows[0].request_id;
  await deny(
    employee,
    "select public.record_payment($1,$2,199999,'cash')",
    [previousPayment, booking],
    /request_id_payload_mismatch/,
  );
  await deny(
    employee,
    "delete from public.payments where booking_id=$1",
    [booking],
    /permission denied/,
  );
  await deny(
    admin,
    "delete from public.activity_logs",
    [],
    /permission denied/,
  );
  await check("activity logs readable only by admin", async () => {
    assert.equal(
      (await asUser(employee, "select * from public.activity_logs")).rowCount,
      0,
    );
    assert.ok(
      (await asUser(admin, "select * from public.activity_logs")).rowCount > 0,
    );
  });
  await check("archiving preserves booking and payment history", async () => {
    await asUser(admin, "update public.dresses set archived=true where id=$1", [
      dress,
    ]);
    await client.query("begin");
    await client.query("set local role anon");
    assert.equal(
      (await client.query("select * from public.dresses")).rowCount,
      0,
    );
    await client.query("rollback");
    assert.ok(
      (
        await asUser(admin, "select * from public.bookings where dress_id=$1", [
          dress,
        ])
      ).rowCount > 0,
    );
    assert.ok(
      (
        await asUser(
          admin,
          "select * from public.payments where booking_id=$1",
          [booking],
        )
      ).rowCount > 0,
    );
    await asUser(
      admin,
      "update public.dresses set archived=false where id=$1",
      [dress],
    );
  });
  async function parallelAsUser(sql, parameters, uid = employee) {
    const clients = parameters.map(() => cluster.getPgClient());
    try {
      await Promise.all(clients.map((c) => c.connect()));
      return await Promise.all(
        clients.map(async (c, i) => {
          try {
            await c.query("begin");
            await c.query("set local role authenticated");
            await c.query(
              "select set_config('request.jwt.claim.sub',$1,true)",
              [uid],
            );
            const value = await c.query(sql, parameters[i]);
            await c.query("commit");
            return { ok: true, value };
          } catch (error) {
            await c.query("rollback");
            return { ok: false, error };
          }
        }),
      );
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  }
  let raceBooking;
  await check(
    "concurrent overlapping bookings yield exactly one winner",
    async () => {
      const result = await parallelAsUser(
        "select public.create_booking(gen_random_uuid(),$1,'Concurrent customer','01000000000','2100-01-05','2100-01-06',300000,0,null) as id",
        [[dress], [dress]],
      );
      assert.equal(result.filter((r) => r.ok).length, 1);
      assert.equal(result.filter((r) => !r.ok).length, 1);
      assert.equal(result.find((r) => !r.ok).error.code, "23P01");
      raceBooking = result.find((r) => r.ok).value.rows[0].id;
    },
  );
  await check("concurrent payments cannot jointly overpay", async () => {
    const result = await parallelAsUser(
      "select public.record_payment(gen_random_uuid(),$1,200000,'cash')",
      [[raceBooking], [raceBooking]],
    );
    assert.equal(result.filter((r) => r.ok).length, 1);
    assert.equal(result.filter((r) => !r.ok).length, 1);
    assert.match(
      result.find((r) => !r.ok).error.message,
      /invalid_amount_or_overpayment/,
    );
    assert.equal(
      (
        await client.query(
          "select sum(amount_piasters)::int n from public.payments where booking_id=$1",
          [raceBooking],
        )
      ).rows[0].n,
      200000,
    );
  });
  await client.query(
    "grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated",
  );
  await deny(
    employee,
    "insert into storage.objects(bucket_id,name) values('dress-images','employee-denied.webp')",
    [],
    /row-level security/,
  );
  await check(
    "storage metadata access and mutations are admin-only",
    async () => {
      await asUser(
        admin,
        "insert into storage.objects(bucket_id,name) values('dress-images','admin-test.webp')",
      );
      assert.equal(
        (await asUser(employee, "select * from storage.objects")).rowCount,
        0,
      );
      assert.equal(
        (
          await asUser(
            admin,
            "select * from storage.objects where name='admin-test.webp'",
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await asUser(
            employee,
            "delete from storage.objects where name='admin-test.webp' returning id",
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await asUser(
            admin,
            "delete from storage.objects where name='admin-test.webp' returning id",
          )
        ).rowCount,
        1,
      );
    },
  );
  await check(
    "optional deposit method is stored as null without inventing a method",
    async () => {
      const r = await asUser(
        employee,
        "select public.create_booking(gen_random_uuid(),$1,'Optional method','01000000009','2101-02-10','2101-02-11',50000,10000,null) as id",
        [dress],
      );
      const id = r.rows[0].id;
      assert.equal(
        (
          await asUser(
            employee,
            "select method from public.payments where booking_id=$1",
            [id],
          )
        ).rows[0].method,
        null,
      );
      await asUser(
        employee,
        "select public.record_payment(gen_random_uuid(),$1,10000,'   ')",
        [id],
      );
      assert.equal(
        (
          await asUser(
            employee,
            "select count(*)::int n from public.payments where booking_id=$1 and method is null",
            [id],
          )
        ).rows[0].n,
        2,
      );
      await asUser(
        employee,
        "select public.record_payment(gen_random_uuid(),$1,10000,'Another received-money method')",
        [id],
      );
      assert.equal(
        (
          await asUser(
            employee,
            "select count(*)::int n from public.payments where booking_id=$1",
            [id],
          )
        ).rows[0].n,
        3,
      );
    },
  );
  await deny(
    employee,
    "select public.admin_dashboard('2026-01-01','2026-01-01')",
    [],
    /not_authorized/,
  );
  await deny(
    admin,
    "select public.admin_dashboard('2026-01-01','2027-01-02')",
    [],
    /invalid_reporting_period/,
  );
  await check(
    "admin summary aggregates actual current receipts without exposing it to anon",
    async () => {
      const d = (
        await asUser(
          admin,
          "select public.admin_dashboard((now() at time zone 'Africa/Cairo')::date,(now() at time zone 'Africa/Cairo')::date) as d",
        )
      ).rows[0].d;
      const expected = (
        await client.query(
          "select coalesce(sum(amount_piasters),0)::text total,count(*)::int n from public.payments",
        )
      ).rows[0];
      assert.equal(d.receipt_piasters, expected.total);
      assert.equal(d.receipt_count, expected.n);
      assert.equal(
        (
          await client.query(
            "select has_function_privilege('anon','public.admin_dashboard(date,date)','EXECUTE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
    },
  );
  await check(
    "admin receipt period uses Cairo midnight rather than UTC midnight",
    async () => {
      const rows = (
        await client.query(
          "select id,amount_piasters::text amount from public.payments order by id limit 2",
        )
      ).rows;
      await client.query(
        "update public.payments set recorded_at='2026-01-01T21:59:59Z' where id=$1",
        [rows[0].id],
      );
      await client.query(
        "update public.payments set recorded_at='2026-01-01T22:00:00Z' where id=$1",
        [rows[1].id],
      );
      const first = (
        await asUser(
          admin,
          "select public.admin_dashboard('2026-01-01','2026-01-01') as d",
        )
      ).rows[0].d;
      const second = (
        await asUser(
          admin,
          "select public.admin_dashboard('2026-01-02','2026-01-02') as d",
        )
      ).rows[0].d;
      assert.equal(first.receipt_count, 1);
      assert.equal(second.receipt_count, 1);
      assert.equal(first.receipt_piasters, rows[0].amount);
      assert.equal(second.receipt_piasters, rows[1].amount);
    },
  );
  await check(
    "explicit demo seed uses verified actors, is repeat-safe and reconciles synthetic totals",
    async () => {
      const seed = await fs.readFile(
        new URL("../supabase/demo/seed.demo.sql", import.meta.url),
        "utf8",
      );
      await client.query(
        "select set_config('atelier.demo_admin_id',$1,false),set_config('atelier.demo_employee_id',$2,false)",
        [admin, employee],
      );
      await client.query(
        "update public.settings set live_bookings_enabled=false where id=true",
      );
      await assert.rejects(
        () => client.query(seed),
        /non_demo_inventory_present_abort/,
      );
      await client.query("rollback");
      await client.query("truncate public.categories,public.customers cascade");
      await client.query(seed);
      await client.query(seed);
      assert.equal(
        (await client.query("select count(*)::int n from public.dresses"))
          .rows[0].n,
        6,
      );
      assert.equal(
        (await client.query("select count(*)::int n from public.payments"))
          .rows[0].n,
        5,
      );
      assert.equal(
        (await asUser(employee, "select count(*)::int n from public.bookings"))
          .rows[0].n,
        2,
      );
      const d = (
        await asUser(
          admin,
          "select public.admin_dashboard((now() at time zone 'Africa/Cairo')::date-30,(now() at time zone 'Africa/Cairo')::date) as d",
        )
      ).rows[0].d;
      assert.equal(d.receipt_piasters, "1100000");
      assert.equal(d.outstanding_piasters, "555000");
    },
  );
  await deny(
    employee,
    "select public.get_admin_notifications()",
    [],
    /not_authorized/,
  );
  await check(
    "read-marked operational notification stays active until cause resolves",
    async () => {
      let d = (
        await asUser(admin, "select public.get_admin_notifications() as d")
      ).rows[0].d;
      assert.equal(d.total, 3);
      assert.equal(d.items.filter((i) => i.kind === "overdue").length, 1);
      const alert = d.items.find((i) => i.kind === "outgoing");
      await asUser(admin, "select public.mark_notification_read($1,$2,$3)", [
        alert.booking_id,
        alert.kind,
        alert.event_on,
      ]);
      await asUser(admin, "select public.mark_notification_read($1,$2,$3)", [
        alert.booking_id,
        alert.kind,
        alert.event_on,
      ]);
      d = (await asUser(admin, "select public.get_admin_notifications() as d"))
        .rows[0].d;
      assert.equal(d.total, 3);
      assert.ok(d.items.find((i) => i.booking_id === alert.booking_id).read_at);
      assert.equal(
        (
          await client.query(
            "select count(*)::int n from public.notification_reads",
          )
        ).rows[0].n,
        1,
      );
      await deny(
        employee,
        "select public.mark_notification_read($1,$2,$3)",
        [alert.booking_id, alert.kind, alert.event_on],
        /not_authorized/,
      );
      await deny(
        admin,
        "select public.mark_notification_read($1,'incoming',$2)",
        [alert.booking_id, alert.event_on],
        /notification_not_active/,
      );
      assert.equal(
        (await asUser(employee, "select * from public.notification_reads"))
          .rowCount,
        0,
      );
      const late = (
        await asUser(
          admin,
          "select public.get_admin_notifications('overdue') as d",
        )
      ).rows[0].d;
      assert.equal(late.total, 1);
      assert.equal(late.items[0].kind, "overdue");
      assert.equal(
        (
          await client.query(
            "select has_function_privilege('anon','public.get_admin_notifications(text)','EXECUTE') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      await client.query(
        "update public.bookings set status='out' where id=$1",
        [alert.booking_id],
      );
      d = (await asUser(admin, "select public.get_admin_notifications() as d"))
        .rows[0].d;
      assert.equal(d.total, 2);
    },
  );
  await check(
    "manual overdue fee is gated, admin-only and never a receipt",
    async () => {
      const late = (
        await asUser(
          admin,
          "select public.get_admin_notifications('overdue') as d",
        )
      ).rows[0].d.items[0];
      const incoming = (
        await asUser(
          admin,
          "select public.get_admin_notifications('incoming') as d",
        )
      ).rows[0].d.items[0];
      const request = "77777777-7777-4777-8777-777777777777";
      const args = [
        request,
        late.booking_id,
        1234,
        "Local optional late-fee test",
      ];
      await deny(
        admin,
        "select public.add_late_fee($1,$2,$3,$4)",
        args,
        /policy_decisions_pending/,
      );
      await client.query(
        "update public.settings set live_bookings_enabled=true where id=true",
      );
      await deny(
        employee,
        "select public.add_late_fee($1,$2,$3,$4)",
        args,
        /not_authorized/,
      );
      await deny(
        admin,
        "insert into public.late_fees(booking_id,amount_piasters,reason,recorded_by) values($1,1234,'Direct insert',$2)",
        [late.booking_id, admin],
        /permission denied/,
      );
      await deny(
        admin,
        "select public.add_late_fee($1,$2,$3,$4)",
        [request, incoming.booking_id, 1234, "Not late"],
        /booking_not_currently_overdue/,
      );
      await deny(
        admin,
        "select public.add_late_fee($1,$2,$3,$4)",
        [request, late.booking_id, 0, "Zero fee"],
        /invalid_fee/,
      );
      await deny(
        admin,
        "select public.add_late_fee($1,$2,$3,$4)",
        [null, late.booking_id, 1234, "No request"],
        /invalid_fee/,
      );
      const before = (
        await client.query(
          "select sum(amount_piasters)::text total,count(*)::int n from public.payments",
        )
      ).rows[0];
      const fee = (
        await asUser(
          admin,
          "select public.add_late_fee($1,$2,$3,$4) as id",
          args,
        )
      ).rows[0].id;
      assert.equal(
        (
          await asUser(
            admin,
            "select public.add_late_fee($1,$2,$3,$4) as id",
            args,
          )
        ).rows[0].id,
        fee,
      );
      await deny(
        admin,
        "select public.add_late_fee($1,$2,$3,$4)",
        [request, late.booking_id, 1235, args[3]],
        /request_id_payload_mismatch/,
      );
      assert.deepEqual(
        (
          await client.query(
            "select sum(amount_piasters)::text total,count(*)::int n from public.payments",
          )
        ).rows[0],
        before,
      );
      assert.equal(
        (
          await client.query(
            "select count(*)::int n from public.late_fees where request_id=$1",
            [request],
          )
        ).rows[0].n,
        1,
      );
      const summary = (
        await asUser(
          admin,
          "select public.admin_dashboard((now() at time zone 'Africa/Cairo')::date-30,(now() at time zone 'Africa/Cairo')::date) as d",
        )
      ).rows[0].d;
      assert.equal(summary.outstanding_piasters, "556234");
      assert.equal(summary.receipt_piasters, "1100000");
      assert.equal(
        (
          await client.query(
            "select has_function_privilege('anon','public.add_late_fee(uuid,uuid,bigint,text)','EXECUTE') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      const raceArgs = [
        "88888888-8888-4888-8888-888888888888",
        late.booking_id,
        1111,
        "Concurrent exact retry",
      ];
      const repeated = await parallelAsUser(
        "select public.add_late_fee($1,$2,$3,$4) as id",
        [raceArgs, raceArgs],
        admin,
      );
      assert.equal(repeated.filter((r) => r.ok).length, 2);
      assert.equal(repeated[0].value.rows[0].id, repeated[1].value.rows[0].id);
      assert.equal(
        (
          await client.query(
            "select count(*)::int n from public.late_fees where request_id=$1",
            [raceArgs[0]],
          )
        ).rows[0].n,
        1,
      );
      await client.query(
        "update public.bookings set status='returned' where id=$1",
        [late.booking_id],
      );
      assert.equal(
        (
          await asUser(
            admin,
            "select public.add_late_fee($1,$2,$3,$4) as id",
            args,
          )
        ).rows[0].id,
        fee,
      );
      await deny(
        admin,
        "select public.add_late_fee(gen_random_uuid(),$1,100,'Not active')",
        [late.booking_id],
        /booking_not_currently_overdue/,
      );
      await client.query(
        "update public.settings set live_bookings_enabled=false where id=true",
      );
    },
  );
  await check(
    "category management is admin-only, versioned and preserves used categories",
    async () => {
      const used = (
        await asUser(
          admin,
          "select c.id,c.name,c.version from public.categories c join public.dresses d on d.category_id=c.id limit 1",
        )
      ).rows[0];
      const category = (
        await asUser(
          admin,
          "insert into public.categories(name) values('Unused category for local tests') returning id,version",
        )
      ).rows[0];
      await deny(
        employee,
        "select public.manage_category($1,1,'Employee rename',false)",
        [category.id],
        /not_authorized/,
      );
      await deny(
        admin,
        "update public.categories set name='Bypass' where id=$1",
        [category.id],
        /permission denied/,
      );
      await deny(
        admin,
        "delete from public.categories where id=$1",
        [category.id],
        /permission denied/,
      );
      assert.equal(
        (
          await asUser(
            admin,
            "select public.manage_category($1,1,'Renamed category',false) as v",
            [category.id],
          )
        ).rows[0].v,
        2,
      );
      await deny(
        admin,
        "select public.manage_category($1,1,'Stale edit',false)",
        [category.id],
        /category_stale/,
      );
      await deny(
        admin,
        "select public.manage_category($1,2,$2,false)",
        [category.id, used.name],
        /unique|duplicate/,
      );
      await deny(
        admin,
        "select public.manage_category($1,2,'   ',false)",
        [category.id],
        /invalid_category/,
      );
      await deny(
        admin,
        "select public.manage_category($1,$2,null,true)",
        [used.id, used.version],
        /category_in_use/,
      );
      await asUser(
        admin,
        "update public.dresses set archived=true where category_id=$1",
        [used.id],
      );
      await deny(
        admin,
        "select public.manage_category($1,$2,null,true)",
        [used.id, used.version],
        /category_in_use/,
      );
      await asUser(admin, "select public.manage_category($1,2,null,true)", [
        category.id,
      ]);
      assert.equal(
        (
          await asUser(admin, "select id from public.categories where id=$1", [
            category.id,
          ])
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await asUser(
            admin,
            "select count(*)::int n from public.activity_logs where entity='categories' and entity_id=$1",
            [category.id],
          )
        ).rows[0].n,
        3,
      );
      assert.equal(
        (
          await client.query(
            "select has_function_privilege('anon','public.manage_category(uuid,integer,text,boolean)','EXECUTE') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      const race = (
        await asUser(
          admin,
          "insert into public.categories(name) values('Concurrent category') returning id",
        )
      ).rows[0];
      const results = await parallelAsUser(
        "select public.manage_category($1,1,$2,false)",
        [
          [race.id, "First rename"],
          [race.id, "Second rename"],
        ],
        admin,
      );
      assert.equal(results.filter((r) => r.ok).length, 1);
      assert.match(results.find((r) => !r.ok).error.message, /category_stale/);
    },
  );
  await check("deactivation removes staff access immediately", async () => {
    await client.query("update public.profiles set active=false where id=$1", [
      employee,
    ]);
    assert.equal(
      (await asUser(employee, "select * from public.bookings")).rowCount,
      0,
    );
  });
  console.log(`Database checks passed: ${checks}`);
} finally {
  if (client) await client.end();
  await cluster.stop();
  await fs.rm(dir, { recursive: true, force: true });
}
