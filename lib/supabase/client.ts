import { createClient as _createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof _createClient> | null = null

// Supabase 연결 정보 (Vercel 환경변수 인라인 문제 방지용 하드코딩)
const SUPABASE_URL = 'https://zzeyflxnmolfoqrvlxwc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'

// Supabase 클라이언트 (타입 캐스팅 없이 사용)
export function createClient() {
  if (!client) {
    client = _createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}

// DB 스키마 타입 정의 없이도 동작하는 any-typed 클라이언트
// .update() .insert() 등에서 타입 충돌을 피할 때 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db() { return createClient() as any }
