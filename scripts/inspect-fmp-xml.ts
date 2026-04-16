/**
 * Quick inspection: list all BaseTables, their record count, and field names.
 */
import { readFileSync } from "node:fs";
import { decode } from "iconv-lite";
import { XMLParser } from "fast-xml-parser";

const path = process.argv[2] ?? "daten/Lichtengross Produktkatalog_fmp12.xml";
console.log(`Reading ${path}…`);
const raw = readFileSync(path);
const text = decode(raw, "utf16-le").replace(/^\uFEFF/, "");
console.log(`Decoded ${text.length} chars`);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  preserveOrder: false,
  numberParseOptions: { skipLike: /./, leadingZeros: false, hex: false },
  unpairedTags: [],
  htmlEntities: false,
  processEntities: false,
});

const doc = parser.parse(text);

// Walk to BaseTableCatalog
const file = doc?.FMPReport?.File;
const catalog = file?.BaseTableCatalog?.BaseTable;
const tables = Array.isArray(catalog) ? catalog : [catalog];

console.log(`\nTables (${tables.length}):`);
for (const t of tables) {
  const fields = t?.FieldCatalog?.Field;
  const fArr = Array.isArray(fields) ? fields : fields ? [fields] : [];
  console.log(`  ${t["@_name"].padEnd(40)} records=${t["@_records"]} fields=${fArr.length}`);
  for (const f of fArr) {
    console.log(`    - ${f["@_name"]} (${f["@_dataType"]})`);
  }
}
