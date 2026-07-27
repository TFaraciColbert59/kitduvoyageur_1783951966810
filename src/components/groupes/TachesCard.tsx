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

  // Sync tasks state when initialTasks prop updates from parent
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

    // Optimistic UI update
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
      // Revert optimistic update
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: currentCompleted } : t));
    } else if (onRefresh) {
      onRefresh();
    }
    setTogglingId(null);
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
      // Optimistic local add
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

    // Optimistic local remove
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
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Tâches <span className="font-serif italic font-bold">à faire</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{remainingCount} restantes</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{completedCount} terminées</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#1C2620]/80 font-sans max-w-sm hidden sm:block">
          Chacun s'attribue une tâche. Les rappels partent 48h avant l'échéance.
        </p>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-full bg-[#1C2620]/5 text-[#1C2620] font-sans font-medium text-xs hover:bg-[#1C2620]/10 transition-colors border-none outline-none cursor-pointer"
          >
            <option value="all">Filtrer (Tout)</option>
            <option value="todo">À faire</option>
            <option value="done">Terminées</option>
          </select>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-full bg-[#33463C] text-white font-sans font-medium text-xs hover:bg-[#33463C]/90 transition-colors flex items-center gap-1"
          >
            <Icon name={isAdding ? "XMarkIcon" : "PlusIcon"} size={12} /> {isAdding ? 'Annuler' : 'Ajouter une tâche'}
          </button>
        </div>
      </div>
      
      {isAdding && (
        <form onSubmit={handleAddTask} className="mb-6 flex flex-wrap gap-2 bg-[#E7E3D6]/20 p-4 rounded-2xl border border-[#1C2620]/10">
          <input 
            type="text" 
            autoFocus
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="Titre de la nouvelle tâche..." 
            className="flex-1 min-w-[200px] bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
            disabled={loading}
          />
          <select 
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            className="bg-white border border-[#1C2620]/10 rounded-xl py-2 px-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#33463C]/20 max-w-[170px]"
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
            className="px-5 py-2 bg-[#1C2620] hover:bg-[#33463C] text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </form>
      )}
      
      <div className="space-y-3 mb-6">
        {filteredTasks.length === 0 && (
          <p className="text-center text-sm text-[#1C2620]/50 py-4">Aucune tâche trouvée.</p>
        )}
        {filteredTasks.map((task) => (
          <div key={task.id} className="flex gap-4 p-3 rounded-xl hover:bg-[#E7E3D6]/30 transition-colors group items-center">
            <button 
              onClick={() => toggleTask(task.id, task.completed)}
              disabled={togglingId === task.id}
              className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors border disabled:opacity-50
                ${task.completed ? 'bg-[#33463C] border-[#33463C] text-white' : 'bg-transparent border-[#1C2620]/30 text-transparent group-hover:border-[#33463C]'}`}
            >
              {togglingId === task.id ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="CheckIcon" size={14} />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-sans font-semibold text-sm ${task.completed ? 'text-[#1C2620]/50 line-through' : 'text-[#1C2620]'}`}>
                  {task.title}
                </h3>
                <span className="text-xs text-[#B5652D] font-medium">— {task.assignee}</span>
                <div className="flex gap-1 ml-auto items-center">
                  {task.tags.map(tag => (
                    <span key={tag} className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm
                      ${tag === 'Fait' ? 'bg-[#33463C]/10 text-[#33463C]' : 'bg-[#E7E3D6] text-[#1C2620]/70'}`}>
                      {tag}
                    </span>
                  ))}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 text-[#1C2620]/30 hover:text-red-500 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                    title="Supprimer la tâche"
                  >
                    <Icon name="TrashIcon" size={14} />
                  </button>
                </div>
              </div>
              {task.details && <p className="text-xs text-[#1C2620]/50 font-sans mt-0.5">{task.details}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
