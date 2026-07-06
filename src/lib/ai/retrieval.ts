import { prisma } from "../db";

/**
 * Knowledge retrieval for RAG.
 *
 * Dev implementation: lexical scoring (term-frequency with title boost) over
 * KnowledgeChunk rows — zero external cost. The public interface is
 * embedding-ready: on PostgreSQL swap the internals for pgvector similarity
 * search without touching any caller.
 */

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export async function retrieveKnowledge(
  businessId: string,
  query: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { businessId, document: { status: "READY" } },
    include: { document: { select: { title: true } } },
    take: 2000, // guardrail for very large tenants; production uses vector index
  });

  const scored = chunks
    .map((chunk) => {
      const contentTokens = tokenize(chunk.content);
      const titleTokens = tokenize(chunk.document.title);
      let score = 0;
      for (const term of terms) {
        score += contentTokens.filter((t) => t === term || t.startsWith(term)).length;
        score += titleTokens.filter((t) => t === term).length * 3; // title hits weigh more
      }
      return {
        documentId: chunk.documentId,
        documentTitle: chunk.document.title,
        content: chunk.content,
        score,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/** Formats retrieved chunks into the context block agents receive. */
export function formatKnowledgeContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant knowledge base entries found.";
  return chunks
    .map((c, i) => `[Source ${i + 1}: ${c.documentTitle}]\n${c.content}`)
    .join("\n\n");
}
