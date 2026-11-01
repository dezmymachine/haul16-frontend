// The signed-in person. In sample-data mode there is a built-in demo session.
import { useQuery } from '@tanstack/react-query'
import { api, type Session } from './api'

export function useSession() {
  const q = useQuery<Session>({ queryKey: ['session'], queryFn: api.me, retry: false, staleTime: 60_000 })
  return { session: q.data, isPending: q.isPending, signedOut: q.isError }
}
