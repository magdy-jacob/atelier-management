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
  async function parallelAsEmployee(sql, parameters) {
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
              [employee],
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
      const result = await parallelAsEmployee(
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
    const result = await parallelAsEmployee(
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
