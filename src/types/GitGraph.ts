export type GitGraphNode = {
  objectIds: string[];
  summary: string;
  parentCommitIds: string[];
};

export type GitGraph = {
  rootCommitId?: string;
  nodes: Record<string, GitGraphNode>;
  /** Branch name → commit id of that branch tip (HEAD). */
  branches: Record<string, string>;
};

export const DEFAULT_COMPRESS_BRANCH_NAME_LENGTH = 20;

function buildTruncatedBranchRenameMap(
  names: readonly string[],
  len: number,
): Map<string, string> {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const bases = sorted.map((name) =>
    name.length <= len ? name : name.slice(0, len),
  );
  const groups = new Map<string, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    const base = bases[i]!;
    const indices = groups.get(base) ?? [];
    indices.push(i);
    groups.set(base, indices);
  }
  const rename = new Map<string, string>();
  for (const [base, indices] of groups) {
    if (indices.length === 1) {
      rename.set(sorted[indices[0]!]!, base);
      continue;
    }
    for (let j = 0; j < indices.length; j++) {
      rename.set(sorted[indices[j]!]!, `${base}_${j}`);
    }
  }
  return rename;
}

export class GitGraphAccessor {
  private data: GitGraph;

  constructor(data: GitGraph) {
    this.data = data;
  }

  get(): GitGraph {
    return this.data;
  }

  hasCommitId(oid: string): boolean {
    return this.data.nodes[oid] !== undefined;
  }

  setBranch(branchName: string, tipCommitId: string): GitGraphAccessor {
    this.data = {
      ...this.data,
      branches: { ...this.data.branches, [branchName]: tipCommitId },
    };
    return this;
  }

  mergeGraph(other: GitGraph): GitGraphAccessor {
    const nextNodes = { ...this.data.nodes };
    for (const [id, node] of Object.entries(other.nodes)) {
      const incoming = {
        ...node,
        objectIds: [...node.objectIds],
        parentCommitIds: [...node.parentCommitIds],
      };
      const existing = nextNodes[id];
      if (!existing) {
        nextNodes[id] = incoming;
        continue;
      }
      const sameParents =
        existing.parentCommitIds.length === incoming.parentCommitIds.length &&
        existing.parentCommitIds.every(
          (p, i) => p === incoming.parentCommitIds[i],
        );
      if (!sameParents) {
        throw new Error(
          `GitGraph merge conflict for commit ${id}: parent lists differ.`,
        );
      }
      const mergedObjectIds = [...existing.objectIds];
      for (const oid of incoming.objectIds) {
        if (!mergedObjectIds.includes(oid)) {
          mergedObjectIds.push(oid);
        }
      }
      nextNodes[id] = {
        ...existing,
        objectIds: mergedObjectIds,
        parentCommitIds: [...existing.parentCommitIds],
      };
    }
    this.data = {
      ...this.data,
      nodes: nextNodes,
      branches: { ...this.data.branches, ...other.branches },
    };
    return this;
  }

  setRootCommitId(oid: string): GitGraphAccessor {
    this.data = {
      ...this.data,
      rootCommitId: oid,
    };
    return this;
  }

  /**
   * Collapses runs of "interior linear" nodes into a single node so long
   * straight-line histories render compactly. A node is interior linear when:
   *   - it is not the root commit and not a branch tip,
   *   - it has exactly one parent and one child in the graph,
   *   - that parent has only this node as its child, and
   *   - that child has only this node as its parent.
   * Only runs of three or more consecutive interior linear nodes collapse;
   * the boundary nodes on either side of the run remain unchanged. The
   * collapsed node keeps the first node's key, concatenates every collapsed
   * node's `objectIds`, and inherits the first node's `summary`.
   */
  compress(): GitGraphAccessor {
    const { nodes, branches, rootCommitId } = this.data;
    const branchTips = new Set(Object.values(branches));
    const ids = Object.keys(nodes);

    const parentsInGraph = (id: string): string[] => {
      const node = nodes[id];
      if (!node) {
        return [];
      }
      return node.parentCommitIds.filter((p) => nodes[p] !== undefined);
    };

    const childrenById = new Map<string, string[]>();
    for (const id of ids) {
      childrenById.set(id, []);
    }
    for (const id of ids) {
      for (const p of parentsInGraph(id)) {
        childrenById.get(p)!.push(id);
      }
    }

    const isInteriorLinear = (id: string): boolean => {
      if (id === rootCommitId) {
        return false;
      }
      if (branchTips.has(id)) {
        return false;
      }
      const parents = parentsInGraph(id);
      if (parents.length !== 1) {
        return false;
      }
      const kids = childrenById.get(id) ?? [];
      if (kids.length !== 1) {
        return false;
      }
      const parent = parents[0]!;
      const parentKids = childrenById.get(parent) ?? [];
      if (parentKids.length !== 1 || parentKids[0] !== id) {
        return false;
      }
      const child = kids[0]!;
      const childParents = parentsInGraph(child);
      if (childParents.length !== 1 || childParents[0] !== id) {
        return false;
      }
      return true;
    };

    const interior = new Set<string>();
    for (const id of ids) {
      if (isInteriorLinear(id)) {
        interior.add(id);
      }
    }
    if (interior.size === 0) {
      return this;
    }

    const visited = new Set<string>();
    const runs: string[][] = [];
    for (const seed of interior) {
      if (visited.has(seed)) {
        continue;
      }
      let start = seed;
      while (true) {
        const [parent] = parentsInGraph(start);
        if (parent !== undefined && interior.has(parent)) {
          start = parent;
        } else {
          break;
        }
      }
      const run: string[] = [];
      let cur: string | undefined = start;
      while (cur !== undefined && interior.has(cur)) {
        const here: string = cur;
        run.push(here);
        visited.add(here);
        const kids: string[] = childrenById.get(here) ?? [];
        cur = kids[0];
      }
      if (run.length >= 3) {
        runs.push(run);
      }
    }

    if (runs.length === 0) {
      return this;
    }

    const newNodes: Record<string, GitGraphNode> = { ...nodes };
    for (const run of runs) {
      const first = run[0]!;
      const last = run[run.length - 1]!;
      const firstNode = newNodes[first]!;
      const collapsedObjectIds: string[] = [];
      for (const id of run) {
        collapsedObjectIds.push(...newNodes[id]!.objectIds);
      }
      for (const id of run) {
        delete newNodes[id];
      }
      newNodes[first] = {
        objectIds: collapsedObjectIds,
        summary: firstNode.summary,
        parentCommitIds: [...firstNode.parentCommitIds],
      };
      for (const childId of childrenById.get(last) ?? []) {
        const childNode = newNodes[childId];
        if (!childNode) {
          continue;
        }
        newNodes[childId] = {
          ...childNode,
          parentCommitIds: childNode.parentCommitIds.map((p) =>
            p === last ? first : p,
          ),
        };
      }
    }

    this.data = {
      ...this.data,
      nodes: newNodes,
    };
    return this;
  }

  /**
   * Shortens branch keys longer than {@link len} and disambiguates collisions with `_0`, `_1`, …
   * Returns the original → truncated name map.
   */
  truncateBranchNames(
    len: number = DEFAULT_COMPRESS_BRANCH_NAME_LENGTH,
  ): Map<string, string> {
    const rename = buildTruncatedBranchRenameMap(
      Object.keys(this.data.branches),
      len,
    );
    if (rename.size === 0) {
      return rename;
    }
    const newBranches: Record<string, string> = {};
    for (const [oldName, tipOid] of Object.entries(this.data.branches)) {
      newBranches[rename.get(oldName)!] = tipOid;
    }
    this.data = {
      ...this.data,
      branches: newBranches,
    };
    return rename;
  }

  /**
   * Returns commit ids from {@link rootCommitId} to {@link headCommitId} along one path
   * (BFS; ties broken by lexicographic child id). If the target is not reachable from the
   * root, returns an empty array.
   */
  pathFinder(rootCommitId: string, headCommitId: string): string[] {
    const { nodes } = this.data;
    if (!nodes[rootCommitId] || !nodes[headCommitId]) {
      return [];
    }
    if (rootCommitId === headCommitId) {
      return [rootCommitId];
    }

    const parentsInGraph = (oid: string): string[] => {
      const n = nodes[oid];
      if (!n) {
        return [];
      }
      return n.parentCommitIds.filter((p) => nodes[p] !== undefined);
    };

    const children = new Map<string, string[]>();
    for (const id of Object.keys(nodes)) {
      children.set(id, []);
    }
    for (const id of Object.keys(nodes)) {
      for (const p of parentsInGraph(id)) {
        children.get(p)!.push(id);
      }
    }
    for (const [id, kids] of children) {
      children.set(
        id,
        [...kids].sort((a, b) => a.localeCompare(b)),
      );
    }

    const queue: string[] = [rootCommitId];
    const prev = new Map<string, string>();
    prev.set(rootCommitId, rootCommitId);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === headCommitId) {
        break;
      }
      for (const child of children.get(cur) ?? []) {
        if (!prev.has(child)) {
          prev.set(child, cur);
          queue.push(child);
        }
      }
    }

    if (!prev.has(headCommitId)) {
      return [];
    }

    const path: string[] = [];
    let x: string | undefined = headCommitId;
    while (x !== undefined) {
      path.push(x);
      if (x === rootCommitId) {
        break;
      }
      const p = prev.get(x);
      if (p === undefined || p === x) {
        return [];
      }
      x = p;
    }
    path.reverse();
    return path;
  }
}

export function accessGitGraph(graph?: GitGraph | null): GitGraphAccessor {
  return new GitGraphAccessor(
    graph ?? {
      nodes: {},
      branches: {},
      rootCommitId: undefined,
    },
  );
}

// --- Mermaid gitGraph command model (see https://mermaid.ai/open-source/syntax/gitgraph.html)

export type MermaidGitGraphCommitCommand = {
  type: "commit";
  /** Short oid for Mermaid `id: "…"`. */
  id: string;
  /** Ref / branch names surfaced on this commit (serialized as one Mermaid `tag:` joined by commas). */
  tags?: string[];
};

export type MermaidGitGraphBranchCommand = {
  type: "branch";
  id: string;
};

/** Renders as a `checkout` line; named per issue tracker vocabulary. */
export type MermaidGitGraphCheckboxCommand = {
  type: "checkout";
  id: string;
};

export type MermaidGitGraphMergeCommand = {
  type: "merge";
  id: string;
  fromBranch: string;
  tag?: string;
};

export type MermaidGitGraphCommand =
  | MermaidGitGraphCommitCommand
  | MermaidGitGraphBranchCommand
  | MermaidGitGraphCheckboxCommand
  | MermaidGitGraphMergeCommand;

export type MermaidGitGraph = {
  /** Default branch name in Mermaid frontmatter `config.gitGraph.mainBranchName`. */
  mainBranchName: string;
  commands: MermaidGitGraphCommand[];
};

export class MermaidGitGraphAccessor {
  private data: MermaidGitGraph;

  constructor(mermaidGitGraph: MermaidGitGraph) {
    this.data = mermaidGitGraph;
  }

  get(): MermaidGitGraph {
    return this.data;
  }

  /**
   * Builds Mermaid gitGraph commands using line assignment + topological walk.
   * Main-line commits are assigned via {@link GitGraphAccessor.pathFinder} from root to the
   * resolved main tip.
   *
   * When {@link mainBranchLabel} is absent from {@link GitGraph.branches}, the main tip is
   * the branch tip that maximizes {@link GitGraphAccessor.pathFinder} path length from
   * {@link GitGraph.rootCommitId}, breaking ties by lexicographically smallest tip commit id
   * (see tests: two-branch fork + merge into main).
   */
  static createFromGitGraph(
    graph: GitGraph,
    mainBranchLabel: string = "main",
  ): MermaidGitGraphAccessor {
    const { nodes, rootCommitId, branches: branchTips } = graph;

    if (
      !rootCommitId ||
      nodes[rootCommitId] === undefined ||
      Object.keys(nodes).length === 0
    ) {
      return new MermaidGitGraphAccessor({
        mainBranchName: mainBranchLabel,
        commands: [],
      });
    }

    const normalizeLine = (branchName: string): string => {
      const s = MermaidGitGraphAccessor.sanitizeGitGraphBranchName(branchName);
      const mainS =
        MermaidGitGraphAccessor.sanitizeGitGraphBranchName(mainBranchLabel);
      return s === mainS ? mainBranchLabel : s;
    };

    const parentsInGraph = (oid: string): string[] => {
      const n = nodes[oid];
      if (!n) {
        return [];
      }
      return n.parentCommitIds.filter((p) => nodes[p] !== undefined);
    };

    const childrenInGraph = new Map<string, string[]>();
    for (const id of Object.keys(nodes)) {
      childrenInGraph.set(id, []);
    }
    for (const id of Object.keys(nodes)) {
      for (const p of parentsInGraph(id)) {
        childrenInGraph.get(p)!.push(id);
      }
    }
    for (const [id, kids] of childrenInGraph) {
      childrenInGraph.set(
        id,
        [...kids].sort((a, b) => a.localeCompare(b)),
      );
    }

    const nodeIds = Object.keys(nodes);

    const graphAcc = accessGitGraph(graph);
    const sortedBranchEntries = Object.entries(branchTips).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const lines = new Map<string, string>();
    let mainTipOid: string | undefined;
    let assignedMainTip = false;

    for (const [branchName, tipOid] of sortedBranchEntries) {
      if (!nodes[tipOid]) {
        continue;
      }
      const normalizedLine = normalizeLine(branchName);
      if (!lines.has(tipOid)) {
        lines.set(tipOid, normalizedLine);
      }
      if (normalizedLine === mainBranchLabel) {
        assignedMainTip = true;
        if (mainTipOid === undefined) {
          mainTipOid = tipOid;
        }
      }
    }

    if (!assignedMainTip) {
      const uniqueTips = [...new Set(Object.values(branchTips))].filter(
        (t) => nodes[t] !== undefined,
      );
      uniqueTips.sort((a, b) => a.localeCompare(b));
      let bestTip: string | undefined;
      let bestLen = -1;
      for (const tip of uniqueTips) {
        const path = graphAcc.pathFinder(rootCommitId, tip);
        if (path.length === 0) {
          continue;
        }
        if (
          path.length > bestLen ||
          (path.length === bestLen &&
            (bestTip === undefined || tip.localeCompare(bestTip) < 0))
        ) {
          bestLen = path.length;
          bestTip = tip;
        }
      }
      if (bestTip !== undefined) {
        mainTipOid = bestTip;
        lines.set(bestTip, mainBranchLabel);
      }
    }

    if (mainTipOid !== undefined) {
      for (const id of graphAcc.pathFinder(rootCommitId, mainTipOid)) {
        lines.set(id, mainBranchLabel);
      }
    }

    const branchNamesByCommit = new Map<string, string[]>();
    for (const [branchName, tipOid] of sortedBranchEntries) {
      if (!nodes[tipOid]) {
        continue;
      }
      const list = branchNamesByCommit.get(tipOid) ?? [];
      if (!list.includes(branchName)) {
        list.push(branchName);
      }
      branchNamesByCommit.set(tipOid, list);
    }

    const tipHasChild = (oid: string): boolean =>
      (childrenInGraph.get(oid) ?? []).length > 0;

    const noEndpointBranches: string[] = [];
    for (const [branchName, tipOid] of sortedBranchEntries) {
      if (!nodes[tipOid] || !tipHasChild(tipOid)) {
        continue;
      }
      noEndpointBranches.push(branchName);
    }

    const forkHasJoiningMerge = (parentOid: string): boolean => {
      const kids = new Set(childrenInGraph.get(parentOid) ?? []);
      for (const id of nodeIds) {
        const ps = parentsInGraph(id);
        if (ps.length < 2) {
          continue;
        }
        const parentsFromFork = ps.filter((p) => kids.has(p));
        if (parentsFromFork.length >= 2) {
          return true;
        }
      }
      return false;
    };

    const tipOidSet = new Set(Object.values(branchTips));

    const spineSet = new Set(
      mainTipOid !== undefined
        ? graphAcc.pathFinder(rootCommitId, mainTipOid)
        : [],
    );

    const hasBranchKeyMatchingMain = sortedBranchEntries.some(
      ([bn]) =>
        MermaidGitGraphAccessor.sanitizeGitGraphBranchName(bn) ===
        MermaidGitGraphAccessor.sanitizeGitGraphBranchName(mainBranchLabel),
    );

    if (!forkHasJoiningMerge(rootCommitId) && !hasBranchKeyMatchingMain) {
      const rootKids = childrenInGraph.get(rootCommitId) ?? [];
      const allRootKidsAreTips = rootKids.every((k) => tipOidSet.has(k));
      const hasSpineChild = rootKids.some((k) => spineSet.has(k));
      if (allRootKidsAreTips && hasSpineChild) {
        for (const kid of rootKids) {
          if (spineSet.has(kid)) {
            continue;
          }
          if (!tipOidSet.has(kid) || tipHasChild(kid)) {
            continue;
          }
          lines.set(kid, mainBranchLabel);
        }
      }
    }

    const sharedHeadTagsByTip = new Map<string, string[]>();
    for (const [tipOid, names] of branchNamesByCommit) {
      if (names.length < 2) {
        continue;
      }
      const extras = names.filter(
        (bn) => normalizeLine(bn) !== mainBranchLabel,
      );
      if (extras.length === 0) {
        continue;
      }
      sharedHeadTagsByTip.set(
        tipOid,
        [...extras].sort((x, y) => x.localeCompare(y)),
      );
    }
    const visited = new Set<string>();
    const commands: MermaidGitGraphCommand[] = [];
    let currentBranch = mainBranchLabel;
    const createdBranches = new Set<string>([mainBranchLabel]);
    let noNameIndex = 1;

    const shortOid = (oid: string): string =>
      oid.length <= 7 ? oid : oid.slice(0, 7);

    const commitIdFor = (oid: string): string => {
      const objectIds = nodes[oid]?.objectIds ?? [oid];
      if (objectIds.length <= 1) {
        return shortOid(oid);
      }
      const head = objectIds[0]!;
      const tail = objectIds[objectIds.length - 1]!;
      return `${shortOid(head)}...${shortOid(tail)}`;
    };

    const shouldOmitCheckoutAfterBranchDeclaration = (line: string): boolean =>
      /^\d/.test(line);

    const pushCommit = (oid: string): void => {
      commands.push({ type: "commit", id: commitIdFor(oid) });
    };

    const ensureOnBranch = (target: string): void => {
      if (currentBranch === target) {
        return;
      }
      if (!createdBranches.has(target)) {
        commands.push({ type: "branch", id: target });
        createdBranches.add(target);
      }
      commands.push({ type: "checkout", id: target });
      currentBranch = target;
    };

    const analyzeUnlinedDescendants = (
      startOid: string,
    ): { foundLine: boolean; branchNames: string[] } => {
      const seen = new Set<string>();
      const stack: string[] = [startOid];
      const collectedBranchNames = new Set<string>();
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (seen.has(cur)) {
          continue;
        }
        seen.add(cur);
        if (cur !== startOid && lines.has(cur)) {
          return { foundLine: true, branchNames: [] };
        }
        const branchNames = branchNamesByCommit.get(cur) ?? [];
        for (const name of branchNames) {
          collectedBranchNames.add(name);
        }
        const kids = childrenInGraph.get(cur) ?? [];
        for (let i = kids.length - 1; i >= 0; i--) {
          stack.push(kids[i]!);
        }
      }
      return {
        foundLine: false,
        branchNames: [...collectedBranchNames].sort((a, b) =>
          a.localeCompare(b),
        ),
      };
    };

    const descendantBranchLines = (startOid: string): Set<string> => {
      const out = new Set<string>();
      const seen = new Set<string>();
      const stack = [...(childrenInGraph.get(startOid) ?? [])];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (seen.has(cur)) {
          continue;
        }
        seen.add(cur);
        const branchLine = lines.get(cur);
        if (branchLine !== undefined) {
          out.add(branchLine);
        }
        for (const k of childrenInGraph.get(cur) ?? []) {
          stack.push(k);
        }
      }
      return out;
    };

    const inferKidLine = (kidOid: string): string | undefined => {
      if (lines.has(kidOid)) {
        return lines.get(kidOid);
      }
      const analysis = analyzeUnlinedDescendants(kidOid);
      if (analysis.foundLine) {
        const fromDesc = [...descendantBranchLines(kidOid)].filter(
          (l) => l !== mainBranchLabel,
        );
        if (fromDesc.length > 0) {
          return [...fromDesc].sort((x, y) => x.localeCompare(y))[0]!;
        }
        return undefined;
      }
      if (analysis.branchNames.length > 0) {
        return analysis.branchNames.join(",");
      }
      return undefined;
    };

    const preDeclareForkedBranches = (parentOid: string): void => {
      const kids = childrenInGraph.get(parentOid) ?? [];
      if (kids.length < 2) {
        return;
      }

      const joining = forkHasJoiningMerge(parentOid);
      const forkChildOnStrictSpine = kids.some((k) => spineSet.has(k));

      const rootWideGraph =
        forkChildOnStrictSpine &&
        hasBranchKeyMatchingMain &&
        kids.some((k) => !spineSet.has(k) && !tipOidSet.has(k));

      if (
        parentOid === rootCommitId &&
        !joining &&
        (!forkChildOnStrictSpine || rootWideGraph)
      ) {
        const linesWithTips = sortedBranchEntries
          .filter(([bn]) => normalizeLine(bn) !== mainBranchLabel)
          .filter(
            ([bn, tip]) =>
              mainTipOid === undefined ||
              tip !== mainTipOid ||
              normalizeLine(bn) === mainBranchLabel,
          )
          .map(([bn, tip]) => ({ line: normalizeLine(bn), tip }));
        linesWithTips.sort((a, b) => b.line.localeCompare(a.line));
        const seenLine = new Set<string>();
        for (const { line } of linesWithTips) {
          if (seenLine.has(line)) {
            continue;
          }
          seenLine.add(line);
          if (!createdBranches.has(line)) {
            commands.push({ type: "branch", id: line });
            createdBranches.add(line);
            currentBranch = line;
          }
        }
        if (linesWithTips.length > 0) {
          if (rootWideGraph) {
            commands.push({ type: "checkout", id: mainBranchLabel });
            currentBranch = mainBranchLabel;
          } else {
            const firstLine = linesWithTips[0]!.line;
            commands.push({ type: "checkout", id: firstLine });
            currentBranch = firstLine;
          }
        }
        return;
      }

      const sortedKids = [...kids].sort((a, b) => {
        const tipA = tipOidSet.has(a);
        const tipB = tipOidSet.has(b);
        if (tipA !== tipB) {
          return tipA ? -1 : 1;
        }
        const hasLineA = lines.has(a);
        const hasLineB = lines.has(b);
        if (hasLineA !== hasLineB) {
          return hasLineA ? -1 : 1;
        }
        if (tipA && tipB) {
          const lineA = lines.get(a) ?? "";
          const lineB = lines.get(b) ?? "";
          const cmp = lineA.localeCompare(lineB);
          if (cmp !== 0) {
            return cmp;
          }
        }
        return a.localeCompare(b);
      });

      const pending: { kidOid: string; line: string }[] = [];
      const pushPending = (kidOid: string, line: string): void => {
        if (line === mainBranchLabel) {
          return;
        }
        if (createdBranches.has(line) || pending.some((p) => p.line === line)) {
          return;
        }
        pending.push({ kidOid, line });
      };

      for (const kid of sortedKids) {
        if (visited.has(kid)) {
          continue;
        }
        for (const [bn, tid] of sortedBranchEntries) {
          if (tid !== kid) {
            continue;
          }
          const branchLine = normalizeLine(bn);
          if (joining) {
            if (spineSet.has(kid)) {
              continue;
            }
          } else if (forkChildOnStrictSpine) {
            if (spineSet.has(kid)) {
              if (hasBranchKeyMatchingMain || branchLine === mainBranchLabel) {
                continue;
              }
            } else {
              if (!tipOidSet.has(kid) || !hasBranchKeyMatchingMain) {
                continue;
              }
            }
          } else if (!spineSet.has(kid)) {
            continue;
          }
          pushPending(kid, branchLine);
        }
        if (joining) {
          const effectiveLine = inferKidLine(kid);
          if (
            effectiveLine !== undefined &&
            effectiveLine !== mainBranchLabel &&
            effectiveLine !== currentBranch
          ) {
            pushPending(kid, effectiveLine);
          }
        }
      }

      if (pending.length === 0) {
        return;
      }

      pending.sort((a, b) => {
        const onA = spineSet.has(a.kidOid);
        const onB = spineSet.has(b.kidOid);
        if (onA !== onB) {
          if (joining) {
            return onA ? 1 : -1;
          }
          return onA ? -1 : 1;
        }
        return a.kidOid.localeCompare(b.kidOid);
      });

      for (const { kidOid, line } of pending) {
        lines.set(kidOid, line);
        commands.push({ type: "branch", id: line });
        createdBranches.add(line);
        currentBranch = line;
      }

      if (pending.some((p) => spineSet.has(p.kidOid))) {
        commands.push({ type: "checkout", id: mainBranchLabel });
        currentBranch = mainBranchLabel;
      }
    };

    while (visited.size < nodeIds.length) {
      const candidates: string[] = [];
      for (const id of nodeIds) {
        if (visited.has(id)) {
          continue;
        }
        const ps = parentsInGraph(id);
        if (!ps.every((p) => visited.has(p))) {
          continue;
        }
        candidates.push(id);
      }
      if (candidates.length === 0) {
        break;
      }

      candidates.sort((a, b) => {
        if (a === rootCommitId) {
          return -1;
        }
        if (b === rootCommitId) {
          return 1;
        }
        const tipA = tipOidSet.has(a);
        const tipB = tipOidSet.has(b);
        if (tipA !== tipB) {
          return tipA ? -1 : 1;
        }

        const hasLineA = lines.has(a);
        const hasLineB = lines.has(b);
        if (hasLineA !== hasLineB) {
          return hasLineA ? -1 : 1;
        }

        if (!tipA && hasLineA && hasLineB) {
          const isMainA = lines.get(a) === mainBranchLabel;
          const isMainB = lines.get(b) === mainBranchLabel;
          if (isMainA !== isMainB) {
            return isMainA ? -1 : 1;
          }
        }

        if (tipA && tipB) {
          const lineA = lines.get(a) ?? "";
          const lineB = lines.get(b) ?? "";
          const cmp = lineA.localeCompare(lineB);
          if (cmp !== 0) {
            return cmp;
          }
        }

        return a.localeCompare(b);
      });

      const oid = candidates[0]!;
      visited.add(oid);

      const psMerge = parentsInGraph(oid);
      if (psMerge.length >= 2) {
        const ontoBranch = lines.get(psMerge[0]!);
        const fromBranch = lines.get(psMerge[1]!);
        if (
          ontoBranch !== undefined &&
          fromBranch !== undefined &&
          ontoBranch !== fromBranch
        ) {
          ensureOnBranch(ontoBranch);
          let mergeTag: string | undefined;
          for (const [bn, tid] of sortedBranchEntries) {
            if (tid !== oid) {
              continue;
            }
            const nl = normalizeLine(bn);
            if (nl === mainBranchLabel || nl === ontoBranch) {
              continue;
            }
            mergeTag = MermaidGitGraphAccessor.sanitizeGitGraphBranchName(bn);
            break;
          }
          const mergeCmd: MermaidGitGraphMergeCommand = {
            type: "merge",
            id: shortOid(oid),
            fromBranch,
          };
          if (mergeTag !== undefined) {
            mergeCmd.tag = mergeTag;
          }
          commands.push(mergeCmd);
          currentBranch = ontoBranch;
          preDeclareForkedBranches(oid);
          continue;
        }
      }

      const nodeLine = lines.get(oid);
      if (nodeLine && nodeLine !== currentBranch) {
        if (!createdBranches.has(nodeLine)) {
          commands.push({ type: "branch", id: nodeLine });
          createdBranches.add(nodeLine);
          currentBranch = nodeLine;
          if (!shouldOmitCheckoutAfterBranchDeclaration(nodeLine)) {
            commands.push({ type: "checkout", id: nodeLine });
          }
          pushCommit(oid);
          preDeclareForkedBranches(oid);
          continue;
        }
        commands.push({ type: "checkout", id: nodeLine });
        currentBranch = nodeLine;
        pushCommit(oid);
        preDeclareForkedBranches(oid);
        continue;
      }

      if (!nodeLine) {
        const analysis = analyzeUnlinedDescendants(oid);
        if (analysis.foundLine) {
          const fromDescendants = [...descendantBranchLines(oid)].filter(
            (l) => l !== mainBranchLabel,
          );
          const chosen =
            fromDescendants.length > 0
              ? [...fromDescendants].sort((x, y) => x.localeCompare(y))[0]!
              : undefined;
          if (chosen !== undefined) {
            lines.set(oid, chosen);
            ensureOnBranch(chosen);
          } else {
            const noNameLine = `No Name ${noNameIndex++}`;
            lines.set(oid, noNameLine);
            ensureOnBranch(noNameLine);
          }
        } else if (analysis.branchNames.length > 0) {
          const joined = analysis.branchNames.join(",");
          lines.set(oid, joined);
          ensureOnBranch(joined);
        }
      }

      pushCommit(oid);
      preDeclareForkedBranches(oid);
    }

    const addTagsToCommitId = (
      wantId: string,
      more: readonly string[],
    ): void => {
      for (const c of commands) {
        if (c.type !== "commit" || c.id !== wantId) {
          continue;
        }
        const merged = new Set(c.tags ?? []);
        for (const t of more) {
          merged.add(t);
        }
        c.tags = [...merged].sort((x, y) => x.localeCompare(y));
        break;
      }
    };

    for (const [tipOid, tags] of sharedHeadTagsByTip) {
      addTagsToCommitId(commitIdFor(tipOid), tags);
    }

    for (const bn of noEndpointBranches) {
      if (normalizeLine(bn) === mainBranchLabel) {
        continue;
      }
      const tipOid = branchTips[bn];
      if (!tipOid || !nodes[tipOid]) {
        continue;
      }
      addTagsToCommitId(commitIdFor(tipOid), [bn]);
    }

    return new MermaidGitGraphAccessor({
      mainBranchName: mainBranchLabel,
      commands,
    });
  }

  toText(): string {
    const indent = "    ";
    const mainQuoted = MermaidGitGraphAccessor.yamlSingleQuotedScalar(
      this.data.mainBranchName,
    );
    const lines: string[] = [
      "---",
      "config:",
      "  gitGraph:",
      `    mainBranchName: '${mainQuoted}'`,
      "---",
      "gitGraph TB:",
    ];

    for (const cmd of this.data.commands) {
      switch (cmd.type) {
        case "branch":
          lines.push(
            `${indent}branch ${MermaidGitGraphAccessor.quoteGitGraphBranch(cmd.id)}`,
          );
          break;
        case "checkout":
          lines.push(
            `${indent}checkout ${MermaidGitGraphAccessor.quoteGitGraphBranch(cmd.id)}`,
          );
          break;
        case "commit": {
          // Allow up to 20 chars so a collapsed `first...last` id
          // (two 7-char short oids + "...") renders without truncation.
          const id = MermaidGitGraphAccessor.escapeMermaidNodeText(
            cmd.id,
          ).slice(0, 20);
          const tagJoined =
            cmd.tags !== undefined && cmd.tags.length > 0
              ? cmd.tags.join(",")
              : "";
          const msg =
            tagJoined.length > 0
              ? ` tag: "${MermaidGitGraphAccessor.escapeMermaidNodeText(tagJoined).slice(0, 40)}"`
              : "";
          lines.push(`${indent}commit id: "${id}"${msg}`);
          break;
        }
        case "merge": {
          const mid = MermaidGitGraphAccessor.escapeMermaidNodeText(
            cmd.id,
          ).slice(0, 12);
          const from = MermaidGitGraphAccessor.quoteGitGraphBranch(
            cmd.fromBranch,
          );
          const msg =
            cmd.tag !== undefined && cmd.tag.length > 0
              ? ` tag: "${MermaidGitGraphAccessor.escapeMermaidNodeText(cmd.tag).slice(0, 40)}"`
              : "";
          lines.push(`${indent}merge ${from} id: "${mid}"${msg}`);
          break;
        }
      }
    }

    return lines.join("\n");
  }

  /** Escape a string for use inside YAML single quotes (`'` → `''`). */
  private static yamlSingleQuotedScalar(value: string): string {
    return value.replace(/'/g, "''");
  }

  private static escapeMermaidNodeText(text: string): string {
    return text
      .replace(/\\/g, "/")
      .replace(/"/g, "'")
      .replace(/\[/g, "(")
      .replace(/\]/g, ")")
      .replace(/[{}]/g, "");
  }

  private static sanitizeGitGraphBranchName(raw: string): string {
    let s = raw.replace(/[/\\]/g, "-").replace(/[^a-zA-Z0-9_-]+/g, "-");
    s = s.replace(/^-+|-+$/g, "") || "branch";
    return s.slice(0, 48);
  }

  private static quoteGitGraphBranch(name: string): string {
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
      return name;
    }
    return `"${name.replace(/"/g, "'")}"`;
  }
}
