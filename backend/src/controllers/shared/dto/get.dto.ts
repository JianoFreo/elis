export namespace Branches {
  export interface response { branches: { id: number; name: string; kind: string }[] }
}

export namespace Products {
  export interface response { products: { product_code: string; name: string; price: number; threshold: number }[] }
}

export namespace Materials {
  export interface response {
    materials: { material_code: string; name: string; unit: string; cost: number; threshold: number; supplier: string | null }[];
  }
}
