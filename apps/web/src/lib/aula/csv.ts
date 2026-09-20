/**
 * CSV of the classroom progress (F3-02b). Pure and dependency-free: the file is built by hand,
 * with the exact header, escaping and encoding the ticket fixes, so a spreadsheet opens it
 * without a dialog. The caller owns the `Blob` and the download.
 */
import type { CellStatus } from './progressMatrix';

/** UTF-8 byte order mark: Excel reads the accents right only when the file starts with it. */
export const CSV_BOM = '﻿';

/** Header of the export, fixed by the ticket. */
export const CSV_HEADER = 'estudiante,tema,estado,mejor_puntuacion,intentos,completado_en';

/** Line separator: CRLF, as RFC 4180 asks. */
const CRLF = '\r\n';

/** Decimals of `mejor_puntuacion`; the decimal mark is a point, never a comma. */
const SCORE_DECIMALS = 2;

/** The Spanish state written in the file, one per cell status. */
const STATE_ES: Record<CellStatus, string> = {
  pending: 'pendiente',
  in_progress: 'en_curso',
  completed: 'completado',
};

/** One record of the file: a (student, topic) pair, pending ones included. */
export interface CsvRecord {
  readonly studentName: string;
  /** Full topic id, `ruta-1/m00-t01`: the `tema` column of the header. */
  readonly topicId: string;
  readonly status: CellStatus;
  readonly bestScore: number | null;
  readonly attempts: number;
  /** ISO 8601 instant, or `null` when the topic is not completed. */
  readonly completedAt: string | null;
}

/** Quotes a field that carries a comma, a quote or a line break, doubling its quotes. */
export function csvEscape(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

function score(bestScore: number | null): string {
  return bestScore === null ? '' : bestScore.toFixed(SCORE_DECIMALS);
}

/** The `tema` column is the topic id, which identifies the topic across routes and renames. */
function line(record: CsvRecord): string {
  return [
    record.studentName,
    record.topicId,
    STATE_ES[record.status],
    score(record.bestScore),
    String(record.attempts),
    record.completedAt ?? '',
  ]
    .map(csvEscape)
    .join(',');
}

/** The whole file: BOM, header and one line per record, every line closed with CRLF. */
export function toCsv(records: readonly CsvRecord[]): string {
  return `${CSV_BOM}${[CSV_HEADER, ...records.map(line)].join(CRLF)}${CRLF}`;
}

/**
 * Kebab-cases the group name: accents are dropped, punctuation and symbols vanish without
 * leaving a separator (`Física 3ºA` → `fisica-3a`) and only whitespace, `-` and `_` separate.
 */
function kebab(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s\-_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return plain === '' ? 'grupo' : plain;
}

/** `AAAA-MM-DD` of the given date in the browser's own time zone. */
function isoDay(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Name of the downloaded file: `progreso-<grupo-en-kebab>-<AAAA-MM-DD>.csv`. */
export function fileName(groupName: string, date: Date): string {
  return `progreso-${kebab(groupName)}-${isoDay(date)}.csv`;
}
