export namespace SetUserStatus {
  export interface params { user_id: string }
  export interface body { account_status: boolean }
  export interface response { message: string }
  export interface error { message: string }
}

export namespace UpdateProduct {
  export interface params { product_code: string }
  export interface body {
    name?: string; description?: string; price?: number; cost?: number; threshold?: number; active?: boolean;
  }
  export interface response { message: string }
  export interface error { message: string }
}
