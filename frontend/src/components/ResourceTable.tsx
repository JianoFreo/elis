import { useEffect, useState } from "react";
import { api } from "../lib/axios";

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
      <h1>{title}</h1>
      {error && <p className="m-0 text-danger">{error}</p>}
      {!rows && !error && <p className="text-mute">Loading...</p>}
      {rows && (
        <div className="overflow-x-auto rounded-md border border-line bg-white "><table>
          <thead>
            <tr>{columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} className="text-mute">No records yet.</td></tr>}
            {rows.map((row, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.header}>{c.render(row)}</td>)}</tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
