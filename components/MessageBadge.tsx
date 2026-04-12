interface MessageBadgeProps {
  messageSentAt: string | null
}

export function MessageBadge({ messageSentAt }: MessageBadgeProps) {
  if (!messageSentAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded">
        🚫 카톡 미발송
      </span>
    )
  }

  const time = new Date(messageSentAt).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded">
      ✅ 발송완료 {time}
    </span>
  )
}
