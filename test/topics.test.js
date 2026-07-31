const { clPickTopic, clSlugify, clExtFor } = require("../common/topics.js");
const cases = [
  [clPickTopic(["dp","greedy","math"]), "dp"],
  [clPickTopic(["Dynamic Programming","Memoization"]), "dynamic-programming"],
  [clPickTopic([]), "uncategorized"],
  [clSlugify("Yaroslav and Permutations!"), "yaroslav-and-permutations"],
  [clExtFor("GNU G++20 13.2"), "cpp"],
  [clExtFor("Python3"), "py"],
];
let pass = 0;
cases.forEach(([got, want], i) => {
  const ok = got === want;
  if (ok) pass++;
  console.log(ok ? "PASS" : "FAIL", i, got, ok ? "" : "!= " + want);
});
console.log(`${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
