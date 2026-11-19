import { useCallback, useEffect, useState } from "react";
import { api } from "./axios";
import { currentUser, errMsg } from "./useApi";
import {
  readLocalSales,
  salesKey,
  type LocalSale,
  type SalesContext,
} from "./offlineSales";
export interface SalesWorkspace {
  branch: string;
  branch_id: number;
  date: string;
  shift: string;
  sales_total: number;
  items_sold: number;
  queued: number;
  expected_on_hand: number;
  step: number;
  closing: { close_code: string; status: string } | null;
  products: {
    product_code: string;
    name: string;
    price: number;
    expected: number;
  }[];
  recent: {
    txn_code: string | null;
    local_ref: string | null;
    sold_at: string;
    product: string;
    quantity: number;
    line_total: number;
    status: string;
  }[];
}
export function salesContext(): SalesContext {
  const u = currentUser();
  return { userId: u.user_id, branchId: u.branch_id ?? 0 };
}
export function useLocalSales() {
  const context = salesContext(),
    key = salesKey(context),
    [rows, setRows] = useState<LocalSale[]>([]),
    [error, setError] = useState("");
  const reload = useCallback(() => {
    try {
      setRows(readLocalSales(context));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [key]);
  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener("eyk:sales-outbox", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("eyk:sales-outbox", reload);
    };
  }, [reload]);
  return { context, rows, error, reload };
}
export function useSalesWorkspace() {
  const key = salesKey(salesContext()) + ":workspace";
  const [data, setData] = useState<SalesWorkspace | null>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? "null");
      return Array.isArray(cached?.products) && cached?.date ? cached : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<SalesWorkspace>("/api/sales/workspace");
      setData(r.data);
      setStale(false);
      setError("");
      try {
        localStorage.setItem(key, JSON.stringify(r.data));
      } catch {
        setError(
          "Online data loaded, but an offline workspace copy could not be saved on this device.",
        );
      }
    } catch (e) {
      setError(
        errMsg(
          e,
          "Cannot reach the server. Cached figures, if available, may have changed.",
        ),
      );
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [key]);
  useEffect(() => {
    reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [reload]);
  return { data, loading, error, stale, reload };
}
