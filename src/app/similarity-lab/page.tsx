import { readFileSync } from "node:fs";
import { notFound } from "next/navigation";
import dataset from "../../../data/similarity-evaluation/notes.json";
import results from "../../../data/similarity-evaluation/results.json";
import { SimilarityLab, type BaselinePair, type LabNote } from "@/features/similarity/similarity-lab";
import "./lab.css";

export const dynamic = "force-dynamic";

function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function readBaselinePairs(): BaselinePair[] {
  const [headerLine, ...lines] = readFileSync("data/similarity-evaluation/candidate-rankings.csv", "utf8")
    .trim().split(/\r?\n/);
  const headers = parseCsvRow(headerLine);
  return lines.map((line) => {
    const values = parseCsvRow(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      sourceId: row.note_a_id,
      targetId: row.note_b_id,
      raw: Number(row.raw_cosine),
      centered: Number(row.centered_cosine),
    };
  }).filter((pair) => Number.isFinite(pair.raw) && Number.isFinite(pair.centered));
}

export default function SimilarityLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <SimilarityLab
    goal={dataset.goal}
    initialNotes={dataset.notes as LabNote[]}
    baselineModel={results.model}
    baselinePairs={readBaselinePairs()}
  />;
}
