import { genkit } from "genkit";
import { defineFirestoreRetriever } from "@genkit-ai/firebase";
import * as admin from "firebase-admin";
import neo4j from "neo4j-driver";
import { z } from "zod";

// -------------------------------
// 🔑 INIT
// -------------------------------
admin.initializeApp();
const firestore = admin.firestore();

const ai = genkit({
  plugins: [], // nessuna API esterna
});

const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password")
);

// Embedder mock
const mockEmbedder = ai.defineEmbedder(
  { name: "mock-embedder" },
  async (documents: { text: string }[]) => {
    return {
      embeddings: documents.map((doc) => ({
        embedding: Array.from({ length: 384 }, (_, i) =>
          Math.sin((doc.text.charCodeAt(0) || 0) + i)
        ),
        metadata: { mocked: true },
      })),
    };
  }
);

// Ingestione documenti
async function ingestDocument(docId: string, text: string) {
  const result = await mockEmbedder.call({
    input: [
      { content: [{ text }] }
    ],
    options: {},
  });

  await firestore.collection("documentsCollection").doc(docId).set({
    text,
    embedding: result.embeddings[0].embedding,
    metadata: result.embeddings[0].metadata,
  });

  console.log(`✅ Ingested: ${docId}`);
}




async function runIngestion() {
  await ingestDocument(
    "doc1",
    "Albert Einstein was a physicist who developed the theory of relativity."
  );
  await ingestDocument(
    "doc2",
    "Marie Curie discovered radium and polonium, and conducted pioneering research on radioactivity."
  );
  await ingestDocument(
    "doc3",
    "Isaac Newton formulated the laws of motion and universal gravitation."
  );
  console.log("📥 Dataset ingestito!");
}

// -------------------------------
// 🔎 RETRIEVERS
// -------------------------------
const vectorRetriever = defineFirestoreRetriever(ai, {
  name: "myVectorRetriever",
  firestore,
  collection: "documentsCollection",
  contentField: "text",
  vectorField: "embedding",
  embedder: mockEmbedder, // embedder mockato
  distanceMeasure: "COSINE",
});

// Funzione per interrogare Neo4j (graph)
async function graphQuery(query: string, k: number) {
  const session = driver.session();
  const result = await session.run(
    `
    MATCH (e:Entity)-[r]->(n)
    WHERE e.name CONTAINS $q
    RETURN n.text as text, properties(n) as metadata
    LIMIT $limit
    `,
    { q: query, limit: k }
  );
  await session.close();

  return result.records.map((rec) => ({
    text: rec.get("text"),
    metadata: rec.get("metadata"),
  }));
}

// Hybrid retriever con defineSimpleRetriever
const hybridRetriever = ai.defineSimpleRetriever(
  {
    name: "hybridRetriever",
    configSchema: z
      .object({
        kVector: z.number().optional(),
        kGraph: z.number().optional(),
        kTotal: z.number().optional(),
      })
      .optional(),
    content: "text",
    metadata: ["source", "score"],
  },
  async (input, config) => {
    const q = input.text;
    const kVector = config?.kVector ?? 2;
    const kGraph = config?.kGraph ?? 2;

    // retrieval Firestore
    const vectorDocs = await ai.retrieve({
      retriever: vectorRetriever,
      query: q,
      options: { k: kVector },
    });

    // retrieval Graph Neo4j
    const graphDocs = await graphQuery(q, kGraph);

    const merged = [
      ...vectorDocs.map((doc) => ({
        text: doc.content,
        metadata: { source: "vector", ...doc.metadata },
      })),
      ...graphDocs.map((d) => ({
        text: d.text,
        metadata: { source: "graph", ...d.metadata },
      })),
    ];

    const kTotal = config?.kTotal ?? merged.length;
    return merged.slice(0, kTotal);
  }
);

// -------------------------------
// 🤖 QUERY MOCK LLM
// -------------------------------
// async function ask(query: string) {
//   const docs = await ai.retrieve({
//     retriever: hybridRetriever,
//     query: {
//       input: [
//         {
//           content: [
//             {
//               text: query, // stringa della domanda
//             },
//           ],
//         },
//       ],
//     },
//     options: { kVector: 3, kGraph: 3, kTotal: 5 },
//   });

//   const text = `Risposta simulata alla domanda "${query}" usando ${docs.length} documenti rilevanti.`;

//   console.log("\n❓ Domanda:", query);
//   console.log("💡 Risposta:", text);
// }

// -------------------------------
// 🚀 MAIN
// -------------------------------
async function main() {
  await runIngestion();
//   await ask("Chi ha scoperto la teoria della relatività?");
//   await ask("Chi ha fatto ricerca sulla radioattività?");
//   await ask("Chi ha formulato le leggi del moto?");
  process.exit(0);
}

main();
