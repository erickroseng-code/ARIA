export interface Goal {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalsResponse {
  success: boolean;
  goals?: Goal[];
  goal?: Goal;
  error?: string;
  message?: string;
}
