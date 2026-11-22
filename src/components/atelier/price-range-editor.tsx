"use client";
import { useActionState } from "react";
import { saveDressPriceRange, type ActionState } from "@/app/actions";
import { money } from "@/lib/domain";
import { Button } from "@/components/ui/button";
export type DressPriceRange = {
  minimum_price_piasters: number | null;
  maximum_price_piasters: number | null;
  advisory_price_piasters: number | null;
  version: number;
};
export function PriceRangeEditor({
  dressId,
  price,
}: {
  dressId: string;
  price: DressPriceRange | null;
}) {
  const [state, action, pending] = useActionState(
    saveDressPriceRange,
    {} as ActionState,
  );
  const min = price?.minimum_price_piasters ?? price?.advisory_price_piasters;
  const max = price?.maximum_price_piasters ?? price?.advisory_price_piasters;
  return (
    <section className="studio-card space-y-5 p-6 md:p-8">
      <h2 className="text-lg">نطاق السعر الاسترشادي</h2>
      <p className="text-sm">
        {min != null && max != null ? (
          <>
            {money(min)} <span className="mx-2 text-muted-foreground">إلى</span>{" "}
            {money(max)}
          </>
        ) : (
          "لم يُحدد السعر بعد"
        )}
      </p>
      <form key={price?.version ?? 0} action={action} className="space-y-5">
        <input type="hidden" name="dress_id" value={dressId} />
        <input type="hidden" name="version" value={price?.version ?? 0} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            السعر من، جنيه
            <input
              name="minimum"
              type="number"
              min="0"
              step="0.01"
              max="99999999.99"
              required
              dir="ltr"
              defaultValue={min != null ? min / 100 : ""}
            />
          </label>
          <label className="field">
            السعر إلى، جنيه
            <input
              name="maximum"
              type="number"
              min="0"
              step="0.01"
              max="99999999.99"
              required
              dir="ltr"
              defaultValue={max != null ? max / 100 : ""}
            />
          </label>
        </div>
        {state.error && (
          <p role="alert" className="text-xs text-red-800">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-xs text-primary">
            {state.success}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ نطاق السعر"}
        </Button>
      </form>
    </section>
  );
}
