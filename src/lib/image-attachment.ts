// An INSERT transport failure can arrive after commit. Recovery can confirm a
// link, but failure to find it never authorizes deleting the uploaded object.
export async function imageAttachmentConfirmed(
  insertFailed: boolean,
  recover: () => Promise<boolean>,
): Promise<boolean> {
  if (!insertFailed) return true;
  try {
    return await recover();
  } catch {
    return false;
  }
}
