import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface VipApplication {
  id?: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  email: string;
  country_code: string;
  telefono: string;
  wallet_address: string;
  plan_selected: '100' | '300';
  status: 'pending' | 'verified' | 'rejected';
  created_at?: string;
}
