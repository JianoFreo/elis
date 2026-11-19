export interface Row { dispatch_code: string; product: string; branch: string; batch_no: string | null; sent: number; received: number | null; variance: number | null; status: string; dispatched_at: string }

export interface List { in_transit: number; received_today: number; delivery_flags: number; dispatches: Row[] }

export interface Detail {
  dispatch: {
    dispatch_code: string; product: string; product_code: string; branch: string; batch_no: string | null; quantity_dispatched: number; quantity_received: number | null;
    status: string; dispatched_at: string; received_at: string | null; delivery_note: string | null; prepared_by: string | null; received_by: string | null;
  };
  discrepancy: { disc_code: string; status: string } | null;
}

