import { WorkspaceShell } from "./workspace-shell";
export function StaffFrame(props: {
  title: string;
  description?: string;
  name: string;
  role: string;
  active: string;
  preview?: boolean;
  children: React.ReactNode;
}) {
  return <WorkspaceShell {...props} />;
}
export function Unavailable() {
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-8 text-red-800"
    >
      تعذر تحميل البيانات. راجع الاتصال والصلاحيات ثم أعد المحاولة. لم يتم تغيير
      أي بيانات.
    </p>
  );
}
export function AdminOnly() {
  return (
    <p className="studio-card p-8 text-sm leading-8">
      هذه الصفحة للأدمن فقط، ولم يتم تحميل أي بيانات خاصة.
    </p>
  );
}
