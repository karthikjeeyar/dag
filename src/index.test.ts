import { DAG } from "./index";

describe("DAG", () => {
  let dag: DAG;

  beforeEach(() => {
    dag = new DAG();
  });

  test("should add a vertex", () => {
    const vertex = dag.addVertex("A");
    expect(vertex).not.toBeNull();
    expect(vertex?.name).toBe("A");
    expect(dag.vertices.has("A")).toBe(true);
  });

  test("should add an edge without cycle", () => {
    dag.addVertex("A");
    dag.addVertex("B");
    dag.addEdge("A", "B");
    expect(dag.vertices.get("B")?.dependancyNames).toContain("A");
  });

  test("should detect cycle when adding an edge", () => {
    dag.addVertex("A");
    dag.addVertex("B");
    dag.addEdge("A", "B");
    expect(() => dag.addEdge("B", "A")).toThrowError("cycle detected");
  });

  test("should add multiple edges with addEdges", () => {
    dag.addEdges("A", {}, [], []);
    dag.addEdges("B", {}, "C", "A");
    dag.addEdges("C", {}, [], "B");
    expect(dag.vertices.get("B")?.dependancyNames).toContain("A");
    expect(dag.vertices.get("C")?.dependancyNames).toContain("B");
  });

  test("should perform topological sort", () => {
    dag.addVertex("A");
    dag.addVertex("B");
    dag.addVertex("C");
    dag.addEdge("A", "B");
    dag.addEdge("B", "C");

    const sorted: string[] = [];
    dag.topologicalSort((v) => {
      sorted.push(v.name);
    });

    expect(sorted).toEqual(["A", "B", "C"]);
  });

  test("should print graph in topological order", () => {
    dag.addVertex("A");
    dag.addVertex("B");
    dag.addVertex("C");
    dag.addEdge("A", "B");
    dag.addEdge("B", "C");

    const output = dag.printGraph();
    expect(output).toBe("A --> B --> C");
  });

  test("should handle complex graph with multiple dependencies", () => {
    dag.addEdges("A", {}, [], []);
    dag.addEdges("B", {}, ["C"], ["A"]);
    dag.addEdges("C", {}, [], []);
    dag.addEdges("D", {}, [], ["C"]);
    dag.addEdges("E", {}, ["F"], ["D"]);
    dag.addEdges("F", {}, [], []);

    const output = dag.printGraph();
    expect(output).toBe("A --> B --> C --> D --> E --> F");
  });
});
