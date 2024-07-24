# Directed Acyclic Graph (DAG) 


This package is a simple implementation of a Directed Acyclic Graph (DAG). It supports adding vertices, defining dependencies (edges), computing stages for tasks, and performing a topological sort to print the execution order of the tasks with their respective stages.


## Getting Started

To install using npm:

```cli
npm install @graphtools/dag
```

## Methods

`addVertex(name: string, data?: any): Vertex | null` 

- Adds a vertex with the given name to the DAG if it doesn't already exist. Returns the vertex object or null if the name is invalid.

`addEdge(source: string, target: string): void`

- Adds a directed edge from the source vertex to the target vertex. It also checks for cycles and throws an error if a cycle is detected.

`addEdges(name: string, data: any, runBefore: string | string[], runAfter: string | string[]): void`
- Adds a vertex and its dependencies. The vertex depends on vertices specified in before and is a prerequisite for vertices specified in after.

`topologicalSort(fn: (v: Vertex, path: string[]) => void): void`
- The topologicalSort method performs a depth-first traversal of the graph to sort vertices in a topological order.

`printGraph(): string`

- Computes the stages for all vertices and performs a topological sort to print the execution order of the tasks with their respective stages. Returns the formatted string.

## Usage

#### Example 1:

using `addVertex` method to add vertices and create edges using `addEdge` method

```javascript
    const dag = new DAG();

    dag.addVertex("A", {color: 'blue', shape: 'round'});
    dag.addVertex("B");
    dag.addVertex("C");

    dag.addEdge('A', 'B');
    dag.addEdge('B', 'C');

    dag.printGraph(); // Output: A --> B --> C

```


#### Example 2:

`dag.addEdges` method creates vertices and edges and creates a dag.

```javascript
    const dag = new DAG();

    dag.addEdges("A", {}, [], []);
    dag.addEdges("B", {}, [], ["A"]);
    dag.addEdges("C", {}, [], ['B']);
    dag.addEdges("D", {}, [], ["C"]);
    dag.addEdges("E", {}, ["F"], ["D"]);
    dag.addEdges("F", {}, [], []);

    dag.printGraph(); // Output: A --> B --> C --> D --> E --> F

```
