// Which brand the console is looking at. Stored in localStorage and sent as X-Brand-Id on every API call.
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type BrandSummary } from './api'

const KEY = 'haul16.brand'
const listeners = new Set<() => void>()

export function getSelectedBrandId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function writeSelected(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked */
  }
  listeners.forEach((fn) => fn())
}

/** The brand list plus the brand in use (stored choice, else the one detection is watching, else the first). */
export function useBrands() {
  const qc = useQueryClient()
  const [stored, setStored] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setStored(getSelectedBrandId())
    sync()
    listeners.add(sync)
    return () => void listeners.delete(sync)
  }, [])
  const q = useQuery({ queryKey: ['brands'], queryFn: api.brands, refetchInterval: 15_000 })
  const list = q.data ?? []
  // A stored choice that no longer exists (brand removed, another environment) must not keep being sent as X-Brand-Id.
  useEffect(() => {
    if (q.data && stored && !q.data.some((b) => b.id === stored)) {
      writeSelected(null)
      void qc.invalidateQueries()
    }
  }, [q.data, stored, qc])
  const current: BrandSummary | undefined = list.find((b) => b.id === stored) ?? list.find((b) => b.is_active) ?? list[0]
  return {
    ...q,
    brands: list,
    current,
    select(id: string) {
      writeSelected(id)
      void qc.invalidateQueries() // every page is about the selected brand
    },
  }
}
