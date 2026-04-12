const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://zzeyflxnmolfoqrvlxwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'
);

async function analyze() {
  console.log('📊 황영훈 4월 모든 세차 기록 분석\n');

  const { data: records } = await supabase
    .from('wash_records')
    .select('id, wash_date, vehicle_id, is_completed, completed_by, created_at')
    .eq('completed_by', '황영훈')
    .gte('wash_date', '2026-04-01')
    .lte('wash_date', '2026-04-30')
    .order('wash_date', { ascending: false });

  if (!records) {
    console.log('❌ 데이터 로드 실패');
    return;
  }

  console.log(`총 ${records.length}개 기록\n`);

  // 날짜별로 그룹화
  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.wash_date]) byDate[r.wash_date] = [];
    byDate[r.wash_date].push(r);
  });

  // 날짜별 출력
  Object.keys(byDate).sort().reverse().forEach(date => {
    const dayRecords = byDate[date];
    console.log(`📅 ${date}: ${dayRecords.length}개 기록`);
    dayRecords.forEach((r, i) => {
      const status = r.is_completed ? '✅ 완료' : '❌ 취소';
      console.log(`   [${i + 1}] ${status} | ID: ${r.id}`);
      if (dayRecords.length > 1 && !r.is_completed) {
        console.log(`       ⚠️  삭제 필요 ID: ${r.id}`);
      }
    });
    console.log('');
  });

  // 중복 찾기
  console.log('\n🔎 분석 결과:');
  let duplicateCount = 0;
  Object.keys(byDate).forEach(date => {
    if (byDate[date].length > 1) {
      const cancelled = byDate[date].filter(r => !r.is_completed);
      if (cancelled.length > 0) {
        console.log(`${date}: 중복 발견! 취소된 ${cancelled.length}개를 삭제 가능`);
        duplicateCount += cancelled.length;
      }
    }
  });

  if (duplicateCount === 0) {
    console.log('✅ 삭제할 중복 없음');
  } else {
    console.log(`\n총 ${duplicateCount}개의 취소된 기록을 삭제할 수 있습니다`);
  }
}

analyze();
