import { NextResponse } from 'next/server'

/**
 * GET /api/time/now
 * 서버의 현재 시간을 KST 기준으로 반환
 * 클라이언트 타임존 문제를 방지하기 위해 서버에서 정확한 KST 시간을 제공
 */
export async function GET() {
  try {
    // 서버 현재 시간 (UTC)
    const now = new Date()
    
    // UTC를 기준으로 KST(+9시간) 계산
    const utcTime = now.getTime()
    const kstTime = utcTime + (9 * 60 * 60 * 1000)
    const kstDate = new Date(kstTime)
    
    // ISO 문자열로 변환
    const isoString = kstDate.toISOString()
    const dateString = isoString.split('T')[0]
    
    return NextResponse.json({
      success: true,
      now: isoString,
      today: dateString,
      timestamp: kstDate.getTime(),
      timezone: 'KST (UTC+9)'
    })
  } catch (error) {
    console.error('시간 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '시간 조회 실패' },
      { status: 500 }
    )
  }
}
