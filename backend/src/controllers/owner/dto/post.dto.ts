export namespace AddProduct {
  export interface body { name: string; description?: string; price: number; cost: number; threshold?: number }
  export interface response { message: string; product_code: string }
  export interface error { message: string }
}

export namespace AddUser {
  export interface body {
    username: string; password: string; full_name: string; email?: string;
    role: "owner" | "sales-staff" | "production-head" | "production-staff"; branch_id?: number | null;
  }
  export interface response { message: string; user_id: string }
  export interface error { message: string }
}
