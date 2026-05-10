-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable: add developerProfile relation (no column change needed on users, handled by foreign key on developer_profiles)

-- CreateTable
CREATE TABLE "developer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "website" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_submissions" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "module_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_modules" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billing" TEXT NOT NULL DEFAULT 'free',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marketplace_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_profiles_userId_key" ON "developer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_modules_submissionId_key" ON "marketplace_modules"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_modules_key_key" ON "marketplace_modules"("key");

-- AddForeignKey
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_modules" ADD CONSTRAINT "marketplace_modules_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "module_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
