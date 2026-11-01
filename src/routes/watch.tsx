import { createFileRoute, redirect } from '@tanstack/react-router'

// The old Watch page is now Home.
export const Route = createFileRoute('/watch')({ beforeLoad: () => { throw redirect({ to: '/home' }) } })
