const payrollId = '666217b0-d670-4ccf-8caa-4622f1dcee25';

(async () => {
  try {
    const response = await fetch('http://localhost:3001/api/payroll/' + payrollId + '/details');
    const data = await response.json();
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Wash records count:', data.data?.wash_records?.length || 0);
    if (data.data?.wash_records?.length > 0) {
      console.log('🔹 Sample records:');
      data.data.wash_records.slice(0, 5).forEach((r, i) => {
        console.log(`  [${i+1}] ${r.date} | 🚗 ${r.carName} | 📋 ${r.plateNumber} | ${r.hasInteriorCleaning ? '✨ 실내청소' : '세차'}`);
      });
    } else {
      console.log('⚠️ No wash records found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
