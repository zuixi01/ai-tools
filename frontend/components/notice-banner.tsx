type NoticeTone = "success" | "error" | "info";

const toneClasses: Record<NoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700"
};

export function NoticeBanner({
  tone,
  message,
  className = ""
}: {
  tone: NoticeTone;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]} ${className}`.trim()}
    >
      {message}
    </div>
  );
}
