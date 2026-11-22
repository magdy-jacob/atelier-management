export type EmployeeJob = {
  id: string;
  user_id: string;
  actor_id: string;
  full_name: string;
  email: string;
  status: "pending" | "completed";
};
export type EmployeeIdentity = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};
export type EmployeePorts = {
  read: () => Promise<EmployeeIdentity | null>;
  create: (password: string) => Promise<EmployeeIdentity>;
  complete: () => Promise<void>;
};
// Auth and PostgreSQL are separate transactions. Keep a durable job and a fixed
// random Auth target, never adopt an existing email or delete on uncertainty.
export async function provisionEmployee(
  job: EmployeeJob,
  password: string,
  ports: EmployeePorts,
): Promise<
  | { status: "completed"; recovered: boolean }
  | { status: "pending" | "conflict" }
> {
  let user: EmployeeIdentity | null;
  let recovered = true;
  try {
    user = await ports.read();
  } catch {
    return { status: "pending" };
  }
  if (!user) {
    if (job.status === "completed" || !password) return { status: "pending" };
    try {
      user = await ports.create(password);
      recovered = false;
    } catch {
      try {
        user = await ports.read();
      } catch {
        return { status: "pending" };
      }
    }
  }
  if (!user) return { status: "pending" };
  if (
    user.id !== job.user_id ||
    user.email?.toLowerCase() !== job.email ||
    user.app_metadata?.lovely_staff_job !== job.id ||
    user.app_metadata?.lovely_staff_actor !== job.actor_id
  )
    return { status: "conflict" };
  try {
    await ports.complete();
    return { status: "completed", recovered };
  } catch {
    return { status: "pending" };
  }
}
export function validEmployeePassword(value: string) {
  return value.length >= 12 && new TextEncoder().encode(value).length <= 72;
}
