import fs from "fs";
import path from "path";
import type { Task } from "@/types";

const TASKS_FILE = path.join(process.cwd(), "data", "tasks.json");

function ensureDataDir() {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadTasks(): Task[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(TASKS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8")) as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  ensureDataDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export function createTask(
  data: Omit<Task, "id" | "createdAt" | "updatedAt">
): Task {
  const tasks = loadTasks();
  const task: Task = {
    ...data,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

export function updateTask(id: string, data: Partial<Task>): Task | null {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
  saveTasks(tasks);
  return tasks[idx];
}

export function deleteTask(id: string): boolean {
  const tasks = loadTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  if (filtered.length === tasks.length) return false;
  saveTasks(filtered);
  return true;
}
