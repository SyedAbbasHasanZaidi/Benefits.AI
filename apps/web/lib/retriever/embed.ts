import { VoyageAIClient } from 'voyageai'

const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! })

export async function embedText(text: string): Promise<number[]> {
  const result = await client.embed({ input: text, model: 'voyage-3' })
  const embedding = result.data?.[0]?.embedding
  if (!embedding) throw new Error('voyageai embed returned no embedding')
  return embedding
}
