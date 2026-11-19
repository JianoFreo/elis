type Row = object;

export namespace ListDispatches {
  export interface response { in_transit: number; received_today: number; delivery_flags: number; dispatches: Row[] }
}

export namespace DispatchDetail {
  export interface response { dispatch: Row; discrepancy: Row | null }
}

export namespace Inventory {
  export interface response { hub_total: number; branch_total: number; low_stock: number; rows: Row[] }
}

export namespace ProductLedger {
  export interface response { product: Row; on_hand: number; batch: Row | null; movements: Row[] }
}

export namespace ListSupplies {
  export interface response { [key: string]: unknown }
}

export namespace ListUsage {
  export interface response { date: string; records: Row[] }
}

export namespace Alerts {
  export interface response { [key: string]: unknown }
}

export namespace OpeningPrefill {
  export interface response { material_code: string; unit: string; opening_qty: number }
}
