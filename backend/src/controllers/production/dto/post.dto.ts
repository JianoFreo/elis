export namespace CreateDispatch {
  export interface body { product_code: string; batch_no: string; branch_id: number; quantity: number }
  export interface response { [key: string]: unknown }
}

export namespace RegisterProduct {
  export interface body { name: string; price: number; cost: number; threshold?: number; description?: string | null }
  export interface response { message: string; product_code: string }
}

export namespace RecordProduction {
  export interface body { product_code: string; batch_no: string; quantity: number; best_before?: string | null }
  export interface response { [key: string]: unknown }
}

export namespace StockBaseline {
  export interface body {
    product_code: string; batch_no: string; branch_id: number; quantity: number;
    entry_type?: "opening" | "received";
  }
  export interface response { [key: string]: unknown }
}

export namespace RegisterMaterial {
  export interface body { name: string; unit: string; cost: number; threshold: number; category?: string | null; supplier?: string | null }
  export interface response { message: string; material_code: string }
}

export namespace StockIn {
  export interface body {
    material_code: string; quantity: number; unit_cost: number; received_on: string;
    supplier?: string | null; receipt_ref?: string | null;
  }
  export interface response { [key: string]: unknown }
}

export namespace LogOpening {
  export interface body { material_code: string; opening_qty: number; shift?: string }
  export interface response { [key: string]: unknown }
}

export namespace LogClosing {
  export interface body { material_code: string; closing_qty: number }
  export interface response { [key: string]: unknown }
}
