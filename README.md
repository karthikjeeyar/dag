# @graphtools/dag

![CI](https://github.com/karthikjeeyar/dag/actions/workflows/check.yml/badge.svg)
![npm](https://img.shields.io/npm/v/@graphtools/dag)

**A directed acyclic graph that tells you what can run in parallel.**

Give it tasks and their dependencies. It validates every edge as you add it,
computes the stage each task belongs to, and renders the pipeline for a build
log or a terminal.

```javascript
import { DAG } from "@graphtools/dag";

const ci = new DAG();

ci.addEdges("lint",       {}, [], []);
ci.addEdges("build",      {}, [], ["lint"]);
ci.addEdges("unit-tests", {}, [], ["lint"]);
ci.addEdges("e2e",        {}, [], ["build", "unit-tests"]);

console.log(ci.printPipeline());
```

```
| lint       | -> | build      | -> | e2e        |
                  | unit-tests |
```

`build` and `unit-tests` share a stage, so they can run at the same time.
Every vertex carries its `stage`, so you can group tasks yourself:

```javascript
const stages = new Map();
for (const vertex of ci.vertices.values()) {
  const stage = vertex.stage;
  stages.set(stage, [...(stages.get(stage) ?? []), vertex.name]);
}

// Map(3) { 1 => ["lint"], 2 => ["build", "unit-tests"], 3 => ["e2e"] }
```

- **Zero runtime dependencies**, full TypeScript types.
- **Cycles rejected on insert**, with the whole cycle in the error message.
- **Strict about input**: an empty name or a self-referencing edge throws
  instead of being silently dropped.
- **CJS and ESM builds**, Node 18+.

## Install

```cli
npm install @graphtools/dag
```

## Why

A topological sort tells you the order. It does not tell you which steps are
independent, and it cannot show you the shape of the plan. This library does
both, and it refuses to let you build a graph that cannot be scheduled.

## Methods

`addVertex(name: string, data?: T): Vertex<T> | null`

- Adds a vertex with the given name, or updates the payload of an existing one.
- Returns the vertex, or `null` when `name` is empty or blank.

`addEdge(source: string, target: string): void`

- Adds a directed edge, meaning `source` runs before `target`.
- Adding an edge that already exists is a no-op.
- Throws when a name is empty, when `source` and `target` are the same vertex,
  or when the edge would create a cycle. A rejected edge leaves the graph
  untouched.

`addEdges(name: string, data?: T, runBefore?: string | string[], runAfter?: string | string[]): void`

- Adds a vertex together with its edges.
- `runBefore` lists vertices that must run **after** `name`.
- `runAfter` lists vertices that must run **before** `name`.

`topologicalSort(fn: (vertex: Vertex<T>, path: string[]) => void): void`

- Calls `fn` for every vertex, after its dependencies.

`printGraph(): string`

- Renders the graph as arrows. Unrelated components are printed on separate
  lines so they never look connected.

`printPipeline(): string`

- Renders one column per stage, so every vertex in a column can run in
  parallel.

`names: string[]`

- The vertex names, in insertion order.

`vertices: Map<string, Vertex<T>>`

- All vertices, with `stage` recomputed if the graph changed since the last
  read. `stage` is one-based.

## Usage

#### Example 1

Adding vertices with `addVertex` and connecting them with `addEdge`:

```javascript
const dag = new DAG();

dag.addVertex("A", { color: "blue", shape: "round" });
dag.addVertex("B");
dag.addVertex("C");

dag.addEdge("A", "B");
dag.addEdge("B", "C");

dag.printGraph(); // A --> B --> C
```

#### Example 2

`addEdges` creates the vertex and its edges in one call:

```javascript
const dag = new DAG();

dag.addEdges("A", {}, [], []);
dag.addEdges("B", {}, [], ["A"]);
dag.addEdges("C", {}, [], ["B"]);
dag.addEdges("D", {}, [], ["C"]);
dag.addEdges("E", {}, ["F"], ["D"]);
dag.addEdges("F", {}, [], []);

dag.printGraph();    // A --> B --> C --> D --> E --> F
dag.printPipeline(); // | A | -> | B | -> | C | -> | D | -> | E | -> | F |
```

#### Example 3: typed payloads

`DAG` and `Vertex` are generic over the payload type:

```typescript
type Job = { retries: number };

const dag = new DAG<Job>();
dag.addVertex("deploy", { retries: 3 });

dag.vertices.get("deploy")?.data; // Job | undefined
```

## Cycles

Cycles are rejected when the edge is added, and the error names the cycle:

```javascript
dag.addEdge("F", "A");
// Error: cycle detected: A --> B --> C --> D --> E --> F --> A
```

## License

Apache-2.0
