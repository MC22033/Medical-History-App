-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FamilyTree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "corePersonId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyTree_corePersonId_fkey" FOREIGN KEY ("corePersonId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "familyTreeId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "linkedPersonId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_familyTreeId_fkey" FOREIGN KEY ("familyTreeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyTreeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "sex" TEXT,
    "birthDate" TEXT,
    "isDeceased" BOOLEAN NOT NULL DEFAULT false,
    "deathDate" TEXT,
    "causeOfDeath" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Person_familyTreeId_fkey" FOREIGN KEY ("familyTreeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    CONSTRAINT "Relationship_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Relationship_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "status" TEXT,
    CONSTRAINT "Partnership_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Partnership_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "conditionName" TEXT NOT NULL,
    "category" TEXT,
    "ageAtDiagnosis" INTEGER,
    "isCauseOfDeath" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthCondition_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyTree_inviteCode_key" ON "FamilyTree"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyTree_corePersonId_key" ON "FamilyTree"("corePersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_familyTreeId_key" ON "Membership"("userId", "familyTreeId");

-- CreateIndex
CREATE INDEX "Person_familyTreeId_idx" ON "Person"("familyTreeId");

-- CreateIndex
CREATE INDEX "Relationship_childId_idx" ON "Relationship"("childId");

-- CreateIndex
CREATE INDEX "Relationship_parentId_idx" ON "Relationship"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_parentId_childId_key" ON "Relationship"("parentId", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_personAId_personBId_key" ON "Partnership"("personAId", "personBId");

-- CreateIndex
CREATE INDEX "HealthCondition_personId_idx" ON "HealthCondition"("personId");
