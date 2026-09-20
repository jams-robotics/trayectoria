/**
 * Topic × student matrix of the teacher's classroom (F3-02b). Pure: it takes the topics of the
 * route (read at build time from `content/es/ruta-1/ruta.json`), the members of the group
 * (F3-02a) and the `progress` rows the teacher may read under the "progress: own or taught
 * reads" policy, and returns the cells the table paints plus the per-student summary.
 *
 * No `window`, no Supabase and no clock here: the caller owns the query and the rendering.
 */

/** Status of one cell; mirrors `TopicState` of the route index (#120). */
export type CellStatus = 'pending' | 'in_progress' | 'completed';

/** One topic of the route, in the order of `ruta.json`, grouped by its module. */
export interface MatrixTopic {
  /** Full topic id, `ruta-1/m00-t01`. */
  readonly id: string;
  readonly moduleId: string;
  readonly moduleTitle: string;
  readonly title: string;
}

/** One student of the group; the display name comes from the members list of F3-02a. */
export interface MatrixMember {
  readonly userId: string;
  readonly displayName: string;
}

/** A row of `public.progress` as the classroom query selects it (migration 0001). */
export interface ProgressRow {
  readonly user_id: string;
  readonly topic_id: string;
  readonly status: string;
  readonly best_score: number | null;
  readonly attempts: number;
  readonly completed_at: string | null;
}

/** What the table shows for one (topic, student) pair. */
export interface Cell {
  readonly status: CellStatus;
  readonly bestScore: number | null;
  readonly attempts: number;
  readonly completedAt: string | null;
}

/** `completados/total` of one student, over every topic of the route. */
export interface MemberSummary {
  readonly userId: string;
  readonly completed: number;
  readonly total: number;
}

export interface ProgressMatrix {
  /** Cells by topic id and then by user id; a missing entry means `pending`. */
  readonly cells: ReadonlyMap<string, ReadonlyMap<string, Cell>>;
  /** One entry per member, in the order they were given. */
  readonly summary: readonly MemberSummary[];
}

/** The cell with nothing behind it: the student has not opened the topic. */
const PENDING_CELL: Cell = { status: 'pending', bestScore: null, attempts: 0, completedAt: null };

/** `progress.status` is checked to `in_progress | completed`; anything else is not a completion. */
function statusOf(status: string): CellStatus {
  return status === 'completed' ? 'completed' : 'in_progress';
}

function toCell(row: ProgressRow): Cell {
  return {
    status: statusOf(row.status),
    bestScore: row.best_score,
    attempts: row.attempts,
    completedAt: row.completed_at,
  };
}

/** The cell of one pair, or the pending one when the student has no row for that topic. */
export function cellOf(matrix: ProgressMatrix, topicId: string, userId: string): Cell {
  return matrix.cells.get(topicId)?.get(userId) ?? PENDING_CELL;
}

/**
 * Builds the matrix. Rows of topics or students outside the table are dropped, so a student who
 * left the group or a topic of another route never widens it.
 */
export function progressMatrix(
  topics: readonly MatrixTopic[],
  members: readonly MatrixMember[],
  rows: readonly ProgressRow[],
): ProgressMatrix {
  const topicIds = new Set(topics.map((topic) => topic.id));
  const memberIds = new Set(members.map((member) => member.userId));
  const cells = new Map<string, Map<string, Cell>>();

  for (const row of rows) {
    if (!topicIds.has(row.topic_id) || !memberIds.has(row.user_id)) continue;
    const byUser = cells.get(row.topic_id) ?? new Map<string, Cell>();
    byUser.set(row.user_id, toCell(row));
    cells.set(row.topic_id, byUser);
  }

  const summary = members.map((member) => ({
    userId: member.userId,
    completed: topics.filter(
      (topic) => cells.get(topic.id)?.get(member.userId)?.status === 'completed',
    ).length,
    total: topics.length,
  }));

  return { cells, summary };
}
