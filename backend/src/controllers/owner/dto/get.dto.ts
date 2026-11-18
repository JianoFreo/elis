export namespace GetUsers {
  export interface response {
    users: {
      user_id: string; username: string; full_name: string; email: string | null; role: string;
      branch: string | null; account_status: boolean; active: boolean; last_login: string | null;
    }[];
  }
}

export namespace GetProducts {
  export interface response {
    products: {
      product_code: string; name: string; description: string | null;
      price: string; cost: string; threshold: number; active: boolean;
    }[];
  }
}

export namespace GetMaterials {
  export interface response {
    materials: {
      material_code: string; name: string; category: string | null; unit: string;
      cost: string; threshold: string; supplier: string | null; active: boolean;
    }[];
  }
}
