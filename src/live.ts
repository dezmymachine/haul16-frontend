// One EventSource for the whole app. CT stats and pipeline events land in the
// TanStack Query cache, so any component can read them with useQuery.
import { useEffect } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import type { CtStats } from './api'
import { demoEnabled } from './demo'

export type LiveEvent =
  | ({ type: 'ct_stats' } & CtStats)
  | { type: 'hit'; threat_id: string; host: string; priority: number; reasons: string[]; source: string; ct_log?: string }
  | { type: 'capturing'; threat_id: string; host: string }
  | {
      type: 'scored'
      threat_id: string
      host: string
      confidence: string
      score: number
      reasons: string[]
      case_id?: string
      linked_via?: string[]
      notices_drafted?: number
      retry_in_s?: number
    }
  | { type: 'filed'; notice_id: string; case_id: string; channel: string }

export type FeedItem = LiveEvent & { at: number; key: string }

const FEED_KEY = ['live', 'feed']
const CT_KEY = ['live', 'ct']
const RATE_KEY = ['live', 'rate']
const CONN_KEY = ['live', 'connected']

let seq = 0

function handleEvent(qc: QueryClient, ev: LiveEvent) {
  if (ev.type === 'ct_stats') {
    qc.setQueryData(CT_KEY, ev)
    if (typeof ev.rate_now === 'number') {
      qc.setQueryData<number[]>(RATE_KEY, (old = []) => [...old, ev.rate_now!].slice(-60))
    }
    return
  }
  const item: FeedItem = { ...ev, at: Date.now(), key: `${Date.now()}-${seq++}` }
  qc.setQueryData<FeedItem[]>(FEED_KEY, (old = []) => [item, ...old].slice(0, 80))
  // Refresh whatever the event changed.
  qc.invalidateQueries({ queryKey: ['stats'] })
  if (ev.type === 'scored' || ev.type === 'filed') qc.invalidateQueries({ queryKey: ['notices'] })
  if (ev.type === 'scored' || ev.type === 'hit') qc.invalidateQueries({ queryKey: ['threats'] })
  if (ev.type === 'scored' && ev.case_id) {
    qc.invalidateQueries({ queryKey: ['cases'] })
    qc.invalidateQueries({ queryKey: ['case', ev.case_id] })
  }
  if (ev.type === 'filed') qc.invalidateQueries({ queryKey: ['case', ev.case_id] })
}

export function useLiveConnection(qc: QueryClient, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let stopMock: (() => void) | undefined
    let closed = false

    const connect = () => {
      es = new EventSource('/api/events')
      es.onopen = () => qc.setQueryData(CONN_KEY, true)
      es.onerror = () => {
        qc.setQueryData(CONN_KEY, false)
        es?.close()
        if (!closed) retry = setTimeout(connect, 3000)
      }
      es.onmessage = (msg) => handleEvent(qc, JSON.parse(msg.data) as LiveEvent)
    }

    // No backend (sample data): drive the same cache from the in-browser event stream.
    void demoEnabled().then(async (demo) => {
      if (closed) return
      if (!demo) return connect()
      const { subscribe } = await import('./mock/server')
      if (closed) return
      qc.setQueryData(CONN_KEY, true)
      stopMock = subscribe((ev) => handleEvent(qc, ev))
    })

    return () => {
      closed = true
      clearTimeout(retry)
      es?.close()
      stopMock?.()
    }
  }, [qc, enabled])
}

const never = () => new Promise<never>(() => {})

export const useFeed = () =>
  useQuery<FeedItem[]>({ queryKey: FEED_KEY, queryFn: never, initialData: [], staleTime: Infinity }).data
export const useCt = () =>
  useQuery<CtStats | null>({ queryKey: CT_KEY, queryFn: never, initialData: null, staleTime: Infinity }).data
export const useRate = () =>
  useQuery<number[]>({ queryKey: RATE_KEY, queryFn: never, initialData: [], staleTime: Infinity }).data
export const useConnected = () =>
  useQuery<boolean>({ queryKey: CONN_KEY, queryFn: never, initialData: false, staleTime: Infinity }).data
