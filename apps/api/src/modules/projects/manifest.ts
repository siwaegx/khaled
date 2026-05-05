import type { ModuleManifest } from "@business360/engine";

export const projectsManifest: ModuleManifest = {
  key: "projects",
  name: "Projects",
  version: "1.0.0",
  description: "Tasks, milestones, and team collaboration",
  icon: "Package",
  requiredPlan: "enterprise",
  routes: [
    { path: "/dashboard/projects",            label: "Overview" },
    { path: "/dashboard/projects/tasks",      label: "Tasks" },
    { path: "/dashboard/projects/milestones", label: "Milestones" },
  ],
  permissions: [
    { key: "projects:view",   label: "View projects",  roles: ["owner", "admin", "member"] },
    { key: "projects:edit",   label: "Edit projects",  roles: ["owner", "admin"] },
    { key: "projects:delete", label: "Delete projects",roles: ["owner", "admin"] },
  ],
};
