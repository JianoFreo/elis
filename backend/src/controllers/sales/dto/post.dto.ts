export namespace RecordSale {
  export interface body {
    product_code: string; quantity: number;
    offline?: boolean; local_ref?: string; sold_at?: string;
  }
  export interface response { [key: string]: unknown }
}

export namespace SyncQueue {
  export interface response { [key: string]: unknown }
}

export namespace SubmitClosing {
  export interface body {
    counts: { product_code: string; physical: number }[];
    note?: string | null;
  }
  export interface response { [key: string]: unknown }
}

export namespace ReceiveDispatch {
  export interface body { quantity_received: number; delivery_note?: string | null }
  export interface response { [key: string]: unknown }
}
