import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wjzvhcvaubunlkwvacbu.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Q_6HmTCXlj1y8acLHgVElQ_VoOBF5wX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
