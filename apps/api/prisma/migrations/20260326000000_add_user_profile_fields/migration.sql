-- AlterTable: add profile fields to users
ALTER TABLE "public"."users"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName"  TEXT,
  ADD COLUMN "username"  TEXT,
  ADD COLUMN "phone"     TEXT,
  ADD COLUMN "isActive"  BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: unique username (nullable, so NULLs don't conflict)
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");
