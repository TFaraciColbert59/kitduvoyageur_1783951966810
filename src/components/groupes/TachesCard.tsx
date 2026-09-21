import { lkvAlert, lkvConfirm } from '@/components/ui/dialogs';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, IconButton, Spinner } from '@/components/ui';

interface Tache {
  id: string;
  title: string;
  assigneeId?: string;
  assignee: string;
  tags: string[];
  completed: boolean;
  details: string;
}

interface TachesCardProps {
  tasks: Tache[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
}

const FIELD_CLASS =
  'rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function TachesCard({ tasks: initialTasks, groupId, onRefresh, user, members }: TachesCardProps) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Tache[]>(initialTasks);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const toggleTask = async (id: string, currentCompleted: boolean) => {
    if (!groupId) {
      lkvAlert("Erreur: Aucun groupe sélectionné.");
      return;
    }
    if (!user) {
      lkvAlert("Vous devez être connecté pour modifier une tâche.");
      return;
    }

    setTogglingId(id);
    const newStatus = currentCompleted ? 'todo' : 'done';

    setTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      completed: !currentCompleted,
      tags: !currentCompleted ? ['Fait'] : ['À faire']
    } : t));

    const { error } = await supabase
      .from('group_tasks')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Task toggle error:', error);
      lkvAlert('Erreur lors de la modification de la tâche : ' + error.message);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: currentCompleted } : t));
    } else if (onRefresh) {
      onRefresh();
    }
    setTogglingId(null);
  };

  const handleSelectAll = async () => {
    if (!groupId) {
      lkvAlert("Erreur: Aucun groupe sélectionné.");
      return;
    }
    if (!user) {
      lkvAlert("Vous devez être connecté pour modifier les tâches.");
      return;
    }
    if (tasks.length === 0) return;

    setSelectingAll(true);
    const allDone = tasks.every(t => t.completed);
    const targetStatus = allDone ? 'todo' : 'done';

    setTasks(prev => prev.map(t => ({
      ...t,
      completed: !allDone,
      tags: allDone ? ['À faire'] : ['Fait']
    })));

    const { error } = await supabase
      .from('group_tasks')
      .update({ status: targetStatus })
      .in('id', tasks.map(t => t.id));

    if (error) {
      console.error('Select all error:', error);
      lkvAlert('Erreur lors de la modification des tâches : ' + error.message);
      setTasks(prev => prev.map(t => ({
        ...t,
        completed: allDone,
        tags: allDone ? ['Fait'] : ['À faire']
      })));
    } else if (onRefresh) {
      onRefresh();
    }
    setSelectingAll(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    if (!groupId) {
      lkvAlert("Erreur: ID de groupe manquant.");
      return;
    }
    if (!user) {
      lkvAlert("Erreur: Vous devez être connecté pour ajouter une tâche.");
      return;
    }

    setLoading(true);

    const { data: newTask, error } = await supabase
      .from('group_tasks')
      .insert({
        group_id: groupId,
        created_by: user.id,
        assigned_to: assignedTo || null,
        title: newTaskTitle.trim(),
        status: 'todo'
      })
      .select('*')
      .single();

    if (error) {
      console.error('Task insert error:', error);
      lkvAlert('Erreur lors de la sauvegarde de la tâche : ' + error.message);
    } else {
      const assignedMember = members?.find(m => m.user_id === assignedTo);
      const assigneeName = assignedMember?.user_profiles?.full_name || (assignedTo ? 'Membre' : 'Non attribué');

      const createdTaskObj: Tache = {
        id: newTask?.id || `temp-${Date.now()}`,
        title: newTaskTitle.trim(),
        assigneeId: assignedTo || undefined,
        assignee: assigneeName,
        tags: ['À faire'],
        completed: false,
        details: ''
      };

      setTasks(prev => [createdTaskObj, ...prev]);
      setNewTaskTitle('');
      setAssignedTo('');
      setIsAdding(false);
      if (onRefresh) onRefresh();
    }

    setLoading(false);
  };

  const handleDeleteTask = async (id: string) => {
    if (!(await lkvConfirm('Voulez-vous vraiment supprimer cette tâche ?'))) return;

    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await supabase
      .from('group_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Task delete error:', error);
      lkvAlert('Erreur lors de la suppression : ' + error.message);
      if (onRefresh) onRefresh();
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const remainingCount = tasks.length - completedCount;

  const filteredTasks = tasks.filter(t => {
    if (filter === 'todo') return !t.completed;
    if (filter === 'done') return t.completed;
    return true;
  });

  return (
    <Card className="p-[var(--space-6)] transition-all duration-[var(--motion-control-duration)]">
      <div className="mb-[var(--space-2)] flex items-start justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          Tâches <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">à faire</span>
        </h2>
        <div className="flex items-center gap-[var(--space-2)]">
          <Badge>{remainingCount} restantes</Badge>
          <Badge>{completedCount} terminées</Badge>
        </div>
      </div>

      <div className="mb-[var(--space-6)] flex items-center justify-between">
        <p className="hidden max-w-sm font-sans text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)] sm:block">
          Chacun s&apos;attribue une tâche. Les rappels partent 48h avant l&apos;échéance.
        </p>
        <div className="flex w-full flex-wrap justify-end gap-[var(--space-2)] sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSelectAll}
            disabled={selectingAll || tasks.length === 0}
            loading={selectingAll}
          >
            {selectingAll ? '...' : 'Tout →'}
          </Button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            aria-label="Filtrer les tâches"
            className={`${FIELD_CLASS} min-h-[var(--control-height-sm)] cursor-pointer font-semibold`}
          >
            <option value="all">Filtrer (Tout)</option>
            <option value="todo">À faire</option>
            <option value="done">Terminées</option>
          </select>
          <Button
            variant={isAdding ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            icon={<Icon name={isAdding ? 'XMarkIcon' : 'PlusIcon'} size={12} aria-hidden="true" />}
          >
            {isAdding ? 'Annuler' : 'Ajouter une tâche'}
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card variant="compact" className="mb-[var(--space-6)] p-[var(--space-4)]">
          <form onSubmit={handleAddTask} className="flex flex-wrap gap-[var(--space-2)]">
            <input
              type="text"
              autoFocus
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Titre de la nouvelle tâche..."
              aria-label="Titre de la nouvelle tâche"
              className={`${FIELD_CLASS} min-w-[200px] flex-1`}
              disabled={loading}
            />
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              aria-label="Attribuer la tâche à"
              className={`${FIELD_CLASS} max-w-[170px]`}
              disabled={loading}
            >
              <option value="">Attribuer à...</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_profiles?.full_name || 'Membre'}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={!newTaskTitle.trim() || loading} loading={loading}>
              {loading ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
          </form>
        </Card>
      )}

      <div className="mb-[var(--space-6)] space-y-[var(--space-2)]">
        {filteredTasks.length === 0 && (
          <EmptyState
            compact
            icon={<Icon name="CheckCircleIcon" size={22} aria-hidden="true" />}
            title="Aucune tâche trouvée"
            description="Ajustez le filtre ou ajoutez une nouvelle tâche au groupe."
          />
        )}
        {filteredTasks.map((task) => (
          <Card key={task.id} variant="compact" className="group flex items-center gap-[var(--space-3)] p-[var(--space-3)]">
            <Button
              type="button"
              variant={task.completed ? 'primary' : 'secondary'}
              iconOnly
              aria-label={task.completed ? `Rouvrir la tâche ${task.title}` : `Marquer la tâche ${task.title} comme terminée`}
              aria-pressed={task.completed}
              onClick={() => toggleTask(task.id, task.completed)}
              disabled={togglingId === task.id}
              icon={
                togglingId === task.id ? (
                  <Spinner size="xs" label="" />
                ) : task.completed ? (
                  <Icon name="CheckIcon" size={12} aria-hidden="true" />
                ) : undefined
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                <h3 className={`font-sans text-[length:var(--lkv-text-caption)] font-semibold ${task.completed ? 'text-[color:var(--lkv-text-muted)] line-through' : 'text-[color:var(--lkv-text-primary)]'}`}>
                  {task.title}
                </h3>
                <span className="text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-warning-dark)]">— {task.assignee}</span>
                <div className="ml-auto flex items-center gap-[var(--space-1)]">
                  {task.tags.map(tag => (
                    <Badge key={tag} tone={tag === 'Fait' ? 'sage' : 'info'}>
                      {tag}
                    </Badge>
                  ))}
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label={`Supprimer la tâche ${task.title}`}
                    className="ml-[var(--space-2)] text-[color:var(--lkv-danger)] opacity-0 group-hover:opacity-100"
                  >
                    <Icon name="TrashIcon" size={14} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
              {task.details && <p className="mt-[var(--space-1)] font-sans text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{task.details}</p>}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
