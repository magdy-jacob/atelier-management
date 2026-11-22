export function DashboardPeriodForm({
  from,
  to,
  preview = false,
}: {
  from: string;
  to: string;
  preview?: boolean;
}) {
  return (
    <form
      className="studio-card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      method="get"
    >
      <label className="field min-w-0 flex-1">
        من يوم
        <input
          type="date"
          name="from"
          defaultValue={from}
          disabled={preview}
          required
        />
      </label>
      <label className="field min-w-0 flex-1">
        إلى يوم
        <input
          type="date"
          name="to"
          defaultValue={to}
          disabled={preview}
          required
        />
      </label>
      <button
        className="h-11 rounded-xl bg-primary px-6 text-xs text-white"
        disabled={preview}
        type="submit"
      >
        عرض الفترة
      </button>
    </form>
  );
}
