const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://zzeyflxnmolfoqrvlxwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'
);

async function checkDuplicates() {
  console.log('🔍 4월 8일 황영훈 세차 기록 검사중...\n');

  const { data: records } = await supabase
    .from('wash_records')
    .select('id, wash_date, vehicle_id, is_completed, completed_by, created_at')
    .eq('wash_date', '2026-04-08')
    .eq('completed_by', '황영훈');

  if (records && records.length > 0) {
    console.log(`⚠️  발견: ${records.length}개 기록\n`);
    records.forEach((r, i) => {
      const status = r.is_completed ? '✅ 완료' : '❌ 취소';
      console.log(`[${i + 1}] ID: ${r.id}`);
      console.log(`    상태: ${status}`);
      console.log(`    생성: ${r.created_at}`);
      console.log('');
    });

    // 취소된 기록 찾기
    const cancelledRecords = records.filter(r => !r.is_completed);
    if (cancelledRecords.length > 0) {
      console.log(`\n🗑️  삭제할 기록 (취소된 것들): ${cancelledRecords.length}개`);
      cancelledRecords.forEach(r => {
        console.log(`   - ${r.id}`);
      });
    }
  } else {
    console.log('✅ 중복 없음');
  }
}

checkDuplicates();
