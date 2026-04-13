/**
 * Local SQLite data layer for free-tier users.
 * Mirrors the Supabase schema so all stores can work identically offline.
 */
import * as SQLite from 'expo-sqlite';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { Goal, DailyTask } from '../../types';

// ─── DB singleton ──────────────────────────────────────────────────────────────
let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('goalapp.db');
  return _db;
}

// ─── Clear all data ────────────────────────────────────────────────────────────
export function clearAllDataLocal(): void {
  const db = getDb();
  db.execSync(`
    DELETE FROM daily_tasks;
    DELETE FROM habits;
    DELETE FROM goals;
  `);
}

// ─── Schema init ───────────────────────────────────────────────────────────────
export function initSchema(): void {
  const db = getDb();

  // Create tables — one execSync per statement for Android compatibility
  db.execSync(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local',
      goal_text TEXT NOT NULL,
      timeline_months INTEGER NOT NULL DEFAULT 3,
      target_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      user_context TEXT,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      current_completion_rate REAL NOT NULL DEFAULT 0
    )
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      habit_text TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'custom',
      frequency_days INTEGER NOT NULL DEFAULT 7,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_description TEXT,
      scheduled_date TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      failed INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS task_failures (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_reason TEXT NOT NULL,
      failure_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Column migrations — add columns that may be missing in older databases.
  // ALTER TABLE … ADD COLUMN is a no-op if the column already exists via try/catch.
  const existingCols = db
    .getAllSync<{ name: string }>(`PRAGMA table_info(daily_tasks)`)
    .map((c) => c.name);

  if (!existingCols.includes('task_description')) {
    db.execSync(`ALTER TABLE daily_tasks ADD COLUMN task_description TEXT`);
  }
  if (!existingCols.includes('failure_reason')) {
    db.execSync(`ALTER TABLE daily_tasks ADD COLUMN failure_reason TEXT`);
  }
  if (!existingCols.includes('completed_at')) {
    db.execSync(`ALTER TABLE daily_tasks ADD COLUMN completed_at TEXT`);
  }
  if (!existingCols.includes('failed')) {
    db.execSync(`ALTER TABLE daily_tasks ADD COLUMN failed INTEGER NOT NULL DEFAULT 0`);
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────────
function uuid(): string {
  return 'local-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Goals ─────────────────────────────────────────────────────────────────────
export function getActiveGoalLocal(): Goal | null {
  const db = getDb();
  const row = db.getFirstSync<any>(
    `SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
  );
  return row ? sqlRowToGoal(row) : null;
}

export function getAllGoalsLocal(): Goal[] {
  const db = getDb();
  const rows = db.getAllSync<any>(`SELECT * FROM goals ORDER BY created_at DESC`);
  return rows.map(sqlRowToGoal);
}

export function insertGoalLocal(params: {
  goalText: string;
  timelineMonths: number;
  targetDate: string;
  userContext?: string;
}): Goal {
  const db = getDb();
  const id = uuid();
  const createdAt = nowIso();

  db.runSync(
    `INSERT INTO goals (id, user_id, goal_text, timeline_months, target_date, status, created_at, user_context,
      total_tasks, completed_tasks, current_completion_rate)
     VALUES (?, 'local', ?, ?, ?, 'active', ?, ?, 0, 0, 0)`,
    [id, params.goalText, params.timelineMonths, params.targetDate, createdAt, params.userContext ?? null]
  );

  return getActiveGoalLocal()!;
}

export function updateGoalStatusLocal(goalId: string, status: 'active' | 'completed' | 'abandoned'): void {
  const db = getDb();
  db.runSync(`UPDATE goals SET status = ? WHERE id = ?`, [status, goalId]);
}

export function abandonAllActiveGoalsLocal(): void {
  const db = getDb();
  db.runSync(`UPDATE goals SET status = 'abandoned' WHERE status = 'active'`);
}

export function updateGoalContextLocal(goalId: string, userContext: string): void {
  const db = getDb();
  db.runSync(`UPDATE goals SET user_context = ? WHERE id = ?`, [userContext, goalId]);
}

export function updateGoalProgressLocal(goalId: string): void {
  const db = getDb();
  const allTasks = db.getAllSync<{ completed: number }>(
    `SELECT completed FROM daily_tasks WHERE goal_id = ?`,
    [goalId]
  );
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.completed === 1).length;
  const rate = total > 0 ? (done / total) * 100 : 0;
  db.runSync(
    `UPDATE goals SET total_tasks = ?, completed_tasks = ?, current_completion_rate = ? WHERE id = ?`,
    [total, done, rate, goalId]
  );
}

function sqlRowToGoal(row: any): Goal {
  return {
    id: row.id,
    user_id: row.user_id,
    goal_text: row.goal_text,
    timeline_months: row.timeline_months,
    target_date: row.target_date,
    status: row.status,
    created_at: row.created_at,
    user_context: row.user_context ?? undefined,
    total_tasks: row.total_tasks ?? 0,
    completed_tasks: row.completed_tasks ?? 0,
    current_completion_rate: row.current_completion_rate ?? 0,
    initial_conversation: {},
  };
}

// ─── Habits ────────────────────────────────────────────────────────────────────
export function insertHabitsLocal(
  goalId: string,
  habits: Array<{ text: string; days: number[] }>
): void {
  const db = getDb();
  for (const h of habits) {
    db.runSync(
      `INSERT INTO habits (id, goal_id, habit_text, frequency, frequency_days) VALUES (?, ?, ?, 'custom', ?)`,
      [uuid(), goalId, h.text.trim(), h.days.length]
    );
  }
}

// ─── Daily tasks ───────────────────────────────────────────────────────────────
export function getTodaysTasksLocal(activeGoalIds: string[]): DailyTask[] {
  if (!activeGoalIds.length) return [];
  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');
  const placeholders = activeGoalIds.map(() => '?').join(',');
  const rows = db.getAllSync<any>(
    `SELECT * FROM daily_tasks
     WHERE goal_id IN (${placeholders}) AND scheduled_date = ?
     ORDER BY priority DESC, created_at ASC`,
    [...activeGoalIds, today]
  );
  return rows.map(sqlRowToTask);
}

export function getTasksByDateRangeLocal(startDate: string, endDate: string): DailyTask[] {
  const db = getDb();
  const rows = db.getAllSync<any>(
    `SELECT * FROM daily_tasks
     WHERE scheduled_date >= ? AND scheduled_date <= ?
     ORDER BY scheduled_date ASC, priority DESC`,
    [startDate, endDate]
  );
  return rows.map(sqlRowToTask);
}

export function getTasksForAnalyticsLocal(goalId?: string): DailyTask[] {
  const db = getDb();
  const rows = goalId
    ? db.getAllSync<any>(`SELECT * FROM daily_tasks WHERE goal_id = ?`, [goalId])
    : db.getAllSync<any>(`SELECT * FROM daily_tasks`);
  return rows.map(sqlRowToTask);
}

export function getTasksForGoalsLocal(goalIds: string[]): DailyTask[] {
  if (!goalIds.length) return [];
  const db = getDb();
  const placeholders = goalIds.map(() => '?').join(',');
  const rows = db.getAllSync<any>(
    `SELECT * FROM daily_tasks WHERE goal_id IN (${placeholders})`,
    goalIds
  );
  return rows.map(sqlRowToTask);
}

export function markTaskCompleteLocal(taskId: string, completed: boolean): void {
  const db = getDb();
  if (completed) {
    db.runSync(
      `UPDATE daily_tasks SET completed = 1, completed_at = ? WHERE id = ?`,
      [nowIso(), taskId]
    );
  } else {
    db.runSync(
      `UPDATE daily_tasks SET completed = 0, completed_at = NULL, failed = 0, failure_reason = NULL WHERE id = ?`,
      [taskId]
    );
  }
}

export function markTaskFailedLocal(taskId: string, reason: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE daily_tasks SET failed = 1, failure_reason = ? WHERE id = ?`,
    [reason, taskId]
  );
  // Also log to task_failures
  const task = db.getFirstSync<any>(`SELECT goal_id FROM daily_tasks WHERE id = ?`, [taskId]);
  if (task) {
    db.runSync(
      `INSERT INTO task_failures (id, task_id, user_reason, failure_date, created_at) VALUES (?, ?, ?, ?, ?)`,
      [uuid(), taskId, reason, format(new Date(), 'yyyy-MM-dd'), nowIso()]
    );
  }
}

export function getFailureReasonsLocal(): Array<{ user_reason: string }> {
  const db = getDb();
  return db.getAllSync<{ user_reason: string }>(
    `SELECT user_reason FROM task_failures ORDER BY created_at DESC LIMIT 50`
  );
}

/**
 * Pre-generate daily_tasks for the next 30 days based on habit schedule.
 */
export function generateDailyTasksLocal(
  goalId: string,
  tasks: Array<{ text: string; days: number[] }>
): void {
  const db = getDb();
  const start = new Date();
  const end = addDays(start, 29);
  const allDays = eachDayOfInterval({ start, end });

  for (const day of allDays) {
    const dow = day.getDay();
    const dateStr = format(day, 'yyyy-MM-dd');
    for (const task of tasks) {
      if (task.days.includes(dow)) {
        db.runSync(
          `INSERT INTO daily_tasks
           (id, goal_id, task_title, scheduled_date, estimated_minutes, priority, completed, failed, created_at)
           VALUES (?, ?, ?, ?, 0, 'medium', 0, 0, ?)`,
          [uuid(), goalId, task.text.trim(), dateStr, nowIso()]
        );
      }
    }
  }
}

// ─── Goal-detail operations ────────────────────────────────────────────────────

export function getGoalByIdLocal(goalId: string): Goal | null {
  const db = getDb();
  const row = db.getFirstSync<any>(`SELECT * FROM goals WHERE id = ?`, [goalId]);
  return row ? sqlRowToGoal(row) : null;
}

export function getHabitsForGoalLocal(goalId: string): Array<{ id: string; habit_text: string }> {
  const db = getDb();
  return db.getAllSync<{ id: string; habit_text: string }>(
    `SELECT id, habit_text FROM habits WHERE goal_id = ? ORDER BY rowid`,
    [goalId]
  );
}

export function getUpcomingTaskTitlesLocal(
  goalId: string,
  fromDate: string
): Array<{ task_title: string; scheduled_date: string }> {
  const db = getDb();
  return db.getAllSync<{ task_title: string; scheduled_date: string }>(
    `SELECT task_title, scheduled_date FROM daily_tasks WHERE goal_id = ? AND scheduled_date >= ? LIMIT 200`,
    [goalId, fromDate]
  );
}

export function updateGoalTextLocal(goalId: string, goalText: string, timelineMonths: number): void {
  const db = getDb();
  db.runSync(
    `UPDATE goals SET goal_text = ?, timeline_months = ? WHERE id = ?`,
    [goalText, timelineMonths, goalId]
  );
}

export function deleteGoalLocal(goalId: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM goals WHERE id = ?`, [goalId]);
}

export function deleteHabitLocal(habitId: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM habits WHERE id = ?`, [habitId]);
}

export function deleteTasksByHabitLocal(goalId: string, habitText: string, fromDate: string): void {
  const db = getDb();
  db.runSync(
    `DELETE FROM daily_tasks WHERE goal_id = ? AND task_title = ? AND scheduled_date >= ?`,
    [goalId, habitText, fromDate]
  );
}

export function updateHabitDaysLocal(habitId: string, frequencyDays: number): void {
  const db = getDb();
  db.runSync(`UPDATE habits SET frequency_days = ? WHERE id = ?`, [frequencyDays, habitId]);
}

export function insertTasksForHabitLocal(goalId: string, habitText: string, days: number[]): void {
  const db = getDb();
  const start = new Date();
  const end = addDays(start, 29);
  for (const day of eachDayOfInterval({ start, end })) {
    if (days.includes(day.getDay())) {
      db.runSync(
        `INSERT INTO daily_tasks
         (id, goal_id, task_title, scheduled_date, estimated_minutes, priority, completed, failed, created_at)
         VALUES (?, ?, ?, ?, 0, 'medium', 0, 0, ?)`,
        [uuid(), goalId, habitText, format(day, 'yyyy-MM-dd'), nowIso()]
      );
    }
  }
}

function sqlRowToTask(row: any): DailyTask {
  return {
    id: row.id,
    goal_id: row.goal_id,
    roadmap_phase_id: '',
    task_title: row.task_title,
    task_description: row.task_description ?? undefined,
    scheduled_date: row.scheduled_date,
    estimated_minutes: row.estimated_minutes ?? 0,
    priority: row.priority ?? 'medium',
    completed: row.completed === 1,
    completed_at: row.completed_at ?? undefined,
    failed: row.failed === 1,
    failure_reason: row.failure_reason ?? undefined,
    was_rescheduled: false,
    created_at: row.created_at,
  };
}
