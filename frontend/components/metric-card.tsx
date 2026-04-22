export function MetricCard({
  title,
  value,
  hint
}: {
  title: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-4xl font-semibold text-slate-900">{value}</div>
      <div className="mt-3 text-sm leading-6 text-slate-600">{hint}</div>
    </div>
  );
}

