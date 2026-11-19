type Row = object;

export namespace Workspace {
  export interface response {
    branch: string; branch_id: number; date: string; shift: string;
    sales_total: number; items_sold: number; queued: number; expected_on_hand: number;
    closing: Row | null; step: number; products: Row[]; recent: Row[];
  }
}

export namespace ListQueue {
  export interface response { queue: Row[] }
}

export namespace ListSales {
  export interface response { sales: Row[] }
}

export namespace ClosingCount {
  export interface response { [key: string]: unknown }
}

export namespace DailySummary {
  export interface response { [key: string]: unknown }
}

export namespace IncomingDispatches {
  export interface response { dispatches: Row[] }
}
