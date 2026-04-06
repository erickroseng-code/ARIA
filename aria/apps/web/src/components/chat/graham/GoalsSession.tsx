'use client';

import { useState, useEffect } from 'react';
import { Goal } from '@/lib/types/goals.types';
import { Plus, Pencil, Trash2, TrendingUp, Target } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#f3f4f6'];

export function GoalsSession() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [chartType, setChartType] = useState<'progress' | 'pizza'>('progress');

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
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    try {
      const res = await fetch('/api/graham/goals');
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
      const targetValue = parseFloat(formData.targetValue);
      if (targetValue <= 0) {
        alert('O valor deve ser positivo');
        return;
      }

      if (editingGoal) {
        const res = await fetch(`/api/graham/goals/${editingGoal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.description,
            targetValue,
          }),
        });
        if (!res.ok) throw new Error('Erro ao atualizar meta');
      } else {
        const res = await fetch('/api/graham/goals', {
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
      const currentValue = parseFloat(progressData.currentValue);
      if (currentValue < 0) {
        alert('O valor deve ser não-negativo');
        return;
      }

      const res = await fetch(`/api/graham/goals/${progressData.goalId}/progress`, {
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
      const res = await fetch(`/api/graham/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar meta');
      await loadGoals();
    } catch (error) {
      console.error('[GoalsSession] Erro ao deletar:', error);
      alert('Erro ao deletar meta');
    }
  }

  function openEditModal(goal: Goal) {
    setEditingGoal(goal);
    setFormData({ description: goal.description, targetValue: goal.targetValue.toString() });
    setIsModalOpen(true);
  }

  function openProgressModal(goal: Goal) {
    setProgressData({ goalId: goal.id, currentValue: goal.currentValue.toString() });
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

  const pieData = goals.map((goal) => ({
    name: goal.description,
    value: calculatePercentage(goal),
  }));

  return (
    <div className="w-full space-y-4">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
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

      {/* Toggle de tipo de gráfico */}
      {goals.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">Visualizar:</span>
          <button
            onClick={() => setChartType('progress')}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'progress'
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
            }`}
          >
            Progresso
          </button>
          <button
            onClick={() => setChartType('pizza')}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
              chartType === 'pizza'
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
            }`}
          >
            Gráfico Pizza
          </button>
        </div>
      )}

      {/* Gráfico */}
      {goals.length > 0 && (
        <div className="p-4 bg-card border border-border rounded-lg">
          {chartType === 'progress' ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={goals}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="description"
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                  tick={{ maxWidth: 80, angle: -45, textAnchor: 'end', height: 60 }}
                />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                  }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  formatter={(value: any) => `${value.toFixed(1)}%`}
                />
                <Bar dataKey={(goal: Goal) => calculatePercentage(goal)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Cards de metas */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Carregando metas...</div>
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-border">
          <Target className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma meta criada ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Meta" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((goal) => {
            const percentage = calculatePercentage(goal);
            const isComplete = goal.currentValue >= goal.targetValue;

            return (
              <div key={goal.id} className="p-4 border border-border rounded-lg bg-card hover:bg-card/80 transition-colors group">
                {/* Título e ações */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-card-foreground line-clamp-2">{goal.description}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Alvo: <span className="font-medium">R$ {goal.targetValue.toFixed(2)}</span>
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

                {/* Status da meta */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Realizado</span>
                    <span className={`font-semibold ${isComplete ? 'text-accent' : 'text-card-foreground'}`}>
                      R$ {goal.currentValue.toFixed(2)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? 'bg-accent' : 'bg-primary'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Botão de atualizar progresso */}
                <button
                  onClick={() => openProgressModal(goal)}
                  className="w-full h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 transition-colors"
                >
                  <TrendingUp className="w-3 h-3" />
                  Lançar Valor
                </button>

                {/* Status de conclusão */}
                {isComplete && (
                  <div className="mt-2 px-2 py-1 rounded-md bg-accent/15 border border-accent/25">
                    <p className="text-xs font-medium text-accent">✓ Meta atingida!</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de adicionar/editar meta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-base font-semibold text-card-foreground mb-4">
              {editingGoal ? 'Editar Meta' : 'Nova Meta'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Descrição da Meta *
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
                  Valor da Meta (R$) *
                </label>
                <input
                  type="number"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  placeholder="Ex: 5000.00"
                  step="0.01"
                  min="0"
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
                onClick={handleCreateOrUpdate}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                {editingGoal ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de atualizar progresso */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-base font-semibold text-card-foreground mb-4">Lançar Valor de Progresso</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Valor Realizado (R$) *
                </label>
                <input
                  type="number"
                  value={progressData.currentValue}
                  onChange={(e) => setProgressData({ ...progressData, currentValue: e.target.value })}
                  placeholder="Ex: 1500.00"
                  step="0.01"
                  min="0"
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
                onClick={handleUpdateProgress}
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
