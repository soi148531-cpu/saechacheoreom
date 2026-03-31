'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Users, Receipt, History, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',  label: '캘린더',   icon: CalendarDays },
  { href: '/customers',  label: '고객관리',  icon: Users },
  { href: '/billing',    label: '청구현황',  icon: Receipt },
  { href: '/history',    label: '이력조회',  icon: History },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <>
      {/* 상단 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <h1 className="text-lg font-bold tracking-tight">새차처럼</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/staff"
            className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckSquare size={16} />
            직원 페이지
          </Link>
        </div>
      </header>

      {/* 하단 네비게이션 (모바일) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden">
        <div className="grid grid-cols-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 사이드 네비게이션 (PC) */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen fixed left-0 top-0 pt-16 z-30">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </aside>
    </>
  )
}
