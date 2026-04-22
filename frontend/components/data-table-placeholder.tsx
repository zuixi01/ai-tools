export function DataTablePlaceholder({
  title,
  description,
  columns,
  emptyMessage
}: {
  title: string;
  description: string;
  columns: string[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:grid-cols-3 xl:grid-cols-6">
          {columns.map((column) => (
            <div key={column}>{column}</div>
          ))}
        </div>

        <div className="px-6 py-16 text-center text-sm text-slate-500">{emptyMessage}</div>
      </div>
    </div>
  );
}

