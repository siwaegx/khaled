-- Migrate existing 'admin' role rows to 'manager' (runs after enum commit)
UPDATE "org_members" SET role = 'manager' WHERE role = 'admin';
