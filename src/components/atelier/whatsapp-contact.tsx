import links from "@/lib/whatsapp-links.json";
import { MessageCircle } from "lucide-react";
export function WhatsAppContact({ code }: { code?: string }) {
  const known = links as Record<string, string>;
  // The canonical contact target and copy are generated during configuration.
  // URLSearchParams handles product codes entered by the owner after deployment.
  const target = new URL(known.general);
  if (code)
    target.searchParams.set(
      "text",
      `مرحبًا، أريد الاستفسار عن الفستان كود ${code}.`,
    );
  const href = code ? (known[code] ?? target.toString()) : known.general;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        code
          ? `اسألي عن الفستان ${code} على واتساب`
          : "تواصلي مع الأتيليه على واتساب"
      }
      className="fixed bottom-6 left-5 z-40 flex size-14 items-center justify-center rounded-full border-2 border-white bg-[#128c4a] text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128c4a] md:bottom-8 md:left-8"
    >
      <MessageCircle size={29} />
    </a>
  );
}
