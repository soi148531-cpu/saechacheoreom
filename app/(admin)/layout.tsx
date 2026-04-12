'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 자동으로 인증된 것으로 처리 - 로그인 페이지 제거
    setIsAuthenticated(true)
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">로드 중...</div>
  }

  if (!isAuthenticated) {
    router.replace('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* PC: 사이드바 여백, 모바일: 하단 네비 여백 */}
      <main className="md:ml-56 pb-20 md:pb-0 md:pt-16">
        {children}
      </main>
    </div>
  )
}
