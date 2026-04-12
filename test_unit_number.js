const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://zzeyflxnmolfoqrvlxwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZXlmbHhubW9sZm9xcnZseHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc2ODIsImV4cCI6MjA5MDMzMzY4Mn0.CKDa59JyhsyjF232I2S5uKrQ5sbvBFFx4y3hr7id7I8'
);

(async () => {
  try {
    // 모든 고객 정보 조회 (동호수 포함)
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, apartment, unit_number')
      .limit(5);
    
    if (customers && customers.length > 0) {
      console.log('\n=== 현재 고객 정보 ===');
      customers.forEach(c => {
        console.log(`고객: ${c.name} | 아파트: ${c.apartment} | 동호수: ${c.unit_number || '(없음)'}`);
      });
    }
  } catch (e) {
    console.log('오류:', e.message);
  }
})();
