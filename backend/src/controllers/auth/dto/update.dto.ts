export namespace UpdatePreferences {
  export interface body { theme?: string; gradient?: string }
  export interface response { message: string; preferences: { theme: string; gradient: string } }
  export interface error { message: string }
}
