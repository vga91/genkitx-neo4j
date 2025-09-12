// src/graph-rag-offline.ts

// -------------------------------
// 🔹 Embedder mock
// -------------------------------
async function mockEmbedder(documents: { text: string }[]) {
  return documents.map((doc) => ({
    embedding: Array.from({ length: 384 }, (_, i) =>
      Math.sin((doc.text.charCodeAt(0) || 0) + i)
    ),
    metadata: { mocked: true },
  }));
}

// -------------------------------
// 🔹 Storage in memoria
// -------------------------------
type Document = { id: string; text: string; embedding: number[] };
const documentsCollection: Document[] = [];

// -------------------------------
// 🔹 Ingest document
// -------------------------------
async function ingestDocument(docId: string, text: string) {
  const embeddings = await mockEmbedder([{ text }]);

  documentsCollection.push({
    id: docId,
    text,
    embedding: embeddings[0].embedding,
  });

  console.log(`✅ Ingested: ${docId}`);
}

// -------------------------------
// 🔹 Simple retrieval (ranking mock)
// -------------------------------
async function retrieveDocuments(query: string, topK = 3) {
  const scored = documentsCollection.map((d) => ({
    doc: d,
    score: d.text
      .toLowerCase()
      .split(" ")
      .filter((w) => query.toLowerCase().includes(w)).length,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.doc);
}

// -------------------------------
// 🔹 GraphRAG query
// -------------------------------
async function queryGraphRAG(query: string) {
  const topDocs = await retrieveDocuments(query);

  console.log(`\n🔍 Query: "${query}"`);
  topDocs.forEach((d, i) =>
    console.log(`${i + 1}. ${d.text} (id: ${d.id})`)
  );
}

// -------------------------------
// 🔹 Main
// -------------------------------
async function main() {
  // Ingest esempio
  await ingestDocument("doc1", "Questo è un documento di prova");
  await ingestDocument(
    "doc2",
    "Altro documento per testare il retrieval mock"
  );
  await ingestDocument("doc3", "Ancora un documento di esempio offline");

  // Query
  await queryGraphRAG("documento prova");
  await queryGraphRAG("Altro esempio");

  console.log("\n✅ GraphRAG offline completato");
}

main().catch(console.error);
