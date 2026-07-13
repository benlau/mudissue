import {
  accessGitGraph,
  MermaidGitGraphAccessor,
  type GitGraph,
  type GitGraphNode,
  type MermaidGitGraphCommitCommand,
} from "../../src/types/GitGraph.ts";

function node(id: string, summary: string, parents: string[]): GitGraphNode {
  return {
    objectIds: [id],
    summary,
    parentCommitIds: parents,
  };
}

describe("GitGraphAccessor.mergeGraph", () => {
  it("when the incoming graph adds a branch name the base graph did not have, keeps every branch name mapped to that shared tip", () => {
    const sharedTipCommitId = "sharedTipCommit00000000000000000000000000";
    const acc = accessGitGraph({
      nodes: { [sharedTipCommitId]: node(sharedTipCommitId, "single commit", []) },
      branches: { main: sharedTipCommitId },
    });
    acc.mergeGraph({
      nodes: { [sharedTipCommitId]: node(sharedTipCommitId, "single commit", []) },
      branches: { feature: sharedTipCommitId },
    });
    expect(acc.get().branches).toEqual({
      main: sharedTipCommitId,
      feature: sharedTipCommitId,
    });
  });

  it("when both graphs name the same branch and point it at the identical tip, keeps a single branch entry", () => {
    const sharedTipCommitId = "sharedTipCommit00000000000000000000000000";
    const acc = accessGitGraph({
      nodes: { [sharedTipCommitId]: node(sharedTipCommitId, "single commit", []) },
      branches: { release: sharedTipCommitId },
    });
    acc.mergeGraph({
      nodes: { [sharedTipCommitId]: node(sharedTipCommitId, "single commit", []) },
      branches: { release: sharedTipCommitId },
    });
    expect(acc.get().branches).toEqual({ release: sharedTipCommitId });
  });

  it("when both graphs name the same branch but disagree on the tip, keeps the incoming branch tip", () => {
    const staleTipCommitId = "staleTipCommit00000000000000000000000000";
    const newTipCommitId = "newTipCommit0000000000000000000000000000";
    const acc = accessGitGraph({
      nodes: { [newTipCommitId]: node(newTipCommitId, "new tip", []) },
      branches: { trunk: staleTipCommitId },
    });
    acc.mergeGraph({
      nodes: { [newTipCommitId]: node(newTipCommitId, "new tip", []) },
      branches: { trunk: newTipCommitId },
    });
    expect(acc.get().branches).toEqual({ trunk: newTipCommitId });
  });

  it("when both graphs have empty branch maps, leaves branch tips empty", () => {
    const loneCommitId = "loneCommit000000000000000000000000000000";
    const acc = accessGitGraph({
      nodes: { [loneCommitId]: node(loneCommitId, "orphan", []) },
      branches: {},
    });
    acc.mergeGraph({
      nodes: { [loneCommitId]: node(loneCommitId, "orphan", []) },
      branches: {},
    });
    expect(acc.get().branches).toEqual({});
  });
});

describe("GitGraphAccessor.pathFinder", () => {
  it("when root equals target, returns a single-id path", () => {
    const r = "root000000000000000000000000000000000000";
    const acc = accessGitGraph({
      nodes: { [r]: node(r, "root", []) },
      branches: {},
      rootCommitId: r,
    });
    expect(acc.pathFinder(r, r)).toEqual([r]);
  });

  it("when target is reachable from root, returns commits from root to target in order", () => {
    const root = "root000000000000000000000000000000000000";
    const mid = "mid0000000000000000000000000000000000000";
    const tip = "tip0000000000000000000000000000000000000";
    const acc = accessGitGraph({
      nodes: {
        [root]: node(root, "root", []),
        [mid]: node(mid, "mid", [root]),
        [tip]: node(tip, "tip", [mid]),
      },
      branches: {},
      rootCommitId: root,
    });
    expect(acc.pathFinder(root, tip)).toEqual([root, mid, tip]);
  });

  it("when target is not reachable from root, returns an empty array", () => {
    const root = "root000000000000000000000000000000000000";
    const orphan = "orphan0000000000000000000000000000000000";
    const acc = accessGitGraph({
      nodes: {
        [root]: node(root, "root", []),
        [orphan]: node(orphan, "orphan", []),
      },
      branches: {},
      rootCommitId: root,
    });
    expect(acc.pathFinder(root, orphan)).toEqual([]);
  });

  it("when root or target is missing from nodes, returns an empty array", () => {
    const acc = accessGitGraph({
      nodes: {},
      branches: {},
    });
    expect(acc.pathFinder("missing1", "missing2")).toEqual([]);
  });
});

describe("GitGraphAccessor.compress", () => {
  it("when five commits form a single straight line, collapses the three interior commits into one node whose objectIds list them in order", () => {
    const a = "aaaa000000000000000000000000000000000000";
    const b = "bbbb000000000000000000000000000000000000";
    const c = "cccc000000000000000000000000000000000000";
    const d = "dddd000000000000000000000000000000000000";
    const e = "eeee000000000000000000000000000000000000";
    const acc = accessGitGraph({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
      },
      branches: { main: e },
    });

    acc.compress();

    expect(acc.get()).toEqual({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b, c, d], summary: "b", parentCommitIds: [a] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [b] },
      },
      branches: { main: e },
    });
  });

  it("when an interior commit branches off to a side commit, leaves every node untouched because no three consecutive interior commits remain", () => {
    const a = "aaaa111111111111111111111111111111111111";
    const b = "bbbb111111111111111111111111111111111111";
    const c = "cccc111111111111111111111111111111111111";
    const d = "dddd111111111111111111111111111111111111";
    const e = "eeee111111111111111111111111111111111111";
    const f = "ffff111111111111111111111111111111111111";
    const acc = accessGitGraph({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
        [f]: { objectIds: [f], summary: "f", parentCommitIds: [b] },
      },
      branches: { main: e, feature: f },
    });

    acc.compress();

    expect(acc.get()).toEqual({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
        [f]: { objectIds: [f], summary: "f", parentCommitIds: [b] },
      },
      branches: { main: e, feature: f },
    });
  });

  it("when only two interior commits sit between root and tip, leaves the chain untouched because the run is shorter than three", () => {
    const a = "aaaa222222222222222222222222222222222222";
    const b = "bbbb222222222222222222222222222222222222";
    const c = "cccc222222222222222222222222222222222222";
    const d = "dddd222222222222222222222222222222222222";
    const acc = accessGitGraph({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
      },
      branches: { main: d },
    });

    acc.compress();

    expect(acc.get()).toEqual({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
      },
      branches: { main: d },
    });
  });

  it("when an interior commit is also a branch tip, treats it as a boundary so it never disappears into a collapsed run", () => {
    const a = "aaaa333333333333333333333333333333333333";
    const b = "bbbb333333333333333333333333333333333333";
    const c = "cccc333333333333333333333333333333333333";
    const d = "dddd333333333333333333333333333333333333";
    const e = "eeee333333333333333333333333333333333333";
    const acc = accessGitGraph({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
      },
      branches: { main: e, mark: c },
    });

    acc.compress();

    expect(acc.get()).toEqual({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
      },
      branches: { main: e, mark: c },
    });
  });

  it("when called twice on a graph that has already been compressed, leaves the graph unchanged on the second call", () => {
    const a = "aaaa444444444444444444444444444444444444";
    const b = "bbbb444444444444444444444444444444444444";
    const c = "cccc444444444444444444444444444444444444";
    const d = "dddd444444444444444444444444444444444444";
    const e = "eeee444444444444444444444444444444444444";
    const acc = accessGitGraph({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
        [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
        [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [d] },
      },
      branches: { main: e },
    });

    acc.compress();
    acc.compress();

    expect(acc.get()).toEqual({
      rootCommitId: a,
      nodes: {
        [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
        [b]: { objectIds: [b, c, d], summary: "b", parentCommitIds: [a] },
        [e]: { objectIds: [e], summary: "e", parentCommitIds: [b] },
      },
      branches: { main: e },
    });
  });
});

describe("GitGraphAccessor.truncateBranchNames", () => {
  const tipCommitId = "tip000000000000000000000000000000000000";

  it("when all branch names are at most len, leaves keys unchanged and maps each name to itself", () => {
    const acc = accessGitGraph({
      nodes: {},
      branches: { main: tipCommitId, feat: tipCommitId },
    });

    const renames = acc.truncateBranchNames(20);

    expect(renames.get("main")).toBe("main");
    expect(renames.get("feat")).toBe("feat");
    expect(acc.get().branches).toEqual({ main: tipCommitId, feat: tipCommitId });
  });

  it("when a branch name exceeds len, truncates the key and preserves the tip commit id", () => {
    const longBranchName = "pr/MI0100-mudissue-dev-extra";
    const acc = accessGitGraph({
      nodes: {},
      branches: { [longBranchName]: tipCommitId },
    });

    const renames = acc.truncateBranchNames(20);
    const truncatedName = longBranchName.slice(0, 20);

    expect(renames.get(longBranchName)).toBe(truncatedName);
    expect(acc.get().branches).toEqual({ [truncatedName]: tipCommitId });
  });

  it("when two long branch names share the same truncated prefix, assigns _0 and _1 suffixes in lexicographic order", () => {
    const firstLongBranch = "01234567890123456789-aaa";
    const secondLongBranch = "01234567890123456789-bbb";
    const acc = accessGitGraph({
      nodes: {},
      branches: {
        [secondLongBranch]: tipCommitId,
        [firstLongBranch]: tipCommitId,
      },
    });

    const renames = acc.truncateBranchNames(20);

    expect(renames.get(firstLongBranch)).toBe("01234567890123456789_0");
    expect(renames.get(secondLongBranch)).toBe("01234567890123456789_1");
    expect(acc.get().branches).toEqual({
      "01234567890123456789_0": tipCommitId,
      "01234567890123456789_1": tipCommitId,
    });
  });

  it("when a short branch name equals another name's truncation, assigns suffixes to both", () => {
    const shortBranch = "01234567890123456789";
    const longBranch = "01234567890123456789-extra-suffix";
    const acc = accessGitGraph({
      nodes: {},
      branches: {
        [longBranch]: tipCommitId,
        [shortBranch]: tipCommitId,
      },
    });

    const renames = acc.truncateBranchNames(20);

    expect(renames.get(shortBranch)).toBe("01234567890123456789_0");
    expect(renames.get(longBranch)).toBe("01234567890123456789_1");
  });

  it("when branches is empty, returns an empty map and leaves branches unchanged", () => {
    const acc = accessGitGraph({ nodes: {}, branches: {} });

    const renames = acc.truncateBranchNames(20);

    expect(renames.size).toBe(0);
    expect(acc.get().branches).toEqual({});
  });
});

describe("MermaidGitGraphAccessor.createFromGitGraph", () => {
  it("when rootCommitId is missing, emits no commands even if orphan commits exist in nodes", () => {
    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      {
        rootCommitId: undefined,
        nodes: {
          solo0000000000000000000000000000000000: {
            objectIds: ["solo0000000000000000000000000000000000"],
            summary: "orphan summary",
            parentCommitIds: [],
          },
        },
        branches: {},
      },
      "main",
    );
    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("when the graph has no commits, emits no commands and names the main branch from the second argument", () => {
    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      {
        rootCommitId: "does-not-matter",
        nodes: {},
        branches: {},
      },
      "develop",
    );
    expect(mermaid.get()).toEqual({
      mainBranchName: "develop",
      commands: [],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("for a linear history of root then child on main, emits commits oldest-first and sets mainBranchName from the second argument", () => {
    const rootCommitId = "root111111111111111111111111111111111111";
    const tipCommitId = "tip1111111111111111111111111111111111111";
    const graph: GitGraph = {
      rootCommitId,
      nodes: {
        [rootCommitId]: {
          objectIds: [rootCommitId],
          summary: "root msg",
          parentCommitIds: [],
        },
        [tipCommitId]: {
          objectIds: [tipCommitId],
          summary: "tip msg",
          parentCommitIds: [rootCommitId],
        },
      },
      branches: { main: tipCommitId },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "master");
    expect(mermaid.get()).toEqual({
      mainBranchName: "master",
      commands: [
        { type: "commit", id: "root111" },
        { type: "commit", id: "tip1111" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("when serializing to Mermaid text, prepends YAML frontmatter with mainBranchName and emits one commit line per commit in traversal order", () => {
    const rootCommitId = "root111111111111111111111111111111111111";
    const tipCommitId = "tip1111111111111111111111111111111111111";
    const graph: GitGraph = {
      rootCommitId,
      nodes: {
        [rootCommitId]: {
          objectIds: [rootCommitId],
          summary: "root msg",
          parentCommitIds: [],
        },
        [tipCommitId]: {
          objectIds: [tipCommitId],
          summary: "tip msg",
          parentCommitIds: [rootCommitId],
        },
      },
      branches: { main: tipCommitId },
    };

    expect(MermaidGitGraphAccessor.createFromGitGraph(graph, "master").toText()).toBe(
      [
        "---",
        "config:",
        "  gitGraph:",
        "    mainBranchName: 'master'",
        "---",
        "gitGraph TB:",
        '    commit id: "root111"',
        '    commit id: "tip1111"',
      ].join("\n"),
    );
    expect(MermaidGitGraphAccessor.createFromGitGraph(graph, "master").toText()).toMatchSnapshot();
  });

  it("when two branch tips share one root and there is no merge, emits main-line commits before the feature tip (topological tie-break)", () => {
    const rootCommitId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const mainLineTipCommitId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const featureTipCommitId = "cccccccccccccccccccccccccccccccccccccccc";
    const graph: GitGraph = {
      rootCommitId,
      nodes: {
        [rootCommitId]: {
          objectIds: [rootCommitId],
          summary: "root",
          parentCommitIds: [],
        },
        [mainLineTipCommitId]: {
          objectIds: [mainLineTipCommitId],
          summary: "on main",
          parentCommitIds: [rootCommitId],
        },
        [featureTipCommitId]: {
          objectIds: [featureTipCommitId],
          summary: "feature work",
          parentCommitIds: [rootCommitId],
        },
      },
      branches: { mainline: mainLineTipCommitId, feature: featureTipCommitId },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "aaaaaaa" },
        { type: "branch", id: "mainline" },
        { type: "checkout", id: "main" },
        { type: "commit", id: "ccccccc" },
        { type: "checkout", id: "mainline" },
        { type: "commit", id: "bbbbbbb" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("for a merge commit whose first parent is main and second is feature, emits one merge command merging from the feature branch name", () => {
    const rootCommitId = "11111111111111111111111111111111111111";
    const mainTipCommitId = "22222222222222222222222222222222222222";
    const featureTipCommitId = "33333333333333333333333333333333333333";
    const mergeCommitId = "44444444444444444444444444444444444444";
    const graph: GitGraph = {
      rootCommitId,
      nodes: {
        [rootCommitId]: {
          objectIds: [rootCommitId],
          summary: "root",
          parentCommitIds: [],
        },
        [mainTipCommitId]: {
          objectIds: [mainTipCommitId],
          summary: "main tip",
          parentCommitIds: [rootCommitId],
        },
        [featureTipCommitId]: {
          objectIds: [featureTipCommitId],
          summary: "feature tip",
          parentCommitIds: [rootCommitId],
        },
        [mergeCommitId]: {
          objectIds: [mergeCommitId],
          summary: "merge side into main",
          parentCommitIds: [mainTipCommitId, featureTipCommitId],
        },
      },
      branches: {
        mainline: mainTipCommitId,
        side: featureTipCommitId,
        trunk: mergeCommitId,
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    expect(mermaid.get().commands).toEqual([
      { type: "commit", id: "1111111" },
      { type: "branch", id: "side" },
      { type: "checkout", id: "main" },
      { type: "commit", id: "2222222", tags: ["mainline"] },
      { type: "checkout", id: "side" },
      { type: "commit", id: "3333333", tags: ["side"] },
      { type: "checkout", id: "main" },
      {
        type: "merge",
        id: mergeCommitId.slice(0, 7),
        fromBranch: "side",
        tag: "trunk",
      },
    ]);
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("multi-branch tree", () => {
    const rootCommitId = "75dcc5e2fb7890eb13690227f59b3ff08cce4e1d";
    const midCommitId = "78a16cefdb37fe23d061f9e53348b7db55493b46";
    const mainTipCommitId = "5897053bcacecf4027f0ceb6ebfcd11556adcfb7";
    const rebaseTipCommitId = "1d29c3fd3880bf55a428a8c25393656016fe7015";
    const normalTipCommitId = "a11731996ef98883f481b2cb4614bb0c6945cbc2";
    const graph: GitGraph = {
      rootCommitId,
      nodes: {
        [mainTipCommitId]: {
          objectIds: [mainTipCommitId],
          summary: "itest",
          parentCommitIds: [midCommitId],
        },
        [midCommitId]: {
          objectIds: [midCommitId],
          summary: "123",
          parentCommitIds: [rootCommitId],
        },
        [rootCommitId]: {
          objectIds: [rootCommitId],
          summary: "x",
          parentCommitIds: ["0b4aee3ebe65433fc1666275dd81f6b412639f01"],
        },
        [normalTipCommitId]: {
          objectIds: [normalTipCommitId],
          summary: "i51",
          parentCommitIds: [rootCommitId],
        },
        [rebaseTipCommitId]: {
          objectIds: [rebaseTipCommitId],
          summary: "0056",
          parentCommitIds: [midCommitId],
        },
      },
      branches: {
        main: mainTipCommitId,
        "0051-normal": normalTipCommitId,
        "0056-rebase": rebaseTipCommitId,
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "75dcc5e" },
        { type: "branch", id: "0051-normal" },
        { type: "commit", id: "a117319" },
        { type: "checkout", id: "main" },
        { type: "commit", id: "78a16ce" },
        { type: "branch", id: "0056-rebase" },
        { type: "commit", id: "1d29c3f" },

        { type: "checkout", id: "main" },
        { type: "commit", id: "5897053" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("when a branch tip is not a graph leaf, tags that commit with the branch name (main a→b→c, feature at b)", () => {
    const oidA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const oidB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const oidC = "cccccccccccccccccccccccccccccccccccccccc";
    const graph: GitGraph = {
      rootCommitId: oidA,
      nodes: {
        [oidA]: { objectIds: [oidA], summary: "a", parentCommitIds: [] },
        [oidB]: { objectIds: [oidB], summary: "b", parentCommitIds: [oidA] },
        [oidC]: { objectIds: [oidC], summary: "c", parentCommitIds: [oidB] },
      },
      branches: {
        main: oidC,
        feature: oidB,
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    const commits = mermaid
      .get()
      .commands.filter(
        (c): c is MermaidGitGraphCommitCommand => c.type === "commit",
      );

    expect(commits).toEqual([
      { type: "commit", id: "aaaaaaa" },
      { type: "commit", id: "bbbbbbb", tags: ["feature"] },
      { type: "commit", id: "ccccccc" },
    ]);

    expect(mermaid.toText()).toContain('commit id: "bbbbbbb" tag: "feature"');
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("diamond history", () => {
    const oidA = "aaa222222222222222222222222222222222222";
    const oidB = "bbb222222222222222222222222222222222222";
    const oidD = "ddd222222222222222222222222222222222222";
    const oidC = "ccc222222222222222222222222222222222222";
    const graph: GitGraph = {
      rootCommitId: oidA,
      nodes: {
        [oidA]: { objectIds: [oidA], summary: "a", parentCommitIds: [] },
        [oidB]: { objectIds: [oidB], summary: "b", parentCommitIds: [oidA] },
        [oidD]: { objectIds: [oidD], summary: "d", parentCommitIds: [oidA] },
        [oidC]: {
          objectIds: [oidC],
          summary: "c",
          parentCommitIds: [oidB, oidD],
        },
      },
      branches: {
        main: oidC,
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "aaa2222" },
        { type: "commit", id: "bbb2222" },
        { type: "branch", id: "No Name 1" },
        { type: "checkout", id: "No Name 1" },
        { type: "commit", id: "ddd2222" },
        { type: "checkout", id: "main" },
        { type: "merge", id: "ccc2222", fromBranch: "No Name 1" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("single-line-multi-branch-same-head", () => {
    const oidA = "aaa111111111111111111111111111111111111";
    const oidB = "bbb111111111111111111111111111111111111";
    const oidC = "ccc111111111111111111111111111111111111";
    const graph: GitGraph = {
      rootCommitId: oidA,
      nodes: {
        [oidA]: { objectIds: [oidA], summary: "a", parentCommitIds: [] },
        [oidB]: { objectIds: [oidB], summary: "b", parentCommitIds: [oidA] },
        [oidC]: { objectIds: [oidC], summary: "c", parentCommitIds: [oidB] },
      },
      branches: {
        main: oidC,
        feature: oidC,
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(graph, "main");
    expect(mermaid.get().commands).toEqual([
      { type: "commit", id: "aaa1111" },
      { type: "commit", id: "bbb1111" },
      { type: "commit", id: "ccc1111", tags: ["feature"] },
    ]);
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("when a node holds multiple objectIds (e.g. after compress()), renders its commit id as the short oids of the first and last objects joined by '...'", () => {
    const a = "aaaa555555555555555555555555555555555555";
    const b = "bbbb555555555555555555555555555555555555";
    const c = "cccc555555555555555555555555555555555555";
    const d = "dddd555555555555555555555555555555555555";
    const e = "eeee555555555555555555555555555555555555";

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      {
        rootCommitId: a,
        nodes: {
          [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
          [b]: { objectIds: [b, c, d], summary: "b", parentCommitIds: [a] },
          [e]: { objectIds: [e], summary: "e", parentCommitIds: [b] },
        },
        branches: { main: e },
      },
      "main",
    );

    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "aaaa555" },
        { type: "commit", id: "bbbb555...dddd555" },
        { type: "commit", id: "eeee555" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("main-as-root", () => {
    const a = "a";
    const b = "b";
    const c = "c";
    const d = "d";

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      {
        rootCommitId: a,
        nodes: {
          [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
          [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
          [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
          [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        },
        branches: { main: a, feature: d },
      },
      "main",
    );

    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "a" },
        { type: "branch", id: "feature" },
        { type: "checkout", id: "feature" },
        { type: "commit", id: "b" },
        { type: "commit", id: "c" },
        { type: "commit", id: "d" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("main-feature-root", () => {
    const a = "a";
    const b = "b";
    const c = "c";
    const d = "d";

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      {
        rootCommitId: a,
        nodes: {
          [a]: { objectIds: [a], summary: "a", parentCommitIds: [] },
          [b]: { objectIds: [b], summary: "b", parentCommitIds: [a] },
          [c]: { objectIds: [c], summary: "c", parentCommitIds: [b] },
          [d]: { objectIds: [d], summary: "d", parentCommitIds: [c] },
        },
        branches: { main: a, feature1: d , feature2: a},
      },
      "main",
    );

    expect(mermaid.get()).toEqual({
      mainBranchName: "main",
      commands: [
        { type: "commit", id: "a", tags: ["feature2"] },
        { type: "branch", id: "feature1" },
        { type: "checkout", id: "feature1" },
        { type: "commit", id: "b" },
        { type: "commit", id: "c" },
        { type: "commit", id: "d" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("example01", () => {
    const graph: GitGraph = {
      rootCommitId: "4af73429f4a28d29c3f05d72c97b24d26cde5fcf",
      nodes: {
        "4af73429f4a28d29c3f05d72c97b24d26cde5fcf": {
          objectIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
          summary: "",
          parentCommitIds: ["63b81ceea2433ae58d566d1cbc980a7e486f04d7"],
        },
        "fed94eb726ab39705a7cfa997ac0b044951b1ce1": {
          objectIds: ["fed94eb726ab39705a7cfa997ac0b044951b1ce1"],
          summary: "",
          parentCommitIds: ["318fb591b113e4de577fd0f21a3a2eca85bf95f1"],
        },
        "318fb591b113e4de577fd0f21a3a2eca85bf95f1": {
          objectIds: ["318fb591b113e4de577fd0f21a3a2eca85bf95f1"],
          summary: "",
          parentCommitIds: ["4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba"],
        },
        "4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba": {
          objectIds: ["4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba"],
          summary: "",
          parentCommitIds: ["dd8375bab141fa958d6a016b5ae81256a480ce9c"],
        },
        "dd8375bab141fa958d6a016b5ae81256a480ce9c": {
          objectIds: ["dd8375bab141fa958d6a016b5ae81256a480ce9c"],
          summary: "",
          parentCommitIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
        },
        "1fb1941babdf045368373769cc6d1f3678e2221d": {
          objectIds: ["1fb1941babdf045368373769cc6d1f3678e2221d"],
          summary: "",
          parentCommitIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
        },
      },
      branches: {
        "pr/milestone-4": "4af73429f4a28d29c3f05d72c97b24d26cde5fcf",
        "FAX0111": "fed94eb726ab39705a7cfa997ac0b044951b1ce1",
        "FAX0112": "1fb1941babdf045368373769cc6d1f3678e2221d",
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      graph,
      "pr/milestone-4",
    );
    expect(mermaid.get()).toEqual({
      mainBranchName: "pr/milestone-4",
      commands: [
        { type: "commit", id: "4af7342" },
        { type: "branch", id: "FAX0112" },
        { type: "branch", id: "FAX0111" },
        { type: "checkout", id: "FAX0112" },
        { type: "commit", id: "1fb1941" },
        { type: "checkout", id: "FAX0111" },
        { type: "commit", id: "dd8375b" },
        { type: "commit", id: "4b8f044" },
        { type: "commit", id: "318fb59" },
        { type: "commit", id: "fed94eb" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });

  it("example02", () => {
    const graph: GitGraph = {
      rootCommitId: "4af73429f4a28d29c3f05d72c97b24d26cde5fcf",
      nodes: {
        "57df9941bcda423cb987c7058d3f240cde16249e": {
          objectIds: ["57df9941bcda423cb987c7058d3f240cde16249e"],
          summary: "",
          parentCommitIds: ["fed94eb726ab39705a7cfa997ac0b044951b1ce1"],
        },
        "fed94eb726ab39705a7cfa997ac0b044951b1ce1": {
          objectIds: ["fed94eb726ab39705a7cfa997ac0b044951b1ce1"],
          summary: "",
          parentCommitIds: ["318fb591b113e4de577fd0f21a3a2eca85bf95f1"],
        },
        "318fb591b113e4de577fd0f21a3a2eca85bf95f1": {
          objectIds: ["318fb591b113e4de577fd0f21a3a2eca85bf95f1"],
          summary: "",
          parentCommitIds: ["4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba"],
        },
        "4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba": {
          objectIds: ["4b8f044ae7ee91b8e1edabd354fada09a6d4a8ba"],
          summary: "",
          parentCommitIds: ["dd8375bab141fa958d6a016b5ae81256a480ce9c"],
        },
        "dd8375bab141fa958d6a016b5ae81256a480ce9c": {
          objectIds: ["dd8375bab141fa958d6a016b5ae81256a480ce9c"],
          summary: "",
          parentCommitIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
        },
        "4af73429f4a28d29c3f05d72c97b24d26cde5fcf": {
          objectIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
          summary: "",
          parentCommitIds: ["63b81ceea2433ae58d566d1cbc980a7e486f04d7"],
        },
        "ba71e5338dacf9679a59e8d2cde59fce042ecf0a": {
          objectIds: ["ba71e5338dacf9679a59e8d2cde59fce042ecf0a"],
          summary: "",
          parentCommitIds: ["1fb1941babdf045368373769cc6d1f3678e2221d"],
        },
        "1fb1941babdf045368373769cc6d1f3678e2221d": {
          objectIds: ["1fb1941babdf045368373769cc6d1f3678e2221d"],
          summary: "",
          parentCommitIds: ["4af73429f4a28d29c3f05d72c97b24d26cde5fcf"],
        },
      },
      branches: {
        "pr/milestone-4": "57df9941bcda423cb987c7058d3f240cde16249e",
        "FAX0111": "57df9941bcda423cb987c7058d3f240cde16249e",
        "FAX0112": "ba71e5338dacf9679a59e8d2cde59fce042ecf0a",
      },
    };

    const mermaid = MermaidGitGraphAccessor.createFromGitGraph(
      graph,
      "pr/milestone-4",
    );
    expect(mermaid.get()).toEqual({
      mainBranchName: "pr/milestone-4",
      commands: [
        { type: "commit", id: "4af7342" },
        { type: "branch", id: "FAX0112" },
        { type: "checkout", id: "pr/milestone-4" },
        { type: "commit", id: "dd8375b" },
        { type: "commit", id: "4b8f044" },
        { type: "commit", id: "318fb59" },
        { type: "commit", id: "fed94eb" },
        { type: "commit", id: "57df994", tags: ["FAX0111"] },
        { type: "checkout", id: "FAX0112" },
        { type: "commit", id: "1fb1941" },
        { type: "commit", id: "ba71e53" },
      ],
    });
    expect(mermaid.toText()).toMatchSnapshot();
  });
});
