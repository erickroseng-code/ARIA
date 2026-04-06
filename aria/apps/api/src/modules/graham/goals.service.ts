import { db } from '../../config/db';

export interface Goal {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  createdAt: string;
  updatedAt: string;
}

// Criar tabela se não existir
export function initializeGoalsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
}

export function createGoal(description: string, targetValue: number): Goal {
  const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO goals (id, description, targetValue, currentValue, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, description, targetValue, 0, now, now);

  return {
    id,
    description,
    targetValue,
    currentValue: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getGoals(): Goal[] {
  try {
    return db.prepare('SELECT * FROM goals ORDER BY createdAt DESC').all() as Goal[];
  } catch {
    return [];
  }
}

export function getGoalById(id: string): Goal | null {
  try {
    return db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | undefined || null;
  } catch {
    return null;
  }
}

export function updateGoalProgress(id: string, currentValue: number): Goal | null {
  const goal = getGoalById(id);
  if (!goal) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE goals SET currentValue = ?, updatedAt = ? WHERE id = ?
  `).run(currentValue, now, id);

  return {
    ...goal,
    currentValue,
    updatedAt: now,
  };
}

export function updateGoal(id: string, description: string, targetValue: number): Goal | null {
  const goal = getGoalById(id);
  if (!goal) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE goals SET description = ?, targetValue = ?, updatedAt = ? WHERE id = ?
  `).run(description, targetValue, now, id);

  return {
    ...goal,
    description,
    targetValue,
    updatedAt: now,
  };
}

export function deleteGoal(id: string): boolean {
  const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  return result.changes > 0;
}
