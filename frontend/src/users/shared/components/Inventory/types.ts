export interface Row {
  product_code: string;
  product: string;
  location: string;
  kind: string;
  batch_no: string | null;
  best_before: string | null;
  threshold: number;
  qty: number;
  status: string;
}

export interface Inv {
  hub_total: number;
  branch_total: number;
  low_stock: number;
  rows: Row[];
}

export interface Lookup {
  products: { product_code: string; name: string }[];
}

export interface Branches {
  branches: { id: number; name: string; kind: string }[];
}

export interface Detail {
  product: {
    product_code: string;
    name: string;
    description: string | null;
    price: number;
    cost: number;
    threshold: number;
  };
  on_hand: number;
  batch: { batch_no: string; best_before: string | null } | null;
  movements: {
    created_at: string;
    movement_type: string;
    quantity: number;
    reference: string | null;
    location: string;
    staff: string | null;
    batch_no: string | null;
  }[];
}

