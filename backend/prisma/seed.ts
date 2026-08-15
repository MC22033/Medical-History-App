/**
 * Demo seed: builds a small three-generation family tree around "Alex Demo"
 * with health conditions weighted more heavily on the paternal side, so the
 * risk dashboard has something interesting to show out of the box.
 *
 * Run with: npm run seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateInviteCode } from "../src/lib/inviteCode";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: "Demo User" },
  });

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (existingMembership) {
    console.log("Demo data already seeded. Login with demo@example.com / password123");
    return;
  }

  const tree = await prisma.familyTree.create({
    data: { name: "The Demo Family", inviteCode: generateInviteCode() },
  });

  const p = (
    firstName: string,
    lastName: string,
    sex: "MALE" | "FEMALE",
    opts: { deceased?: boolean; deathDate?: string; causeOfDeath?: string } = {}
  ) =>
    prisma.person.create({
      data: {
        familyTreeId: tree.id,
        firstName,
        lastName,
        sex,
        isDeceased: !!opts.deceased,
        deathDate: opts.deathDate,
        causeOfDeath: opts.causeOfDeath,
      },
    });

  // Core person
  const alex = await p("Alex", "Demo", "MALE");

  // Parents
  const dad = await p("Robert", "Demo", "MALE", {
    deceased: true,
    deathDate: "2019",
    causeOfDeath: "Heart attack",
  });
  const mum = await p("Susan", "Demo", "FEMALE");

  // Paternal grandparents
  const paternalGrandpa = await p("Harold", "Demo", "MALE", {
    deceased: true,
    deathDate: "1998",
    causeOfDeath: "Complications of type 2 diabetes",
  });
  const paternalGrandma = await p("Margaret", "Demo", "FEMALE", {
    deceased: true,
    deathDate: "2005",
    causeOfDeath: "Stroke",
  });

  // Maternal grandparents
  const maternalGrandpa = await p("Walter", "Nguyen", "MALE", { deceased: true, deathDate: "2010" });
  const maternalGrandma = await p("Linh", "Nguyen", "FEMALE");

  // Paternal aunt/uncle + cousin
  const paternalAunt = await p("Diane", "Foster", "FEMALE");
  const cousinFromAunt = await p("Jordan", "Foster", "MALE");

  // Sibling
  const sibling = await p("Casey", "Demo", "FEMALE");

  // Spouse of core
  const spouse = await p("Priya", "Demo", "FEMALE");

  // Child
  const child = await p("Nina", "Demo", "FEMALE");

  const rel = (parentId: string, childId: string) =>
    prisma.relationship.create({ data: { parentId, childId } });

  await rel(dad.id, alex.id);
  await rel(mum.id, alex.id);
  await rel(dad.id, sibling.id);
  await rel(mum.id, sibling.id);
  await rel(paternalGrandpa.id, dad.id);
  await rel(paternalGrandma.id, dad.id);
  await rel(paternalGrandpa.id, paternalAunt.id);
  await rel(paternalGrandma.id, paternalAunt.id);
  await rel(paternalAunt.id, cousinFromAunt.id);
  await rel(maternalGrandpa.id, mum.id);
  await rel(maternalGrandma.id, mum.id);
  await rel(alex.id, child.id);
  await rel(spouse.id, child.id);

  const partner = (aId: string, bId: string, status: string) => {
    const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
    return prisma.partnership.create({ data: { personAId: a, personBId: b, status } });
  };
  await partner(dad.id, mum.id, "MARRIED");
  await partner(paternalGrandpa.id, paternalGrandma.id, "MARRIED");
  await partner(maternalGrandpa.id, maternalGrandma.id, "MARRIED");
  await partner(alex.id, spouse.id, "MARRIED");

  const cond = (
    personId: string,
    conditionName: string,
    category: string,
    opts: Partial<{ ageAtDiagnosis: number; isCauseOfDeath: boolean; source: string; notes: string }> = {}
  ) =>
    prisma.healthCondition.create({
      data: {
        personId,
        conditionName,
        category,
        ageAtDiagnosis: opts.ageAtDiagnosis,
        isCauseOfDeath: !!opts.isCauseOfDeath,
        source: opts.source || "FAMILY_RECOLLECTION",
        notes: opts.notes,
      },
    });

  // Paternal side: heavy on diabetes + cardiovascular disease.
  await cond(paternalGrandpa.id, "Type 2 Diabetes", "Endocrine", {
    ageAtDiagnosis: 52,
    source: "DEATH_CERTIFICATE",
    isCauseOfDeath: true,
    notes: "Listed as contributing cause on death certificate.",
  });
  await cond(paternalGrandma.id, "Stroke", "Cardiovascular", {
    ageAtDiagnosis: 74,
    source: "DEATH_CERTIFICATE",
    isCauseOfDeath: true,
  });
  await cond(paternalGrandma.id, "High Blood Pressure", "Cardiovascular", { ageAtDiagnosis: 60 });
  await cond(dad.id, "Type 2 Diabetes", "Endocrine", { ageAtDiagnosis: 45 });
  await cond(dad.id, "Heart Attack", "Cardiovascular", {
    ageAtDiagnosis: 58,
    isCauseOfDeath: true,
    source: "DEATH_CERTIFICATE",
  });
  await cond(paternalAunt.id, "Type 2 Diabetes", "Endocrine", { ageAtDiagnosis: 49 });
  await cond(cousinFromAunt.id, "Pre-diabetes", "Endocrine", { ageAtDiagnosis: 30 });

  // Maternal side: lighter, different pattern (breast cancer).
  await cond(maternalGrandma.id, "Breast Cancer", "Cancer", {
    ageAtDiagnosis: 61,
    source: "MEDICAL_RECORD",
  });
  await cond(mum.id, "Asthma", "Respiratory", { ageAtDiagnosis: 8 });

  // Core line
  await cond(sibling.id, "Anxiety", "Mental Health", { ageAtDiagnosis: 24, source: "SELF_REPORTED" });
  await cond(alex.id, "Seasonal Allergies", "Immune/Allergy", { ageAtDiagnosis: 12, source: "SELF_REPORTED" });

  await prisma.familyTree.update({ where: { id: tree.id }, data: { corePersonId: alex.id } });
  await prisma.membership.create({
    data: { userId: user.id, familyTreeId: tree.id, role: "OWNER", linkedPersonId: alex.id },
  });

  console.log("Seeded demo family tree.");
  console.log("  Login: demo@example.com / password123");
  console.log(`  Invite code for the tree: ${tree.inviteCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
