export interface UserRow {
  user_id: string; username: string; full_name: string; email: string | null; role: string;
  branch: string | null; account_status: boolean; active: boolean; last_login: string | null;
}

export interface ProductRow {
  product_code: string; name: string; description: string | null;
  price: string; cost: string; threshold: number; active: boolean;
}

export interface MaterialRow {
  material_code: string; name: string; category: string | null; unit: string;
  cost: string; threshold: string; supplier: string | null; active: boolean;
}
