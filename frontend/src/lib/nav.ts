import { useSearchParams } from "react-router";

/** Navigate inside a Shell: go("record") or go("discrepancies", "DISC-001"). */
export function useGo() {
  const [params, setParams] = useSearchParams();
  const go = (page: string, id?: string) => setParams(id ? { page, id } : { page });
  return { go, id: params.get("id") };
}
