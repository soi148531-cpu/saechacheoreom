/**
 * Supabase Management API를 사용해 운영 DB에 직접 SQL을 실행합니다.
 *
 * 사용법:
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_xxxx..."
 *   node scripts/apply-migration.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const PROJECT_REF = 'zzeyflxnmolfoqrvlxwc'
const TOKEN       = process.env.SUPABASE_ACCESS_TOKEN

if (!TOKEN) {
  console.error('\n❌  SUPABASE_ACCESS_TOKEN 이 설정되지 않았습니다.')
  console.error('   터미널에서 먼저 실행하세요:')
  console.error('   $env:SUPABASE_ACCESS_TOKEN = "sbp_여기에토큰"\n')
  process.exit(1)
}

const __dir = dirname(fileURLToPath(import.meta.url))
const sql   = readFileSync(
  join(__dir, '../supabase/migrations/15_message_sent_at.sql'),
  'utf8'
)

console.log('\n📋  적용할 SQL:')
console.log('─'.repeat(60))
console.log(sql.trim())
console.log('─'.repeat(60))

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

let res
try {
  res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
} catch (e) {
  console.error('\n❌  네트워크 오류:', e.message)
  process.exit(1)
}

const text = await res.text()

if (!res.ok) {
  console.error(`\n❌  API 오류 (HTTP ${res.status}):`)
  try { console.error(JSON.stringify(JSON.parse(text), null, 2)) }
  catch { console.error(text) }
  process.exit(1)
}

console.log('\n✅  마이그레이션 완료!')
console.log('   billings.message_sent_at       ← 추가됨 (카톡 발송 시각)')
console.log('   message_templates 테이블       ← 생성됨 (메시지 템플릿)')
console.log('   idx_billings_message_sent_at   ← 인덱스 추가됨\n')
