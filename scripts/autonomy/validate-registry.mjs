import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const registryPath = resolve(process.cwd(), "docs/autonomy/TASKS.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const allowedStatuses = new Set(["pending", "in_progress", "done", "blocked", "paused_budget"]);
const ids = new Set();

if (registry.schemaVersion !== 1 || !Array.isArray(registry.tasks) || registry.tasks.length === 0) {
  throw new Error("Registry schema invalid: expected schemaVersion 1 and non-empty tasks array");
}

for (const task of registry.tasks) {
  if (!task.id || !task.title || !task.priority || !allowedStatuses.has(task.status)) {
    throw new Error(`Invalid task fields or status: ${task.id ?? "(missing id)"}`);
  }
  if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
  if (!Array.isArray(task.dependsOn) || !Array.isArray(task.acceptance) || !Array.isArray(task.evidence)) {
    throw new Error(`Invalid task arrays: ${task.id}`);
  }
  ids.add(task.id);
}

for (const task of registry.tasks) {
  for (const dependency of task.dependsOn) {
    if (!ids.has(dependency)) throw new Error(`Unknown dependency ${dependency} in ${task.id}`);
    if (dependency === task.id) throw new Error(`Task cannot depend on itself: ${task.id}`);
  }
  if (task.status === "done") {
    const e = task.evidence;
    if (!e.length || !e.some((item) => item.commitSha && item.commandsExecuted && item.result && item.timestamp)) {
      throw new Error(`Done task requires commitSha, commandsExecuted, result and timestamp evidence: ${task.id}`);
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visit(id) {
  if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dep of registry.tasks.find((t) => t.id === id).dependsOn) visit(dep);
  visiting.delete(id);
  visited.add(id);
}
for (const id of ids) visit(id);

console.log(`Autonomy registry valid: ${registry.tasks.length} tasks, no duplicate IDs, unknown dependencies or cycles.`);
