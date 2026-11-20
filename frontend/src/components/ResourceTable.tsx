import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { TBODY, TD, TH } from "./ui";

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

// Fetches `GET <url>` and renders `data[key]` as a table.
export default function ResourceTable<T>({
  title, url, dataKey, columns,
}: { title: string; url: string; dataKey: string; columns: Column<T>[] }) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(url)
      .then((r) => setRows(r.data[dataKey]))
      .catch((e) => setError(e.response?.data?.message ?? "Failed to load"));
  }, [url, dataKey]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight max-md:text-xl">{title}</h1>
      {error && <p className="m-0 text-danger">{error}</p>}
      {!rows && !error && <p className="text-mute">Loading...</p>}
      {rows && (
        <div className="overflow-x-auto rounded-lg border border-white/70 bg-white shadow-soft "><table className="w-full border-collapse">
          <thead>
            <tr>{columns.map((c) => <th key={c.header} className={`${TH} text-left`}>{c.header}</th>)}</tr>
          </thead>
          <tbody className={TBODY}>
            {rows.length === 0 && <tr><td colSpan={columns.length} className={`${TD} text-left text-mute`}>No records yet.</td></tr>}
            {rows.map((row, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.header} className={`${TD} text-left`}>{c.render(row)}</td>)}</tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
