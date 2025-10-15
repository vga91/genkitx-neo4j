
// TODO ---> https://github.com/langchain4j/langchain4j-community/pull/147/files#diff-88eda01fc3b9783cb9d21927a503fe236ed6f4de13e4fc314320736cd52d0150
  // https://github.com/vga91/langchain4j-community/blob/5079cea64e42fd6cd326a45678da533d6a8c0438/embedding-stores/langchain4j-community-neo4j/src/main/java/dev/langchain4j/community/store/embedding/neo4j/Neo4jEmbeddingStore.java
// TODO --> https://genkit.dev/docs/rag/#embedders


import { googleAI } from '@genkit-ai/googleai';
import { Document, genkit } from 'genkit';
import { test, describe, expect } from '@jest/globals';
import neo4j, { Neo4jGraphConfig, neo4jIndexerRef, neo4jRetrieverRef } from '..';
import { HypotheticalQuestionRetriever, ParentChildRetriever } from '../rag-utils';

// Mock llm-chunk for testing Parent-Child ingestor
jest.mock('llm-chunk', () => ({
  chunk: jest.fn(async (text: string, config: any) => {
    // split text into 2 chunks for testing
    return [text.slice(0, text.length / 2), text.slice(text.length / 2)];
  }),
}));

/**
 * @jest-environment node
 */

describe("Neo4j RAG Retrievers", () => {
  const requiredVars = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "GEMINI_API_KEY"];
  const missingVars = requiredVars.filter((env) => !process.env[env]);
  const canRunTest = missingVars.length === 0;

  if (!canRunTest) {
    console.warn("Skipping Neo4j integration tests due to missing environment variables.");
    return;
  }

  let ai: ReturnType<typeof genkit>;
  let indexer: ReturnType<typeof neo4jIndexerRef>;
  const indexId = "genkit-test-index";
  const clientParams: Neo4jGraphConfig = {
    url: process.env.NEO4J_URI!,
    username: process.env.NEO4J_USERNAME!,
    password: process.env.NEO4J_PASSWORD!,
    database: "neo4j",
  };

  beforeAll(() => {
    ai = genkit({
      plugins: [
        googleAI(),
        // Neo4j plugin registers indexer internally
        neo4j([
          {
            indexId,
            embedder: googleAI.embedder("gemini-embedding-001"),
            clientParams,
          },
        ]),
      ],
    });

    indexer = neo4jIndexerRef({ indexId });
  });

  test("ParentChildRetriever ingests and retrieves subchunks", async () => {
    const retriever = new ParentChildRetriever(ai, clientParams, indexer);

    const uniqueId = `pc-doc-${Date.now()}`;
    const docText =
      "This is a test document for parent-child ingestion in Neo4j. It should be chunked and subchunked properly.";

    await retriever.ingestDocument({ documents: [{ text: docText, metadata: { uniqueId } }] });

    const session = retriever.getNeo4jInstance().session();
    const result = await session.run(retriever.getRetrievalQuery());
    const records = result.records;

    expect(records.length).toBeGreaterThan(0);

    const foundText = records
      .flatMap((r) => r.get("subChunks") || [])
      .map((s: any) => s.properties.text)
      .join(" ");
    expect(foundText).toContain("test document for parent-child");

    await session.close();
  });

  test("HypotheticalQuestionRetriever ingests and retrieves documents", async () => {
    const retriever = new HypotheticalQuestionRetriever(ai, clientParams, indexer);

    const uniqueId = `hq-doc-${Date.now()}`;
    const docText = "This is a test document for the hypothetical question retriever.";

    await retriever.ingestDocument({ documents: [{ text: docText, metadata: { uniqueId } }] });

    const session = retriever.getNeo4jInstance().session();
    const result = await session.run(retriever.getRetrievalQuery());
    const records = result.records;

    expect(records.length).toBeGreaterThan(0);

    const foundText = records.map((r) => r.get("d").properties.text).join(" ");
    expect(foundText).toContain("hypothetical question retriever");

    await session.close();
  });

  test("ParentChildRetriever indexing works with Genkit", async () => {
    const retriever = new ParentChildRetriever(ai, clientParams, indexer);

    const uniqueId = `pc-index-doc-${Date.now()}`;
    const docText = "This document will be indexed in Genkit via ParentChildRetriever.";

    await retriever.ingestDocument({ documents: [{ text: docText, metadata: { uniqueId } }] });

    const retrieverRef = neo4jRetrieverRef({ indexId });
    const results = await ai.retrieve({
      retriever: retrieverRef,
      query: "indexed in Genkit",
      options: { k: 10, filter: { uniqueId } },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content[0].text).toContain("indexed in Genkit");
  });
});







describe('Neo4j Plugin Integration', () => {
  const requiredVars = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD', 'GEMINI_API_KEY'];
  const missingVars = requiredVars.filter(env => !process.env[env]);
  const canRunTest = missingVars.length === 0;

  if (!canRunTest) {
    console.warn('Skipping Neo4j integration tests due to missing environment variables.');
    return;
  }

  let ai: ReturnType<typeof genkit>;
  let sessionMock: any;
  let runMock: any;


  beforeEach(() => {
        runMock = jest.fn().mockResolvedValue({ records: [] });
    sessionMock = {
      run: runMock,
      close: jest.fn(),
    };

    // jest.spyOn(neo4jDriver, 'driver').mockReturnValue({
    //   session: () => sessionMock,
    //   close: jest.fn(),
    // } as any);

    ai = genkit({
      plugins: [
        googleAI(),
        neo4j([
          {
            // retriever: 
            indexId: 'genkit-test-index',
            embedder: googleAI.embedder('gemini-embedding-001'),
            // TODO - handle this...
            // retrievalQuery: "RETURN 1",
            clientParams: {
              url: process.env.NEO4J_URI as string,
              username: process.env.NEO4J_USERNAME as string,
              password: process.env.NEO4J_PASSWORD as string,
              database: 'neo4j',
            },
          },
        ]),
      ],
    });
  });

  // test('should ingest documents using Parent-Child ingestor if plugin exists', async () => {
  //   const uniqueId = `parent-child-doc-${Date.now()}`;
  //   const docsToIngest = [
  //     { text: 'Parent document text', metadata: { uniqueId } }
  //   ];

  //   let parentChildTool;
  //   try {
  //     parentChildTool = ai.run('neo4j/genkit-test-index/parentChildIngestor');
  //   } catch (err) {
  //     console.warn('Parent-Child ingestor plugin is not available, skipping test.');
  //     return;
  //   }

  //   const res = await parentChildTool({ documents: docsToIngest });
  //   expect(res.status).toBe('ok');
  //   expect(res.count).toBeGreaterThanOrEqual(1);

  //   // Optionally, retrieve and verify content if needed
  //   const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index' });
  //   const retrievedDocs = await ai.retrieve({
  //     retriever,
  //     query: 'Parent document text',
  //     options: { k: 10, filter: { uniqueId } },
  //   });

  //   expect(retrievedDocs).toHaveLength(1);
  //   expect(retrievedDocs[0].content[0].text).toContain('Parent document text');
  // });

  // test('Neo4j retriever can be defined', async () => {
  //   const retriever = ai.retriever('neo4j/genkit-test-index');
  //   expect(retriever).toBeDefined();
  // });

  // todo - TESTS
  test('graph rag', async () => {
      // TODO - create ingestor, 
      // TODO - create indexer
      const uniqueId = `test-doc-${Date.now()}`;
      const newDocument = new Document({
        content: [
          { text: 'This is a test document for indexing and retrieval.' }
        ],
        metadata: { uniqueId },
      });

      const indexer = neo4jIndexerRef({ indexId: 'genkit-test-index' });
      await ai.index({ indexer, documents: [newDocument] });

      // - retriever
      // const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index'});
      const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index', retrievalQuery: "RETURN 1" });
      const docs = await ai.retrieve({
        retriever,
        query: 'This is a test document to be indexed.',
        options: {
          k: 10,
          filter: { uniqueId },
        },
      });

      console.log('docs')
      console.log(docs)
  });
  
  test('should document and retrieve it with custom label', async () => {
    const uniqueId = `test-doc-${Date.now()}`;
    const newDocument = new Document({
      content: [
        { text: 'This is a test document for indexing and retrieval.' }
      ],
      metadata: { uniqueId },
    });

    const indexer = neo4jIndexerRef({ indexId: 'genkit-test-index' , a: '1'});
    await ai.index({ indexer, documents: [newDocument] });

    const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index' });
    const docs = await ai.retrieve({
      retriever,
      query: 'This is a test document to be indexed.',
      options: {
        k: 10,
        filter: { uniqueId },
      },
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].content[0].text).toContain('indexing and retrieval');
  });

  // test('should successfully index a document and retrieve it', async () => {
  //   const uniqueId = `test-doc-${Date.now()}`;
  //   const newDocument = new Document({
  //     content: [
  //       { text: 'This is a test document for indexing and retrieval.' }
  //     ],
  //     metadata: { uniqueId },
  //   });

  //   const indexer = neo4jIndexerRef({ indexId: 'genkit-test-index' });
  //   await ai.index({ indexer, documents: [newDocument] });

  //   const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index' });
  //   const docs = await ai.retrieve({
  //     retriever,
  //     query: 'This is a test document to be indexed.',
  //     options: {
  //       k: 10,
  //       filter: { uniqueId },
  //     },
  //   });

  //   expect(docs).toHaveLength(1);
  //   expect(docs[0].content[0].text).toContain('indexing and retrieval');
  // });

  // test('should retrieve documents using a specific metadata filter', async () => {
  //   const commonId = `common-doc-${Date.now()}`;
  //   const docsToInsert = [
  //     new Document({
  //       content: [{ text: 'Document 1 about cats.' }],
  //       metadata: { animal: 'cat', commonId },
  //     }),
  //     new Document({
  //       content: [{ text: 'Document 2 about dogs.' }],
  //       metadata: { animal: 'dog', commonId },
  //     }),
  //     new Document({
        
  //       content: [{ text: 'Another document about cats.' }],
  //       metadata: { animal: 'cat', commonId },
  //     }),
  //   ];

  //   const indexer = neo4jIndexerRef({ indexId: 'genkit-test-index' });
  //   await ai.index({ indexer, documents: docsToInsert });

  //   const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index' });
  //   const retrievedDocs = await ai.retrieve({
  //     retriever,
  //     query: 'What animal information is available?',
  //     options: {
  //       k: 10,
  //       filter: { animal: 'cat', commonId },
  //     },
  //   });

  //   expect(retrievedDocs).toHaveLength(2);
  //   expect(retrievedDocs.every(doc => doc.metadata?.animal === 'cat')).toBe(true);
  // });

  // test('should return an empty array for a non-matching query', async () => {
  //   const retriever = neo4jRetrieverRef({ indexId: 'genkit-test-index' });
  //   const docs = await ai.retrieve({
  //     retriever,
  //     query: 'This query should not find anything.',
  //     options: {
  //       k: 10,
  //       filter: { nonExistentField: 'nonExistentValue' },
  //     },
  //   });
  //   expect(docs).toHaveLength(0);
  // });
});
