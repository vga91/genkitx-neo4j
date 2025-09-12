import neo4j from "neo4j-driver";

// -------------------------------
// 🔹 Neo4j setup
// -------------------------------
const driver = neo4j.driver(
  "bolt://localhost:7689",
  neo4j.auth.basic("neo4j", "apoc12345")
);
const session = driver.session();

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
// 🔹 Ingest document in Neo4j
// -------------------------------
async function ingestDocument(docId: string, text: string, parentId?: string) {
  const embeddings = await mockEmbedder([{ text }]);

  const embeddingStr = JSON.stringify(embeddings[0].embedding);

  await session.run(
    `
    MERGE (d:Document {id: $id})
    SET d.text = $text, d.embedding = $embedding
    ${parentId ? "WITH d MATCH (p:Document {id: $parentId}) MERGE (p)-[:HAS_CHILD]->(d)" : ""}
    `,
    { id: docId, text, embedding: embeddingStr, parentId }
  );

  console.log(`✅ Ingested: ${docId}`);
}

// -------------------------------
// 🔹 Retrieve top-K similar documents (mock cosine)
// -------------------------------
async function retrieveDocuments(query: string, topK = 3) {
  const queryEmbedding = (await mockEmbedder([{ text: query }]))[0].embedding;

  const res = await session.run(`MATCH (d:Document) RETURN d.id AS id, d.text AS text, d.embedding AS embedding`);
  const docs = res.records.map((r) => ({
    id: r.get("id"),
    text: r.get("text"),
    embedding: JSON.parse(r.get("embedding")),
  }));

  function cosine(a: number[], b: number[]) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    return dot / (magA * magB);
  }

  const scored = docs
    .map((d) => ({ doc: d, score: cosine(d.embedding, queryEmbedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((s) => s.doc);
}

// -------------------------------
// 🔹 Main
// -------------------------------
async function main() {
  // Ingest
  await ingestDocument("doc1", "Documento di prova");
  await ingestDocument("doc2", "Altro documento per testing", "doc1");
  await ingestDocument("doc3", "Esempio offline di documento", "doc1");

  // Query
  const results = await retrieveDocuments("documento prova");
  console.log("\n🔍 Query results:");
  results.forEach((d, i) => console.log(`${i + 1}. ${d.text} (id: ${d.id})`));

  await session.close();
  await driver.close();
}

main().catch(console.error);
