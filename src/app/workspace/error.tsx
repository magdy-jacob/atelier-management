"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main
      dir="rtl"
      className="mx-auto max-w-lg space-y-6 px-6 py-20 text-center"
    >
      <h1 className="text-2xl">تعذر فتح مساحة العمل</h1>
      <p className="text-sm leading-8 text-muted-foreground">
        قد يكون الحساب غير نشط أو بدون صلاحيات، أو يوجد خطأ اتصال. راجع مسؤول
        النظام.
      </p>
      <div className="flex justify-center gap-5">
        <Button onClick={reset}>إعادة المحاولة</Button>
        <Link href="/login" className="p-2 text-sm underline">
          صفحة الدخول
        </Link>
      </div>
    </main>
  );
}
