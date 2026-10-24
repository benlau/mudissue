import { IssueFolderLinkFormatter } from "../formatter/IssueFolderLinkFormatter.ts";
import {
  accessDirectedGraph,
  type DirectedGraph,
  type DirectedGraphLink,
  type DirectedGraphNode,
} from "../../types/DirectedGraph.ts";
import {
  accessIssueFolderRow,
  type IssueFolder,
  type IssueFolderRow,
} from "../../types/Issue.ts";

function compareForestRoot(left: IssueFolder, right: IssueFolder): number {
  const leftTime = left.metadata?.createdAt?.getTime();
  const rightTime = right.metadata?.createdAt?.getTime();
  const leftDefined = leftTime != null && !Number.isNaN(leftTime);
  const rightDefined = rightTime != null && !Number.isNaN(rightTime);
  if (leftDefined && rightDefined && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  if (leftDefined !== rightDefined) {
    return leftDefined ? -1 : 1;
  }
  const idCompared = left.issueId.localeCompare(right.issueId);
  if (idCompared !== 0) {
    return idCompared;
  }
  return (left.metadata?.title ?? "").localeCompare(
    right.metadata?.title ?? "",
    undefined,
    { sensitivity: "base" },
  );
}

export class IssueFolderRowGraphBuilder {
  private graph: DirectedGraph<IssueFolderRow> = { nodes: [] };

  build(issues: IssueFolder[]): IssueFolderRowGraphBuilder {
    const byIssueId = new Map(issues.map((issue) => [issue.issueId, issue]));
    const nodes = issues.map((issue) => ({
      id: issue.path,
      data: accessIssueFolderRow(issue, 0).get(),
      links: [] as DirectedGraphLink[],
    }));
    const linksByNodeId = new Map(
      nodes.map((node) => [node.id, node.links] as const),
    );

    const pushLink = (fromPath: string, link: DirectedGraphLink): void => {
      const links = linksByNodeId.get(fromPath);
      if (links == null) {
        return;
      }
      const duplicate = links.some(
        (existing) =>
          existing.type === link.type &&
          existing.targetNodeId === link.targetNodeId,
      );
      if (!duplicate) {
        links.push(link);
      }
    };

    for (const issue of issues) {
      const frontmatter = issue.metadata?.frontmatter;
      for (const parentId of IssueFolderLinkFormatter.linkedFolderIds(
        frontmatter?.parent,
      )) {
        const parent = byIssueId.get(parentId);
        if (parent != null && parent.issueId !== issue.issueId) {
          pushLink(issue.path, { type: "parent", targetNodeId: parent.path });
        }
      }
      for (const childId of IssueFolderLinkFormatter.linkedFolderIds(
        frontmatter?.subissues,
      )) {
        const child = byIssueId.get(childId);
        if (child != null && child.issueId !== issue.issueId) {
          pushLink(issue.path, { type: "child", targetNodeId: child.path });
        }
      }
    }

    this.graph = accessDirectedGraph({ nodes }).get();
    return this;
  }

  normalize(): IssueFolderRowGraphBuilder {
    const input = this.graph;
    const byPath = new Map(
      input.nodes.map((node) => [node.id, node.data.issueFolder] as const),
    );
    const byIssueId = new Map(
      input.nodes.map(
        (node) => [node.data.issueFolder.issueId, node.id] as const,
      ),
    );

    const canonicalParentPath = (folder: IssueFolder): string | undefined => {
      const explicitParents = IssueFolderLinkFormatter.linkedFolderIds(
        folder.metadata?.frontmatter?.parent,
      );
      if (explicitParents.length > 0) {
        for (const parentId of explicitParents) {
          const parentPath = byIssueId.get(parentId);
          if (parentPath != null && parentPath !== folder.path) {
            return parentPath;
          }
        }
        return undefined;
      }

      const inferred: string[] = [];
      for (const node of input.nodes) {
        const parentFolder = node.data.issueFolder;
        if (parentFolder.issueId === folder.issueId) {
          continue;
        }
        const subissueIds = IssueFolderLinkFormatter.linkedFolderIds(
          parentFolder.metadata?.frontmatter?.subissues,
        );
        if (subissueIds.includes(folder.issueId)) {
          inferred.push(node.id);
        }
      }
      inferred.sort((left, right) => {
        const leftFolder = byPath.get(left);
        const rightFolder = byPath.get(right);
        return (leftFolder?.issueId ?? left).localeCompare(
          rightFolder?.issueId ?? right,
        );
      });
      return inferred[0];
    };

    const parentPathByNodeId = new Map<string, string | undefined>();
    for (const node of input.nodes) {
      parentPathByNodeId.set(
        node.id,
        canonicalParentPath(node.data.issueFolder),
      );
    }

    const nodes: DirectedGraphNode<IssueFolderRow>[] = input.nodes.map(
      (node) => {
        const parentPath = parentPathByNodeId.get(node.id);
        const childPaths = input.nodes
          .filter(
            (candidate) => parentPathByNodeId.get(candidate.id) === node.id,
          )
          .map((candidate) => candidate.id)
          .sort((left, right) => {
            const leftFolder = byPath.get(left);
            const rightFolder = byPath.get(right);
            return (leftFolder?.issueId ?? left).localeCompare(
              rightFolder?.issueId ?? right,
            );
          });

        const links = [
          ...(parentPath != null
            ? [{ type: "parent" as const, targetNodeId: parentPath }]
            : []),
          ...childPaths.map((childPath) => ({
            type: "child" as const,
            targetNodeId: childPath,
          })),
        ];

        return {
          id: node.id,
          data: node.data,
          links,
        };
      },
    );

    this.graph = accessDirectedGraph({ nodes }).get();
    return this;
  }

  sortAndSetDepth(): IssueFolderRowGraphBuilder {
    this.graph = IssueFolderRowGraphBuilder.breakParentCycles(this.graph);
    this.graph = IssueFolderRowGraphBuilder.assignDepths(this.graph);
    return this;
  }

  get(): DirectedGraph<IssueFolderRow> {
    return this.graph;
  }

  toIssueFolderRows(): IssueFolderRow[] {
    const graph = accessDirectedGraph(this.graph);
    const rows: IssueFolderRow[] = [];
    const seen = new Set<string>();

    const walk = (nodeId: string) => {
      if (seen.has(nodeId)) {
        return;
      }
      seen.add(nodeId);
      const node = graph.getNode(nodeId);
      if (node == null) {
        return;
      }
      rows.push(node.data);
      for (const childId of graph.childIds(nodeId)) {
        walk(childId);
      }
    };

    for (const root of graph.roots()) {
      walk(root.id);
    }
    return rows;
  }

  private static breakParentCycles(
    input: DirectedGraph<IssueFolderRow>,
  ): DirectedGraph<IssueFolderRow> {
    let nodes = input.nodes.map((node) => ({
      ...node,
      links: node.links.map((link) => ({ ...link })),
      data: { ...node.data, issueFolder: node.data.issueFolder },
    }));

    const accessor = () => accessDirectedGraph({ nodes });

    while (true) {
      const cycle = IssueFolderRowGraphBuilder.findParentCycle(accessor());
      if (cycle.length === 0) {
        break;
      }
      const winner = [...cycle]
        .map((nodeId) => accessor().getNode(nodeId)!.data.issueFolder)
        .sort(compareForestRoot)[0]!;
      nodes = nodes.map((node) => {
        if (node.id !== winner.path) {
          return node;
        }
        return {
          ...node,
          links: node.links.filter((link) => link.type !== "parent"),
        };
      });
    }

    return accessor().get();
  }

  private static findParentCycle(
    graph: ReturnType<typeof accessDirectedGraph<IssueFolderRow>>,
  ): string[] {
    for (const startId of graph.nodeIds()) {
      const chain: string[] = [];
      const indexById = new Map<string, number>();
      let current: string | undefined = startId;
      while (current != null) {
        const existingIndex = indexById.get(current);
        if (existingIndex != null) {
          return chain.slice(existingIndex);
        }
        indexById.set(current, chain.length);
        chain.push(current);
        current = graph.parentId(current);
      }
    }
    return [];
  }

  private static assignDepths(
    input: DirectedGraph<IssueFolderRow>,
  ): DirectedGraph<IssueFolderRow> {
    const accessor = accessDirectedGraph(input);
    const depthById = new Map<string, number>();

    for (const root of accessor.roots()) {
      const stack: { id: string; depth: number }[] = [
        { id: root.id, depth: 0 },
      ];
      while (stack.length > 0) {
        const frame = stack.pop();
        if (frame == null) {
          continue;
        }
        if (depthById.has(frame.id)) {
          continue;
        }
        depthById.set(frame.id, frame.depth);
        for (const childId of accessor.childIds(frame.id)) {
          stack.push({ id: childId, depth: frame.depth + 1 });
        }
      }
    }

    const nodes: DirectedGraphNode<IssueFolderRow>[] = input.nodes.map(
      (node) => ({
        ...node,
        links: node.links.map((link) => ({ ...link })),
        data: accessIssueFolderRow(
          node.data.issueFolder,
          depthById.get(node.id) ?? 0,
        ).get(),
      }),
    );

    return accessDirectedGraph({ nodes }).get();
  }
}
