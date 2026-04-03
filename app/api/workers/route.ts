import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, phone, status')
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (error) {
      return Response.json({ success: false, message: error.message }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (err) {
    return Response.json(
      { success: false, message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
