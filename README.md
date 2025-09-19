# MISSING STUFF


## Retriever

Missing stuff:
- custom labels
- distanceType
- metadata prefix
- Text property key 
- Retrieval query
- Metadata filter


### embedding dimension check?

in langchain JS
```
const embeddingDimension = await store.retrieveExistingIndex();

    if (!embeddingDimension) {
      await store.createNewIndex();
    } else if (store.embeddingDimension !== embeddingDimension) {
      throw new Error(
        `Index with name ${store.indexName} already exists. The provided embedding function and vector index dimensions do not match.\nEmbedding function dimension: ${store.embeddingDimension}\nVector index dimension: ${embeddingDimension}`
      );
    }
```


### custom labels
The indexName is the label name, we cannot differentiate it
We should add it here in here
```
await neo4j_instance.executeQuery(
  `
  UNWIND $data AS row
  CREATE (t:\`${indexId}\`)
  SET t.text = row.text,
      t += row.metadata
  WITH t, row.embedding AS embedding
  CALL db.create.setNodeVectorProperty(t, 'embedding', embedding)
  `,
```
and here
```
      await neo4j_instance.executeQuery(
        `
        CREATE VECTOR INDEX $indexName IF NOT EXISTS
        FOR (n:\`${indexId}\`) ON n.embedding
        `,
        { indexName: indexId },
        { database: neo4jConfig.database },
      );
```

### Retrieval query
- `https://github.com/neo4j-partners/genkitx-neo4j/issues/4`
Change
```
const retriever_query = `
  CALL db.index.vector.queryNodes($index, $k, $embedding) YIELD node, score
  RETURN node.text AS text, node {.*, text: Null,
  embedding: Null, id: Null } AS metadata
  `;
```


### Metadata filter
- `https://github.com/neo4j-partners/genkitx-neo4j/issues/3`
- TODO: see here https://medium.com/neo4j/integrating-neo4j-with-langchain4j-for-graphrag-vector-stores-and-retrievers-de3ef3e08fa8

TODO - is there a Filter stuff in genkit?
https://gemini.google.com/app/134652c137a73c03?hl=it
not sure...
maybe put it in neo4jRetrieverRef args --> where: {...}
---> TODO : check `chromaFun` in usage-examples.ts
-----> https://github.com/firebase/genkit/blob/main/js/plugins/chroma/src/index.ts


# Graph Construction

TODO


# Knowledge Graph Construction

TODO
currently, genkit doesn't seem to provide this funzionality.
--> MAYBE WITH TOOLS? https://github.com/genkit-ai/genkit-by-example/tree/main/src/app/tool-calling

--> check here: `declare class Genkit implements HasRegistry `
  which methods are provided

--> forse così? https://genkit.dev/docs/plugin-authoring/evaluators/

# Text2Cypher

TODO

# MCP

https://genkit.dev/docs/mcp-server/

https://genkit.dev/docs/model-context-protocol/

TODO

# Parent-child and other retrievers


## LLMGraphTransformer
TODO

llm-graph-transformer.ts

## Graph Converter 
TODO

## GraphRAG concepts
TODO
https://genkit.dev/docs/rag/


## Chat memory
TODO

https://genkit.dev/docs/chat/


## Other changes

- `https://github.com/neo4j-partners/genkitx-neo4j/issues/7`

- `https://github.com/neo4j-partners/genkitx-neo4j/issues/5`


---
---
---


# genkitx-neo4j - Neo4j plugin for Genkit

This is a Genkit Plugin for Neo4j.

## Installing the plugin

```bash
npm i --save genkitx-neo4j
```

## Environment variable

Define Neo4j credentials using:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
```

## Using the plugin

```ts
import { genkit } from 'genkit';
import {
  neo4j,
  neo4jRetrieverRef,
  neo4jIndexerRef,
} from 'genkitx-neo4j';

const ai = genkit({
  plugins: [
    neo4j([
      {
        indexId: 'bob-facts',
        embedder: textEmbedding004,
      },
    ]),
  ],
});

export const bobFactsIndexer = neo4jIndexerRef({
  indexId: 'bob-facts',
});
await ai.index({ indexer: bobFactsIndexer, documents });

// To specify an index:
export const bobFactsRetriever = neo4jRetrieverRef({
  indexId: 'bob-facts',
});

// To use the index you configured when you loaded the plugin:
let docs = await ai.retrieve({ retriever: bobFactsRetriever, query });
```

Usage information and reference details can be found in [Genkit documentation](https://firebase.google.com/docs/genkit).
