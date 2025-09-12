import neo4j from "neo4j-driver";

// -------------------------------
// 🔹 Neo4j setup (Database)
// -------------------------------
const driver = neo4j.driver(
  "bolt://localhost:7689",
  neo4j.auth.basic("neo4j", "apoc12345")
);
const session = driver.session();

// -------------------------------
// 🔹 Embedder mock (simula LLM embeddings)
// -------------------------------
async function mockEmbedder(documents: { text: string }[]) {
  // Ogni documento viene convertito in un embedding numerico fittizio
  return documents.map((doc) => ({
    embedding: Array.from({ length: 384 }, (_, i) =>
      Math.sin((doc.text.charCodeAt(0) || 0) + i)
    ),
    metadata: { mocked: true },
  }));
}

// -------------------------------
// 📥 INGESTION
// -------------------------------
async function ingestDocument(docId: string, text: string, parentId?: string) {
  // 1️⃣ Augment (simile a embedding)
  const embeddings = await mockEmbedder([{ text }]);
  const embeddingStr = JSON.stringify(embeddings[0].embedding);

  // Salvo in Neo4j con eventuale relazione padre-figlio
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
// 🔹 Retrieval (RAG: Retrieve)
// -------------------------------
async function retrieveDocuments(query: string, topK = 3) {
  // 1️⃣ Augment (ottengo embedding della query)
  const queryEmbedding = (await mockEmbedder([{ text: query }]))[0].embedding;

  // Recupero tutti i documenti da Neo4j
  const res = await session.run(
    `MATCH (d:Document) RETURN d.id AS id, d.text AS text, d.embedding AS embedding`
  );

  const docs = res.records.map((r) => ({
    id: r.get("id"),
    text: r.get("text"),
    embedding: JSON.parse(r.get("embedding")),
  }));

  // Ranking via cosine similarity
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
// 🧠 Generation (RAG: Generate)
// -------------------------------
async function generateAnswer(query: string, docs: { text: string; id: string }[]) {
  // Qui simuliamo la generazione: concateno query + top docs
  const context = docs.map((d) => `Document[${d.id}]: ${d.text}`).join("\n");
  const answer = `Query: "${query}"\nContext:\n${context}\n---\nAnswer (mocked)`;
  return answer;
}

// -------------------------------
// 🔹 Main (Esecuzione RAG)
// -------------------------------
async function main() {
  // Ingest
  await ingestDocument("doc1", "Documento di prova");
  await ingestDocument("doc2", "Altro documento per testing", "doc1");
  await ingestDocument("doc3", "Esempio offline di documento", "doc1");

  // 🔹 Query RAG
  const query = "documento prova";
  const topDocs = await retrieveDocuments(query);

  // 🔹 Generate (crea risposta basata sui documenti recuperati)
  const answer = await generateAnswer(query, topDocs);
  console.log("\n🔍 Answer:");
  console.log(answer);

  await session.close();
  await driver.close();
}

main().catch(console.error);
