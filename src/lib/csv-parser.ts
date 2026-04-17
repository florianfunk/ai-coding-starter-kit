/**
 * Client-side CSV parser with auto-detection for delimiter and German decimal format.
 */

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

/**
 * Auto-detect delimiter by counting occurrences in the first line.
 */
function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse a CSV string into headers and rows.
 * Handles semicolon/comma delimiters and quoted fields.
 */
export function parseCsv(
  csvText: string,
  forcedDelimiter?: string,
): CsvParseResult {
  // Normalize line endings
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = forcedDelimiter ?? detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseLine(line, delimiter));

  return { headers, rows };
}

/**
 * Convert a German-format number string to a JS number.
 * Handles: "40,22" -> 40.22, "1.234,56" -> 1234.56, "40.22" -> 40.22
 */
export function parseGermanNumber(value: string): number | null {
  if (!value || value.trim() === "") return null;

  let cleaned = value.trim();

  // If both . and , exist, determine which is decimal separator
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  if (hasDot && hasComma) {
    // If comma comes after dot: German format (1.234,56)
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // English format (1,234.56)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma: German decimal (40,22)
    cleaned = cleaned.replace(",", ".");
  }
  // Only dot or no separator: keep as-is

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parse a date string in DD.MM.YYYY or YYYY-MM-DD format to ISO date string.
 */
export function parseDate(value: string): string | null {
  if (!value || value.trim() === "") return null;

  const trimmed = value.trim();

  // DD.MM.YYYY
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const [, day, month, year] = deMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  return null;
}
