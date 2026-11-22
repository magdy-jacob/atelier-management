export type CleanupPorts = {
  remove: () => Promise<unknown>;
  exists: () => Promise<boolean>;
  complete: () => Promise<void>;
};
// A transport failure does not tell us whether the delete committed. Verify the exact
// object's authenticated state, and keep the durable pending job on any uncertainty.
export async function finishImageCleanup(
  ports: CleanupPorts,
): Promise<"completed" | "pending"> {
  try {
    await ports.remove();
  } catch {
    /* Verify rather than treating a network error as an outcome. */
  }
  try {
    if (await ports.exists()) return "pending";
    await ports.complete();
    return "completed";
  } catch {
    return "pending";
  }
}
