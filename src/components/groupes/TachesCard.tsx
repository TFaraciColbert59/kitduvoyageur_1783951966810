import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

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
      alert("Erreur: Aucun groupe sélectionné.");
      return;
    }
    if (!user) {
      alert("Vous devez être connecté pour modifier une tâche.");
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
      alert('Erreur lors de la modification de la tâche : ' + error.message);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: currentCompleted } : t));
    } else if (onRefresh) {
      onRefresh();
    }
    setTogglingId(null);
  };

  const handleSelectAll = async () => {
    if (!groupId) {
      alert("Erreur: Aucun groupe sélectionné.");
      return;
    }
    if (!user) {
      alert("Vous devez être connecté pour modifier les tâches.");
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
      alert('Erreur lors de la modification des tâches : ' + error.message);
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
      alert("Erreur: ID de groupe manquant.");
      return;
    }
    if (!user) {
      alert("Erreur: Vous devez être connecté pour ajouter une tâche.");
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
      .select('*, user_profiles!group_tasks_assigned_to_fkey(full_name)')
      .single();
    
    if (error) {
      console.error('Task insert error:', error);
      alert('Erreur lors de la sauvegarde de la tâche : ' + error.message);
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
    if (!confirm('Voulez-vous vraiment supprimer cette tâche ?')) return;

    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await supabase
      .from('group_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Task delete error:', error);
      alert('Erreur lors de la suppression : ' + error.message);
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
    <div className="glass p-6 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-[#17402C]">Tâches <span className="font-serif italic font-normal text-[#17402C]">à faire</span></h2>
        <div className="flex items-center gap-2">
          <span className="glass-pill">{remainingCount} restantes</span>
          <span className="glass-pill">{completedCount} terminées</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#5C6B5E] font-sans max-w-sm hidden sm:block">
          Chacun s'attribue une tâche. Les rappels partent 48h avant l'échéance.
        </p>
        <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={handleSelectAll}
            disabled={selectingAll || tasks.length === 0}
            className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold disabled:opacity-50"
          >
            <span className="relative z-10">{selectingAll ? '...' : 'Tout →'}</span>
          </button>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="glass-input py-1.5 px-3 text-xs font-semibold cursor-pointer min-h-[36px]"
          >
            <option value="all">Filtrer (Tout)</option>
            <option value="todo">À faire</option>
            <option value="done">Terminées</option>
          </select>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="glass-capsule-btn primary py-1.5 px-3 text-xs font-bold flex items-center gap-1"
          >
            <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} className="relative z-10" />
            <span className="relative z-10">{isAdding ? 'Annuler' : 'Ajouter une tâche'}</span>
          </button>
        </div>
      </div>
      
      {isAdding && (
        <form onSubmit={handleAddTask} className="mb-6 flex flex-wrap gap-2 glass-sub-card p-4 rounded-2xl">
          <input 
            type="text" 
            autoFocus
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="Titre de la nouvelle tâche..." 
            className="glass-input flex-1 min-w-[200px] text-xs"
            disabled={loading}
          />
          <select 
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            className="glass-input text-xs max-w-[170px]"
            disabled={loading}
          >
            <option value="">Attribuer à...</option>
            {members?.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_profiles?.full_name || 'Membre'}
              </option>
            ))}
          </select>
          <button 
            type="submit"
            disabled={!newTaskTitle.trim() || loading}
            className="glass-capsule-btn primary py-2 px-4 text-xs font-bold disabled:opacity-50"
          >
            <span className="relative z-10">{loading ? 'Enregistrement...' : 'Sauvegarder'}</span>
          </button>
        </form>
      )}
      
      <div className="space-y-3 mb-6">
        {filteredTasks.length === 0 && (
          <p className="text-center text-sm text-[#5C6B5E] py-4">Aucune tâche trouvée.</p>
        )}
        {filteredTasks.map((task) => (
          <div key={task.id} className="glass-sub-card p-3 rounded-xl flex gap-4 items-center group">
            <button 
              type="button"
              onClick={() => toggleTask(task.id, task.completed)}
              disabled={togglingId === task.id}
              className={`glass-check-circle ${task.completed ? 'checked' : ''} disabled:opacity-50`}
            >
              {togglingId === task.id ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : task.completed ? (
                <Icon name="CheckIcon" size={12} className="relative z-10" />
              ) : null}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-sans font-semibold text-sm ${task.completed ? 'text-[#5C6B5E] line-through' : 'text-[#17402C]'}`}>
                  {task.title}
                </h3>
                <span className="text-xs text-[#D97746] font-medium">— {task.assignee}</span>
                <div className="flex gap-1 ml-auto items-center">
                  {task.tags.map(tag => (
                    <span key={tag} className={`glass-pill ${tag === 'Fait' ? '' : 'pill-info'}`}>
                      {tag}
                    </span>
                  ))}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 text-[#5C6B5E] hover:text-red-600 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                    title="Supprimer la tâche"
                  >
                    <Icon name="TrashIcon" size={14} className="relative z-10" />
                  </button>
                </div>
              </div>
              {task.details && <p className="text-xs text-[#5C6B5E] font-sans mt-0.5">{task.details}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
