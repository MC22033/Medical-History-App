/**
 * A lean GEDCOM 5.5/5.5.1/7.0 parser scoped to what this app needs: people
 * (name, sex, birth/death dates, cause of death) and how they connect
 * (parent-child, spouse). GEDCOM has no standard field for health
 * conditions — those still get added by hand after import, which is the
 * point: this just removes the tedious part (re-typing everyone and how
 * they're related).
 *
 * GEDCOM is a flat, indented text format:
 *   0 @I1@ INDI
 *   1 NAME John /Smith/
 *   1 SEX M
 *   1 BIRT
 *   2 DATE 12 MAR 1950
 *   1 DEAT
 *   2 DATE 5 JUN 2010
 *   2 CAUS Heart attack
 *   1 FAMS @F1@
 *   0 @F1@ FAM
 *   1 HUSB @I1@
 *   1 WIFE @I2@
 *   1 CHIL @I3@
 *   1 MARR
 */

export interface GedcomImportPerson {
  gedcomId: string;
  firstName: string;
  lastName?: string;
  sex?: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate?: string;
  isDeceased: boolean;
  deathDate?: string;
  causeOfDeath?: string;
}

export interface GedcomImportRelationship {
  parentGedcomId: string;
  childGedcomId: string;
}

export interface GedcomImportPartnership {
  aGedcomId: string;
  bGedcomId: string;
  status?: string;
}

export interface GedcomParseResult {
  people: GedcomImportPerson[];
  relationships: GedcomImportRelationship[];
  partnerships: GedcomImportPartnership[];
  warnings: string[];
}

interface RawLine {
  level: number;
  xrefId?: string;
  tag: string;
  value?: string;
}

function tokenizeLines(text: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    // Strip a UTF-8 BOM if the first line carries one.
    const line = raw.replace(/^﻿/, "").trim();
    if (!line) continue;

    const recordStart = line.match(/^0 (@[^@\s]+@) (\S+)\s*$/);
    if (recordStart) {
      lines.push({ level: 0, xrefId: recordStart[1], tag: recordStart[2] });
      continue;
    }
    const generic = line.match(/^(\d+) (\S+)(?: (.*))?$/);
    if (generic) {
      lines.push({ level: Number(generic[1]), tag: generic[2], value: generic[3] });
    }
    // Anything else (malformed line) is silently skipped.
  }
  return lines;
}

function parseName(raw: string | undefined): { firstName: string; lastName?: string } {
  const value = (raw || "").trim();
  const slashed = value.match(/^([^/]*)\/([^/]*)\/(.*)$/);
  if (slashed) {
    const given = slashed[1].trim();
    const surname = slashed[2].trim();
    return { firstName: given || surname || "Unknown", lastName: surname || undefined };
  }
  return { firstName: value || "Unknown" };
}

export function parseGedcom(text: string): GedcomParseResult {
  const lines = tokenizeLines(text);

  const people = new Map<string, GedcomImportPerson>();
  const families = new Map<
    string,
    { husb?: string; wife?: string; children: string[]; marr: boolean; div: boolean }
  >();

  type RecordCtx = { type: "INDI" | "FAM" | "OTHER"; id?: string };
  let current: RecordCtx | null = null;
  let eventCtx: "BIRT" | "DEAT" | null = null;

  for (const line of lines) {
    if (line.level === 0) {
      eventCtx = null;
      if (line.tag === "INDI" && line.xrefId) {
        current = { type: "INDI", id: line.xrefId };
        people.set(line.xrefId, { gedcomId: line.xrefId, firstName: "Unknown", isDeceased: false });
      } else if (line.tag === "FAM" && line.xrefId) {
        current = { type: "FAM", id: line.xrefId };
        families.set(line.xrefId, { children: [], marr: false, div: false });
      } else {
        current = { type: "OTHER" };
      }
      continue;
    }
    if (!current) continue;

    if (current.type === "INDI") {
      const person = people.get(current.id!)!;
      if (line.level === 1) {
        eventCtx = null;
        switch (line.tag) {
          case "NAME": {
            const { firstName, lastName } = parseName(line.value);
            person.firstName = firstName;
            person.lastName = lastName;
            break;
          }
          case "SEX":
            person.sex = line.value === "M" ? "MALE" : line.value === "F" ? "FEMALE" : "UNKNOWN";
            break;
          case "BIRT":
            eventCtx = "BIRT";
            break;
          case "DEAT":
            person.isDeceased = true;
            eventCtx = "DEAT";
            break;
        }
      } else if (line.level === 2 && eventCtx) {
        if (line.tag === "DATE") {
          if (eventCtx === "BIRT") person.birthDate = line.value;
          if (eventCtx === "DEAT") person.deathDate = line.value;
        } else if (line.tag === "CAUS" && eventCtx === "DEAT") {
          person.causeOfDeath = line.value;
        }
      }
    } else if (current.type === "FAM") {
      const fam = families.get(current.id!)!;
      if (line.level === 1) {
        switch (line.tag) {
          case "HUSB":
            if (line.value) fam.husb = line.value;
            break;
          case "WIFE":
            if (line.value) fam.wife = line.value;
            break;
          case "CHIL":
            if (line.value) fam.children.push(line.value);
            break;
          case "MARR":
            fam.marr = true;
            break;
          case "DIV":
            fam.div = true;
            break;
        }
      }
    }
  }

  const validIds = new Set(people.keys());
  const relationships: GedcomImportRelationship[] = [];
  const partnerships: GedcomImportPartnership[] = [];
  let skippedParentRefs = 0;
  let skippedChildRefs = 0;

  for (const fam of families.values()) {
    const parents = [fam.husb, fam.wife].filter((id): id is string => !!id);
    for (const child of fam.children) {
      if (!validIds.has(child)) {
        skippedChildRefs++;
        continue;
      }
      for (const parentId of parents) {
        if (!validIds.has(parentId)) {
          skippedParentRefs++;
          continue;
        }
        relationships.push({ parentGedcomId: parentId, childGedcomId: child });
      }
    }
    if (fam.husb && fam.wife && validIds.has(fam.husb) && validIds.has(fam.wife)) {
      partnerships.push({
        aGedcomId: fam.husb,
        bGedcomId: fam.wife,
        status: fam.div ? "DIVORCED" : fam.marr ? "MARRIED" : "PARTNERED",
      });
    }
  }

  const warnings: string[] = [];
  if (skippedParentRefs > 0) {
    warnings.push(`${skippedParentRefs} family link(s) referenced a parent that wasn't found and were skipped.`);
  }
  if (skippedChildRefs > 0) {
    warnings.push(`${skippedChildRefs} family link(s) referenced a child that wasn't found and were skipped.`);
  }

  return { people: Array.from(people.values()), relationships, partnerships, warnings };
}
