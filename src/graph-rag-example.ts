import { genkit, Document } from 'genkit';
import { neo4j, neo4jIndexerRef, neo4jRetrieverRef } from './index.js';
import googleAI from '@genkit-ai/googleai';

/* -------------------------------
   1️⃣ Configurazione Genkit con Neo4j
---------------------------------*/
const ai = genkit({
  plugins: [
    googleAI(),
    neo4j([
      {
        indexId: 'bob-facts-mock',
        // Embedder mockato: restituisce vettori numerici finti
        embedder: googleAI.embedder('gemini-embedding-001'),
        // Parametri per connettersi a Neo4j
        clientParams: {
          url: 'bolt://localhost:7689',
          username: 'neo4j',
          password: 'apoc12345',
          database: 'neo4j',
        },
      },
    ]),
  ],
});

/* -------------------------------
   2️⃣ Funzione per inserire documenti (Indexing)
---------------------------------*/
async function ingestDocuments() {
  const bobFactsIndexer = neo4jIndexerRef({ indexId: 'bob-facts-mock' });

  const newDocs = [
    new Document({
      content: [{ text: 'Bob è un ingegnere software che ama l’escursionismo.' }],
      metadata: { source: 'bio', personName: 'Bob' },
    }),
    new Document({
      content: [{ text: 'Bob ha esperienza in JavaScript e Node.js.' }],
      metadata: { source: 'bio', personName: 'Bob' },
    }),
  ];

  await ai.index({ indexer: bobFactsIndexer, documents: newDocs });
  console.log('✅ Documenti indicizzati');
}

/* -------------------------------
   3️⃣ Funzione per recuperare documenti (Retrieval)
---------------------------------*/
async function retrieveDocuments(query: string) {
  const bobFactsRetriever = neo4jRetrieverRef({ indexId: 'bob-facts-mock' });

  // Retrieval: prendo i documenti più rilevanti
  const docs = await ai.retrieve({
    retriever: bobFactsRetriever,
    query,
    options: { k: 5 },
  });

  return docs;
}

/* -------------------------------
   4️⃣ Funzione di generazione risposta (Augmentation + Generation)
---------------------------------*/
async function generateAnswer(query: string) {
  // Augmentation: recupero i documenti rilevanti
  const docs = await retrieveDocuments(query);

  // Generation: costruisco la risposta concatenando i documenti
  const context = docs.map(d => d.content[0].text).join('\n');
  return `Query: "${query}"\nContext:\n${context}\nAnswer (mocked)`;
}

/* -------------------------------
   5️⃣ Esecuzione
---------------------------------*/
async function main() {
  await ingestDocuments();

  const answer = await generateAnswer('Chi è Bob?');
  console.log(answer);

  console.log('✅ Done');
}

main().catch(console.error);
