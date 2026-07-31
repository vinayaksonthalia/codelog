// CodeLog — shared topic engine. Mirrors the priority used in the dsa repo's
// sync.py so problems land in the same folders regardless of which tool filed them.
"use strict";

const CL_TAG_PRIORITY = [
  "dp", "dynamic programming", "graphs", "graph", "trees", "tree",
  "binary search tree", "greedy", "binary search", "two pointers",
  "sliding window", "recursion", "backtracking", "dsu", "union find",
  "math", "number theory", "strings", "string", "hashing", "hash table",
  "bitmasks", "bit manipulation", "heap (priority queue)", "stack", "queue",
  "linked list", "trie", "sortings", "sorting", "array", "data structures",
  "implementation", "constructive algorithms", "brute force", "simulation",
];

function clSlugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "") || "problem";
}

function clPickTopic(tags) {
  if (!tags || !tags.length) return "uncategorized";
  const low = tags.map((t) => String(t).toLowerCase());
  for (const p of CL_TAG_PRIORITY) {
    const i = low.indexOf(p);
    if (i !== -1) return clSlugify(low[i]);
  }
  return clSlugify(tags[0]);
}

// Map a language name/extension to a solution file extension.
function clExtFor(lang) {
  const l = String(lang || "").toLowerCase();
  const map = {
    "c++": "cpp", "cpp": "cpp", "c++17": "cpp", "c++20": "cpp", "c++23": "cpp",
    "gnu g++17 7.3.0": "cpp", "gnu g++20 13.2": "cpp", "gnu g++23 14.2": "cpp",
    "python": "py", "python3": "py", "pypy": "py", "pypy3": "py",
    "pypy 3": "py", "pypy 3-64": "py", "cpython 3": "py",
    "java": "java", "java 21": "java", "java 8": "java",
    "javascript": "js", "typescript": "ts", "golang": "go", "go": "go",
    "c": "c", "csharp": "cs", "c#": "cs", "kotlin": "kt", "rust": "rs",
    "ruby": "rb", "swift": "swift", "scala": "scala", "php": "php",
  };
  if (map[l]) return map[l];
  for (const k of Object.keys(map)) if (l.includes(k)) return map[k];
  return "txt";
}

// Node test hook (ignored inside the extension).
if (typeof module !== "undefined") {
  module.exports = { clPickTopic, clSlugify, clExtFor, CL_TAG_PRIORITY };
}
