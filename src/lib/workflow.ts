import { validDay } from "./domain";
import { z } from "zod";
export const inspectionIssues = [
  "accessories",
  "zipper",
  "sewing",
  "tear",
] as const;
export const inspectionLabels: Record<
  (typeof inspectionIssues)[number],
  string
> = { accessories: "إكسسوارات", zipper: "سوستة", sewing: "خياطة", tear: "قطع" };
export type HandoverRecord = {
  id: string;
  handed_over_on: string;
  card_received: boolean;
  recorded_by: string;
};
export type ReturnRecord = {
  id: string;
  returned_on: string;
  card_released: boolean;
  inspection: string;
  issues: string[];
  recorded_by: string;
};
export function handoverInPlannedDays(
  today: string,
  start: string,
  end: string,
) {
  return (
    validDay(today) &&
    validDay(start) &&
    validDay(end) &&
    today >= start &&
    today <= end
  );
}

const handoverSchema = z.object({
  id: z.string(),
  handed_over_on: z.string().refine(validDay),
  card_received: z.boolean(),
  recorded_by: z.string(),
});
const returnSchema = z.object({
  id: z.string(),
  returned_on: z.string().refine(validDay),
  card_released: z.boolean(),
  inspection: z.enum(["sound", "maintenance"]),
  issues: z.array(z.enum(inspectionIssues)),
  recorded_by: z.string(),
});
export const workflowSchema = z.object({
  today: z.string().refine(validDay),
  handover: handoverSchema.nullable(),
  return: returnSchema.nullable(),
  operation: z
    .enum(["in_atelier", "outside", "preparation", "maintenance"])
    .nullable(),
  ready_on: z.string().refine(validDay).nullable(),
  maintenance_required: z.boolean().default(false),
});
export type WorkflowData = z.infer<typeof workflowSchema>;
