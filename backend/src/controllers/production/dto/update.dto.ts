export namespace UpdateProductMaster {
  export interface body {
    name?: string; description?: string | null; price?: number; cost?: number;
    threshold?: number; active?: boolean;
  }
  export interface response { message: string }
}

export namespace UpdateMaterial {
  export interface body {
    name?: string; category?: string | null; unit?: string; cost?: number;
    threshold?: number; supplier?: string | null;
  }
  export interface response { message: string }
}
