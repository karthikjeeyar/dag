import { DAG } from "./index";

describe("DAG", () => {
  let dag: DAG;

  beforeEach(() => {
    dag = new DAG();
  });

  describe("vertices", () => {
    test("adds a vertex", () => {
      const vertex = dag.addVertex("A");
      expect(vertex).not.toBeNull();
      expect(vertex?.name).toBe("A");
      expect(dag.vertices.has("A")).toBe(true);
    });

    test("stores the payload", () => {
      dag.addVertex("A", { color: "blue" });
      expect(dag.vertices.get("A")?.data).toEqual({ color: "blue" });
    });

    test("returns null for an empty or blank name", () => {
      expect(dag.addVertex("")).toBeNull();
      expect(dag.addVertex("   ")).toBeNull();
      expect(dag.names).toHaveLength(0);
    });

    test("updates the payload of an existing vertex", () => {
      dag.addVertex("A", { color: "blue" });
      dag.addVertex("A", { color: "red" });
      expect(dag.names).toHaveLength(1);
      expect(dag.vertices.get("A")?.data).toEqual({ color: "red" });
    });

    test("keeps falsy payloads", () => {
      dag.addVertex("A", 1);
      dag.addVertex("A", 0);
      expect(dag.vertices.get("A")?.data).toBe(0);
    });

    test("returns a copy of the names", () => {
      dag.addVertex("A");
      const names = dag.names;
      names.push("B");
      expect(dag.names).toEqual(["A"]);
    });
  });

  describe("edges", () => {
    test("connects two vertices", () => {
      dag.addVertex("A");
      dag.addVertex("B");
      dag.addEdge("A", "B");
      expect(dag.vertices.get("B")?.dependancyNames).toEqual(["A"]);
    });

    test("treats a duplicate edge as a no-op", () => {
      dag.addEdge("A", "B");
      dag.addEdge("A", "B");
      expect(dag.vertices.get("B")?.dependancyNames).toEqual(["A"]);
    });

    test("throws for an empty vertex name", () => {
      expect(() => dag.addEdge("", "B")).toThrow("invalid vertex name");
      expect(dag.names).toHaveLength(0);
    });

    test("addEdges throws for an empty vertex name", () => {
      expect(() => dag.addEdges("", {}, [], [])).toThrow("invalid vertex name");
      expect(dag.names).toHaveLength(0);
    });
  });

  describe("cycle detection", () => {
    test("rejects a self referencing edge", () => {
      expect(() => dag.addEdge("A", "A")).toThrow("cycle detected: A --> A");
      expect(dag.names).toHaveLength(0);
    });

    test("reports the full two vertex cycle", () => {
      dag.addEdge("A", "B");
      expect(() => dag.addEdge("B", "A")).toThrowError(
        "cycle detected: A --> B --> A"
      );
    });

    test("reports the full three vertex cycle", () => {
      dag.addEdge("A", "B");
      dag.addEdge("B", "C");
      expect(() => dag.addEdge("C", "A")).toThrowError(
        "cycle detected: A --> B --> C --> A"
      );
    });

    test("leaves the graph unchanged when an edge is rejected", () => {
      dag.addEdge("A", "B");
      expect(() => dag.addEdge("B", "A")).toThrow();
      expect(dag.vertices.get("A")?.dependancyNames).toEqual([]);
      expect(dag.vertices.get("B")?.dependancyNames).toEqual(["A"]);
    });
  });

  describe("topologicalSort", () => {
    test("visits dependencies before dependants", () => {
      dag.addEdge("A", "B");
      dag.addEdge("B", "C");

      const sorted: string[] = [];
      dag.topologicalSort((vertex) => sorted.push(vertex.name));

      expect(sorted).toEqual(["A", "B", "C"]);
    });
  });

  describe("printGraph", () => {
    test("prints a single chain", () => {
      dag.addEdge("A", "B");
      dag.addEdge("B", "C");
      expect(dag.printGraph()).toBe("A --> B --> C");
    });

    test("keeps unrelated components on separate lines", () => {
      dag.addEdge("A", "B");
      dag.addEdge("C", "D");
      expect(dag.printGraph()).toBe("A --> B\nC --> D");
    });

    test("returns an empty string for an empty graph", () => {
      expect(dag.printGraph()).toBe("");
    });
  });

  describe("printPipeline", () => {
    test("renders a chain of single character names", () => {
      dag.addEdge("A", "B");
      dag.addEdge("B", "C");
      expect(dag.printPipeline()).toBe("| A | -> | B | -> | C |");
    });

    test("pads multi character names instead of repeating them", () => {
      dag.addEdge("build", "test");
      dag.addEdge("test", "deploy");

      const output = dag.printPipeline();
      expect(output).toBe("| build  | -> | test   | -> | deploy |");
      expect(output).not.toContain("buildbuild");
    });

    test("renders parallel vertices as stacked cells in one column", () => {
      dag.addEdge("A", "B");
      dag.addEdge("A", "C");
      dag.addEdge("B", "D");
      dag.addEdge("C", "D");

      expect(dag.printPipeline()).toBe(
        "| A | -> | B | -> | D |\n         | C |"
      );
    });

    test("does not emit trailing whitespace", () => {
      dag.addEdge("A", "B");
      dag.addEdge("A", "C");
      dag.addEdge("B", "D");
      dag.addEdge("C", "D");

      const lines = dag.printPipeline().split("\n");
      expect(lines.every((line) => line === line.trimEnd())).toBe(true);
    });

    test("returns an empty string for an empty graph", () => {
      expect(dag.printPipeline()).toBe("");
    });
  });

  describe("stages", () => {
    test("numbers a chain from one", () => {
      dag.addEdge("A", "B");
      dag.addEdge("B", "C");

      expect(dag.vertices.get("A")?.stage).toBe(1);
      expect(dag.vertices.get("B")?.stage).toBe(2);
      expect(dag.vertices.get("C")?.stage).toBe(3);
    });

    test("gives parallel vertices the same stage", () => {
      dag.addEdge("A", "B");
      dag.addEdge("A", "C");
      dag.addEdge("B", "D");
      dag.addEdge("C", "D");

      expect(dag.vertices.get("B")?.stage).toBe(2);
      expect(dag.vertices.get("C")?.stage).toBe(2);
      expect(dag.vertices.get("D")?.stage).toBe(3);
    });

    test("recomputes stages after the graph is mutated", () => {
      dag.addVertex("A");
      dag.addVertex("B");

      // Reading `vertices` computes and caches the stages: both are roots.
      expect(dag.vertices.get("B")?.stage).toBe(1);

      dag.addEdge("A", "B");
      expect(dag.vertices.get("B")?.stage).toBe(2);
      expect(dag.printPipeline()).toBe("| A | -> | B |");
    });

    test("keeps stages fresh after adding a dependency of a dependency", () => {
      dag.addEdge("A", "B");
      expect(dag.vertices.get("B")?.stage).toBe(2);

      dag.addVertex("Z");
      dag.addEdge("Z", "A");
      expect(dag.vertices.get("A")?.stage).toBe(2);
      expect(dag.vertices.get("B")?.stage).toBe(3);
    });
  });
});
