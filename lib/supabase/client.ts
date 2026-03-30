import { createClient as _createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof _createClient> | null = null

// Supabase 클라이언트 (타입 캐스팅 없이 사용)
export function createClient() {
  if (!client) {
    client = _createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}

// DB 스키마 타입 정의 없이도 동작하는 any-typed 클라이언트
// .update() .insert() 등에서 타입 충돌을 피할 때 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db() { return createClient() as any }
