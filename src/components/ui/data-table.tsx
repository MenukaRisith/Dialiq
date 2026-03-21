import { Panel } from "@/components/ui/panel";

export function DataTable({
  headers,
  rows,
  caption,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  caption?: string;
}) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          {caption ? (
            <caption className="border-b border-[color:var(--border)] px-6 py-4 text-left text-sm text-[var(--muted)]">
              {caption}
            </caption>
          ) : null}
          <thead className="bg-black/3">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${caption ?? "table"}-${index}`}
                className="border-t border-[color:var(--border)] text-sm text-[var(--foreground)]"
              >
                {row.map((cell, cellIndex) => (
                  <td key={`${index}-${cellIndex}`} className="px-6 py-4 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
