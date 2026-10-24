export type DirectedGraphLinkType = "parent" | "child";

export type DirectedGraphLink = {
  type: DirectedGraphLinkType;
  targetNodeId: string;
};

export type DirectedGraphNode<T> = {
  id: string;
  data: T;
  links: DirectedGraphLink[];
};

export type DirectedGraph<T> = {
  nodes: DirectedGraphNode<T>[];
};

export class DirectedGraphAccessor<T> {
  private data: DirectedGraph<T>;

  constructor(data: DirectedGraph<T>) {
    this.data = data;
  }

  get(): DirectedGraph<T> {
    return this.data;
  }

  getNode(id: string): DirectedGraphNode<T> | undefined {
    return this.data.nodes.find((node) => node.id === id);
  }

  nodeIds(): string[] {
    return this.data.nodes.map((node) => node.id);
  }

  parentId(nodeId: string): string | undefined {
    const node = this.getNode(nodeId);
    if (node == null) {
      return undefined;
    }
    return node.links.find((link) => link.type === "parent")?.targetNodeId;
  }

  childIds(nodeId: string): string[] {
    const node = this.getNode(nodeId);
    if (node == null) {
      return [];
    }
    return node.links
      .filter((link) => link.type === "child")
      .map((link) => link.targetNodeId);
  }

  roots(): DirectedGraphNode<T>[] {
    return this.data.nodes.filter((node) => this.parentId(node.id) == null);
  }

  collectDescendantIds(rootId: string): string[] {
    const collected: string[] = [];
    const stack = [...this.childIds(rootId)];
    const seen = new Set<string>([rootId]);
    while (stack.length > 0) {
      const nextId = stack.pop();
      if (nextId == null || seen.has(nextId)) {
        continue;
      }
      seen.add(nextId);
      collected.push(nextId);
      stack.push(...this.childIds(nextId));
    }
    return collected;
  }

  cloneWithNodes(nodes: DirectedGraphNode<T>[]): DirectedGraphAccessor<T> {
    return new DirectedGraphAccessor({ nodes });
  }
}

export function accessDirectedGraph<T>(
  data: DirectedGraph<T>,
): DirectedGraphAccessor<T> {
  return new DirectedGraphAccessor(data);
}
