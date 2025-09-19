import { genkit, z, Document } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// import { neo4j } from 'genkitx-neo4j';
import neo4jDriver from 'neo4j-driver';
import neo4j from '.';

// ------------------------------
// 🔹 Setup Genkit + Neo4j
// ------------------------------
const ai = genkit({
  plugins: [
    googleAI(),
    neo4j([
      {
        indexId: 'graph-rag',
        embedder: googleAI.embedder('gemini-embedding-001'),
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

const driver = neo4jDriver.driver(
  'bolt://localhost:7689',
  neo4jDriver.auth.basic('neo4j', 'apoc12345')
);
const session = driver.session();

// ------------------------------
// 🔹 Tool: Graph Transformer
// ------------------------------
export const graphTransformer = ai.defineTool(
  {
    name: 'graphTransformer',
    description: 'Extracts entities and relations from text and inserts them into Neo4j.',
    inputSchema: z.object({
      docId: z.string(),
      text: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      entities: z.array(z.string()).optional(),
      relations: z.array(z.string()).optional(),
    }),
  },
  async ({ docId, text }) => {
    // 1. Estrazione entità/relazioni via LLM
    const { text: llmOutput } = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
      prompt: `
        Estrai entità e relazioni dal seguente testo.
        Rispondi in JSON:
        {
          "entities": [
            { "name": "Alice", "type": "Person" }
          ],
          "relations": [
            { "from": "Alice", "to": "Acme Corp", "type": "WORKS_AT" }
          ]
        }
        Testo: ${text}
      `,
    });

    let entities: any[] = [];
    let relations: any[] = [];
    try {
      const parsed = JSON.parse(llmOutput);
      entities = parsed.entities || [];
      relations = parsed.relations || [];
    } catch (e) {
      console.error('Errore parsing LLM output:', llmOutput);
    }

    // 2. Inserimento in Neo4j
    await session.run(
      `MERGE (d:Document {id: $docId}) SET d.text = $text`,
      { docId, text }
    );

    for (const ent of entities) {
      await session.run(
        `MERGE (e:Entity {name: $name}) SET e.type = $type`,
        { name: ent.name, type: ent.type }
      );
      await session.run(
        `MATCH (d:Document {id: $docId}), (e:Entity {name: $name})
         MERGE (d)-[:MENTIONS]->(e)`,
        { docId, name: ent.name }
      );
    }

    for (const rel of relations) {
      await session.run(
        `MATCH (e1:Entity {name: $from}), (e2:Entity {name: $to})
         MERGE (e1)-[r:${rel.type}]->(e2)`,
        { from: rel.from, to: rel.to }
      );
    }

    return { success: true, entities: entities.map(e => e.name), relations: relations.map(r => r.type) };
  }
);

// ------------------------------
// 🔹 Esempio di utilizzo in un flow
// ------------------------------
async function main() {
  const doc = new Document({
    content: [{ text: 'Alice lavora in Acme Corp a Parigi.' }],
    metadata: { source: 'input' },
  });

  // Qui l'LLM può chiamare direttamente il tool
  const res = await graphTransformer({ docId: 'doc1', text: doc.content[0].text });
  console.log('Tool result:', res);
}

main().catch(console.error);
