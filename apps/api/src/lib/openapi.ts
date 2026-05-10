import swaggerJsdoc from "swagger-jsdoc";

const definition: swaggerJsdoc.OAS3Definition = {
  openapi: "3.0.3",
  info: {
    title: "Business360 API",
    version: "4.1.0",
    description: "Multi-tenant SaaS ERP platform REST API",
    contact: { name: "Business360", url: "https://business360.app" },
  },
  servers: [
    { url: "/", description: "Current server" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "access_token",
        description: "JWT issued on /api/auth/login",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          isAdmin: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          plan: { type: "string", enum: ["free", "starter", "growth", "pro", "enterprise"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      OrgMember: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          organizationId: { type: "string" },
          role: { type: "string", enum: ["owner", "admin", "manager", "member", "viewer"] },
          joinedAt: { type: "string", format: "date-time" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      Module: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          enabled: { type: "boolean" },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  tags: [
    { name: "Auth", description: "Authentication and session management" },
    { name: "Organizations", description: "Organization management" },
    { name: "Members", description: "Organization members and roles" },
    { name: "Modules", description: "ERP module registry and activation" },
    { name: "Store", description: "Module marketplace" },
    { name: "Billing", description: "Stripe billing and subscriptions" },
    { name: "Admin", description: "Super-admin operations" },
    { name: "Reports", description: "Cross-module reporting" },
    { name: "Activity", description: "Audit log and activity feed" },
    { name: "Search", description: "Full-text search across modules" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Webhooks", description: "Outbound webhook configuration" },
    { name: "Documents", description: "Document storage and management" },
    { name: "API Keys", description: "Programmatic API access keys" },
    { name: "Teams", description: "Team and permission groups" },
    { name: "Invites", description: "Organization invitation flow" },
    { name: "Health", description: "Service health endpoints" },
  ],
};

export const openapiSpec = swaggerJsdoc({
  definition,
  apis: [
    "./src/routes/*.ts",
    "./src/routes/*.js",
  ],
});
