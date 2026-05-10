-- CreateTable: config_lists
CREATE TABLE "config_lists" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "description"    TEXT,
  "isSystem"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "config_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable: config_list_items
CREATE TABLE "config_list_items" (
  "id"        TEXT NOT NULL,
  "listId"    TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "color"     TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "config_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_lists_organizationId_key_key" ON "config_lists"("organizationId", "key");
CREATE INDEX "config_lists_organizationId_idx" ON "config_lists"("organizationId");
CREATE INDEX "config_list_items_listId_idx" ON "config_list_items"("listId");

-- AddForeignKey
ALTER TABLE "config_lists" ADD CONSTRAINT "config_lists_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "config_list_items" ADD CONSTRAINT "config_list_items_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "config_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
