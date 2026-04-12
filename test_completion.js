const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zzeyflxnmolfoqrvlxwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'
);

async function test() {
  const today = new Date().toISOString().split('T')[0];
  console.log('시스템 오늘 날짜:', today);
  
  // 4월 스케줄
  const { data: aprilSchedules } = await supabase
    .from('schedules')
    .select('id, scheduled_date, vehicle_id, is_deleted')
    .gte('scheduled_date', '2026-04-01')
    .lte('scheduled_date', '2026-04-10')
    .eq('is_deleted', false)
    .limit(1);

  if (aprilSchedules && aprilSchedules.length > 0) {
    const schedule = aprilSchedules[0];
    console.log('테스트 스케줄:', schedule.scheduled_date);
    
    // 워커 확인
    const { data: workers } = await supabase
      .from('workers')
      .select('id, name')
      .limit(1);
    
    if (workers && workers.length > 0) {
      const worker = workers[0];
      console.log('워커:', worker.name);
      
      // API 테스트
      console.log('\n세차 완료 처리 API 호출...');
      const response = await fetch('http://localhost:3000/api/wash-records/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: schedule.vehicle_id,
          schedule_id: schedule.id,
          wash_date: schedule.scheduled_date,
          price: 30000,
          service_type: 'regular',
          worker_id: worker.id,
          worked_by: 'worker',
          completed_by: worker.name,
          memo: 'API 테스트',
        }),
      });

      const result = await response.json();
      console.log('\nAPI 응답 상태:', response.status);
      
      if (response.ok && result.data) {
        const saved = result.data[0];
        console.log('✅ 저장 성공!');
        console.log('  ID:', saved.id.substring(0, 12));
        console.log('  completed_by:', saved.completed_by);
        console.log('  worked_by:', saved.worked_by);
        console.log('  is_completed:', saved.is_completed);
      } else {
        console.log('❌ 실패:', result.error || result.message);
      }
    }
  } else {
    console.log('❌ 테스트 스케줄을 찾을 수 없습니다');
  }
}

test().catch(err => {
  console.error('❌ 에러:', err.message);
  process.exit(1);
});
