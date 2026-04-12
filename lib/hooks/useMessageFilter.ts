import { useState } from 'react'
import type { MessageFilter, Billing } from '@/types'
import { filterMessageStatus } from '@/lib/services/messageService'

export function useMessageFilter(initialBillings: Billing[]) {
  const [filter, setFilter] = useState<MessageFilter>('all')

  const filtered = filterMessageStatus(initialBillings, filter)

  return {
    filter,
    setFilter,
    filtered,
    counts: {
      total: initialBillings.length,
      sent: initialBillings.filter(b => b.message_sent_at !== null).length,
      unsent: initialBillings.filter(b => b.message_sent_at === null).length
    }
  }
}
