import { useCallback, useEffect, useState } from "react";
import { api } from "./axios";

export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

/** GET `url` (pass null to skip) and keep the result; `reload()` refetches. */
export function useApi<T>(url: string | null, params?: Record<string, string | number | undefined>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!url);
  const key = url ? url + JSON.stringify(params ?? {}) : "";

  const load = useCallback(() => {
    if (!url) return Promise.resolve();
    setLoading(true);
    return api.get(url, { params })
      .then((r) => { setData(r.data); setError(""); })
      .catch((e) => setError(errMsg(e, "Failed to load")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

/** Download a CSV report with the auth header. */
export async function downloadCsv(url: string, params: Record<string, string | number | undefined>, filename: string) {
  const r = await api.get(url, { params: { ...params, format: "csv" }, responseType: "blob" });
  const href = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(href);
}

export const currentUser = () => JSON.parse(sessionStorage.getItem("user") ?? "{}") as {
  user_id: string; username: string; full_name: string; role: string; branch_id: number | null; branch: string | null;
};
