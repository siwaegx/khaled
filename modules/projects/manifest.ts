import type { ModuleManifest } from "@business360/engine";

export const projectsManifest: ModuleManifest = {
  key: "projects",
  name: "Projects",
  description: "Tasks, milestones, and team collaboration.",
  version: "1.0.0",
  requiredPlan: "enterprise",
  icon: "Package",
  routes: [
    { path: "/dashboard/projects", label: "Projects" },
    { path: "/dashboard/projects/tasks", label: "Tasks" },
    { path: "/dashboard/projects/milestones", label: "Milestones" },
  ],
  permissions: [
    { key: "projects:read",       label: "View projects",  roles: ["owner", "admin", "member"] },
    { key: "projects:write",      label: "Edit projects",  roles: ["owner", "admin"] },
    { key: "projects:tasks:read", label: "View tasks",     roles: ["owner", "admin", "member"] },
    { key: "projects:tasks:write","label": "Edit tasks",   roles: ["owner", "admin", "member"] },
  ],
};
