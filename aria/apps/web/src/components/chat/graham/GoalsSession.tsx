'use client';

import { useEffect, useState } from 'react';
import { Goal } from '@/lib/types/goals.types';
import { Plus, Pencil, Trash2, TrendingUp, Target } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const value = Number(digits) / 100;
  return formatCurrency(value);
}

function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) return NaN;
  return Number(digits) / 100;
}

export function GoalsSession() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    targetValue: '',
  });

  const [progressData, setProgressData] = useState({
    goalId: '',
    currentValue: '',
  });

  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    void loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/graham/goals`);
      if (!res.ok) throw new Error('Erro ao carregar metas');
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error('[GoalsSession] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrUpdate() {
    if (!formData.description.trim() || !formData.targetValue) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      const targetValue = parseCurrencyInput(formData.targetValue);
      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        alert('O valor deve ser positivo');
        return;
      }

      if (editingGoal) {
        const res = await fetch(`${API_URL}/api/graham/goals/${editingGoal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.description,
            targetValue,
          }),
        });
        if (!res.ok) throw new Error('Erro ao atualizar meta');
      } else {
        const res = await fetch(`${API_URL}/api/graham/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.description,
            targetValue,
          }),
        });
        if (!res.ok) throw new Error('Erro ao criar meta');
      }

      setFormData({ description: '', targetValue: '' });
      setEditingGoal(null);
      setIsModalOpen(false);
      await loadGoals();
    } catch (error) {
      console.error('[GoalsSession] Erro ao salvar:', error);
      alert('Erro ao salvar meta');
    }
  }

  async function handleUpdateProgress() {
    if (!progressData.goalId || progressData.currentValue === '') {
      alert('Preencha todos os campos');
      return;
    }

    try {
      const currentValue = parseCurrencyInput(progressData.currentValue);
      if (!Number.isFinite(currentValue) || currentValue < 0) {
        alert('O valor deve ser nao-negativo');
        return;
      }

      const res = await fetch(`${API_URL}/api/graham/goals/${progressData.goalId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentValue }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar progresso');

      setProgressData({ goalId: '', currentValue: '' });
      setShowProgressModal(false);
      await loadGoals();
    } catch (error) {
      console.error('[GoalsSession] Erro ao atualizar progresso:', error);
      alert('Erro ao atualizar progresso');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar esta meta?')) return;

    try {
      const res = await fetch(`${API_URL}/api/graham/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar meta');
      await loadGoals();
    } catch (error) {
      console.error('[GoalsSession] Erro ao deletar:', error);
      alert('Erro ao deletar meta');
    }
  }

  function openEditModal(goal: Goal) {
    setEditingGoal(goal);
    setFormData({ description: goal.description, targetValue: formatCurrency(goal.targetValue) });
    setIsModalOpen(true);
  }

  function openProgressModal(goal: Goal) {
    setProgressData({ goalId: goal.id, currentValue: formatCurrency(goal.currentValue) });
    setShowProgressModal(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingGoal(null);
    setFormData({ description: '', targetValue: '' });
  }

  const calculatePercentage = (goal: Goal) => {
    return Math.min((goal.currentValue / goal.targetValue) * 100, 100);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 pt-3 sm:pt-4 space-y-5">
      <div className="flex items-center justify-between border-b border-border py-2 pb-4 px-1 sm:px-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Metas & Objetivos</h3>
        </div>
        <button
          onClick={() => {
            setEditingGoal(null);
            setFormData({ description: '', targetValue: '' });
            setIsModalOpen(true);
          }}
          className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Meta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Carregando metas...</div>
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-border">
          <Target className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma meta criada ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Meta" para comecar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const percentage = calculatePercentage(goal);
            const isComplete = goal.currentValue >= goal.targetValue;

            return (
              <div key={goal.id} className="w-full p-4 border border-border rounded-lg bg-card hover:bg-card/80 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-card-foreground line-clamp-2">{goal.description}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Alvo: <span className="font-medium">{formatCurrency(goal.targetValue)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(goal)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar meta"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Deletar meta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Realizado</span>
                      <span className={`font-semibold ${isComplete ? 'text-accent' : 'text-card-foreground'}`}>
                        {formatCurrency(goal.currentValue)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>

                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-accent' : 'bg-primary'}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <PieChart width={84} height={84}>
                      <Pie
                        data={[
                          { name: 'Concluido', value: Math.min(goal.currentValue, goal.targetValue) },
                          { name: 'Restante', value: Math.max(goal.targetValue - goal.currentValue, 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={24}
                        outerRadius={36}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill={isComplete ? '#22c55e' : '#3b82f6'} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-card-foreground">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openProgressModal(goal)}
                  className="w-full h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 transition-colors"
                >
                  <TrendingUp className="w-3 h-3" />
                  Lancar Valor
                </button>

                {isComplete && (
                  <div className="mt-2 px-2 py-1 rounded-md bg-accent/15 border border-accent/25">
                    <p className="text-xs font-medium text-accent">Meta atingida!</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-base font-semibold text-card-foreground mb-4">
              {editingGoal ? 'Editar Meta' : 'Nova Meta'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Descricao da Meta *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Comprar notebook, Guardar para viagem..."
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-card-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Valor da Meta *
                </label>
                <input
                  type="text"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: formatCurrencyInput(e.target.value) })}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-card-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 h-9 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-muted/80 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleCreateOrUpdate(); }}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                {editingGoal ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-base font-semibold text-card-foreground mb-4">Lancar Valor de Progresso</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Valor Realizado *
                </label>
                <input
                  type="text"
                  value={progressData.currentValue}
                  onChange={(e) => setProgressData({ ...progressData, currentValue: formatCurrencyInput(e.target.value) })}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-card-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowProgressModal(false)}
                className="flex-1 h-9 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-muted/80 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleUpdateProgress(); }}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
