export namespace Login {
  export interface body { username: string; password: string }
  export interface response {
    message: string;
    token: string;
    user: {
      user_id: string; username: string; full_name: string; role: string;
      branch_id: number | null; branch: string | null;
    };
  }
  export interface error { message: string }
}
