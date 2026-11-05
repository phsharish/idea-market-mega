
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rkhsfrocebxxgvemnjji.supabase.co'
const supabasePublishableKey = 'sb_publishable_WlSPAxKJWbuuz9KwlzXzGg_meC3p0eJ'

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)
