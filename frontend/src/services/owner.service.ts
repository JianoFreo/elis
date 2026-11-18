import { api } from "../lib/axios";

export const ownerService = {
  setUserStatus: (user_id: string, account_status: boolean) =>
    api.patch(`/api/owner/users/${user_id}/status`, { account_status }),
  deactivateProduct: (product_code: string) => api.delete(`/api/owner/products/${product_code}`),
};
