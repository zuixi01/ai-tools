export function SettingPanel({
  title,
  description,
  values
}: {
  title: string;
  description: string;
  values: string[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4 space-y-3">
        {values.map((value) => (
          <div key={value} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {value}
          </div>
        ))}
      </div>
    </section>
  );
}
