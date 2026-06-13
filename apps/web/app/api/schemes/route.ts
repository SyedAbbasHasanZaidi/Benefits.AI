import { NextResponse } from 'next/server'

const RULES_URL = process.env.RULES_SERVICE_URL ?? 'http://localhost:8001'

export async function GET() {
  try {
    const res = await fetch(`${RULES_URL}/schemes`, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`Rules service ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('/api/schemes error:', err)
    return NextResponse.json({ schemes: [] }, { status: 502 })
  }
}
