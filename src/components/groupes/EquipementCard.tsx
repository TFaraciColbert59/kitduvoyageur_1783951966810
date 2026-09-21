'use client';
import { lkvConfirm } from '@/components/ui/dialogs';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card, Chip, EmptyState, IconButton, Modal, SearchField } from '@/components/ui';

interface EquipementItem {
  id: string;
  item: string;
  assigneeId?: string;
  assignee: string;
  weight: string;
  weightGrams?: number;
  quantity?: number;
  category?: string;
  is_shared?: boolean;
  status: string;
  notes: string;
  statusColor: string;
}

interface EquipementCardProps {
  equipment: EquipementItem[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
}

interface GearItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  weight_g?: number;
  quantity?: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Bivouac': '⛺',
  'Cuisine': '🍳',
  'Sécurité': '🩹',
  'Orientation': '🧭',
  'Eau & Hydratation': '💧',
  'Électronique': '🔋',
  'Divers': '🎒',
};

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function EquipementCard({ equipment, groupId, onRefresh, user, members }: EquipementCardProps) {
  const supabase = createClient();
  const { triggerHaptic } = useHapticFeedback();

  const [items, setItems] = useState<EquipementItem[]>(equipment);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tout');
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newQuantity, setNewQuantity] = useState(1);
  const [assignedTo, setAssignedTo] = useState('');

  const [editForm, setEditForm] = useState({ name: '', weightGrams: '', category: '', quantity: 1, is_shared: true, notes: '', assigned_to: '' });

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [personalItems, setPersonalItems] = useState<GearItem[]>([]);
  const [personalSearch, setPersonalSearch] = useState('');
  const [selectedGear, setSelectedGear] = useState<Record<string, boolean>>({});
  const [importingNow, setImportingNow] = useState(false);

  useEffect(() => { setItems(equipment); }, [equipment]);

  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 4000); };
  const showNotice = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  const runOp = async (op: any, onOk?: () => void, errPrefix = 'Erreur') => {
    const { error: e } = await op;
    if (e) { console.error(errPrefix, e); showError(`${errPrefix} : ${e.message}`); return false; }
    onOk?.();
    return true;
  };

  const refresh = () => { if (onRefresh) onRefresh(); };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !groupId || !user) { showError("Nom de l'objet requis"); return; }
    triggerHaptic('selection');
    setLoading(true);
    const weightGrams = parseInt(newItemWeight) || 0;
    await runOp(
      supabase.from('group_kit_items').insert({
        group_id: groupId,
        name: newItemName.trim(),
        weight_grams: weightGrams,
        assigned_to: assignedTo || null,
        category: newCategory,
        quantity: newQuantity,
        is_shared: true,
      }),
      () => {
        showNotice('Objet ajouté au kit partagé');
        setNewItemName('');
        setNewItemWeight('');
        setIsAdding(false);
        refresh();
      },
      'Ajout équipement'
    );
    setLoading(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!(await lkvConfirm('Supprimer cet objet du sac partagé ?'))) return;
    triggerHaptic('warning');
    setBusyId(itemId);
    await runOp(
      supabase.from('group_kit_items').delete().eq('id', itemId),
      () => { showNotice('Objet supprimé'); refresh(); },
      'Suppression équipement'
    );
    setBusyId(null);
  };

  const handleAssignToMe = async (item: EquipementItem) => {
    if (!user) { showError('Connectez-vous pour vous attribuer un objet'); return; }
    triggerHaptic('light');
    setBusyId(item.id);
    const newAssigned = item.assigneeId === user.id ? null : user.id;
    await runOp(
      supabase.from('group_kit_items').update({ assigned_to: newAssigned }).eq('id', item.id),
      () => {
        showNotice(newAssigned ? 'Objet pris en charge par vous' : 'Objet libéré');
        refresh();
      },
      'Affectation'
    );
    setBusyId(null);
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editForm.name.trim()) return;
    triggerHaptic('selection');
    setBusyId(itemId);
    await runOp(
      supabase.from('group_kit_items').update({
        name: editForm.name.trim(),
        weight_grams: parseInt(editForm.weightGrams) || 0,
        category: editForm.category || 'Divers',
        quantity: editForm.quantity,
        is_shared: editForm.is_shared,
        notes: editForm.notes || null,
        assigned_to: editForm.assigned_to || null,
      }).eq('id', itemId),
      () => {
        showNotice('Objet mis à jour');
        setEditingId(null);
        refresh();
      },
      'Mise à jour'
    );
    setBusyId(null);
  };

  const openImport = async () => {
    if (!user) { showError('Connectez-vous pour accéder à votre inventaire'); return; }
    setIsImporting(true);
    try {
      const { data, error: e } = await supabase
        .from('user_gear')
        .select('id, name, brand, category, weight_g, quantity')
        .eq('user_id', user.id)
        .order('name');
      if (e) throw e;
      setPersonalItems(data || []);
      const preselect: Record<string, boolean> = {};
      (data || []).forEach(g => {
        const already = items.some(i => i.item.toLowerCase() === g.name.toLowerCase());
        if (!already) preselect[g.id] = false;
      });
      setSelectedGear(preselect);
    } catch (err: any) {
      showError(`Impossible de charger votre inventaire : ${err.message}`);
    }
  };

  const executeImport = async () => {
    if (!groupId) return;
    const toImport = personalItems.filter(g => selectedGear[g.id]);
    if (toImport.length === 0) { showError('Aucun objet sélectionné'); return; }
    setImportingNow(true);
    let inserted = 0;
    for (const g of toImport) {
      const { error: e } = await supabase.from('group_kit_items').insert({
        group_id: groupId,
        name: g.brand ? `${g.brand} ${g.name}` : g.name,
        weight_grams: g.weight_g || 0,
        category: g.category || 'Divers',
        quantity: g.quantity || 1,
        assigned_to: user?.id || null,
        is_shared: true,
      });
      if (!e) inserted++;
    }
    setImportingNow(false);
    setIsImporting(false);
    showNotice(`${inserted} objet(s) importé(s) avec succès`);
    refresh();
  };

  const categories = ['Tout', 'Bivouac', 'Cuisine', 'Sécurité', 'Orientation', 'Eau & Hydratation', 'Électronique', 'Divers'];

  const filteredItems = items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !search || i.item.toLowerCase().includes(q) || i.assignee.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q);
    const matchCategory = selectedCategory === 'Tout' || (i.category || 'Divers') === selectedCategory;
    return matchSearch && matchCategory;
  });

  const unassignedCount = items.filter(e => !e.assigneeId || e.assignee === 'Non attribué').length;
  const totalGrams = items.reduce((acc, curr) => acc + ((curr.weightGrams || 0) * (curr.quantity || 1)), 0);
  const totalKg = (totalGrams / 1000).toFixed(2);

  const startEdit = (item: EquipementItem) => {
    setEditForm({
      name: item.item,
      weightGrams: String(item.weightGrams || 0),
      category: item.category || 'Divers',
      quantity: item.quantity || 1,
      is_shared: item.is_shared !== false,
      notes: item.notes || '',
      assigned_to: item.assigneeId || '',
    });
    setEditingId(item.id);
  };

  return (
    <Card className="p-[var(--space-4)] transition-all duration-[var(--motion-control-duration)] sm:p-[var(--space-6)]">
      <div className="mb-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Kit collaboratif</span>
            <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-sm)]">
              Équipement <em className="font-serif italic font-normal text-[color:var(--lkv-text-primary)]">partagé</em>
            </h2>
          </div>

          <div className="flex items-center gap-[var(--space-1)]">
            <Badge>{items.length} items</Badge>
            <Badge tone="warn">{unassignedCount} libres</Badge>
          </div>
        </div>

        {groupId && (
          <Link
            href={`/ai-configurator?groupId=${groupId}`}
            className="mt-[var(--space-1)] flex w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            <span className="flex items-center gap-[var(--space-2)]">
              <span aria-hidden>🎒</span>
              <span>Optimiser le sac avec l&apos;IA</span>
            </span>
            <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">Configurer →</span>
          </Link>
        )}
      </div>

      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
        <SearchField
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Chercher un objet, un porteur..."
          aria-label="Chercher un objet ou un porteur"
          containerClassName="flex-1"
        />

        <Button
          variant="secondary"
          onClick={openImport}
          icon={<Icon name="ArrowDownTrayIcon" size={12} aria-hidden="true" />}
          className="shrink-0"
        >
          <span className="hidden sm:inline">Mon kit</span>
        </Button>

        <Button
          variant={isAdding ? 'secondary' : 'primary'}
          onClick={() => {
            triggerHaptic('light');
            setIsAdding(!isAdding);
          }}
          className="shrink-0"
        >
          {isAdding ? 'Fermer' : 'Ajouter'}
        </Button>
      </div>

      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)] overflow-x-auto pb-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map(cat => (
          <Chip
            key={cat}
            selected={selectedCategory === cat}
            onClick={() => {
              triggerHaptic('light');
              setSelectedCategory(cat);
            }}
            icon={<span aria-hidden>{CATEGORY_EMOJI[cat] || '🎒'}</span>}
            className="whitespace-nowrap"
          >
            {cat}
          </Chip>
        ))}
      </div>

      {error && (
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-danger-dark)]" role="alert">
          <Icon name="ExclamationTriangleIcon" size={14} aria-hidden="true" /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-[var(--space-3)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-success-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]" role="status">
          {notice}
        </div>
      )}

      {isAdding && (
        <Card variant="compact" className="mb-[var(--space-4)] space-y-[var(--space-3)] p-[var(--space-4)]">
          <form onSubmit={handleAddItem} className="space-y-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <h4 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Ajouter un équipement commun</h4>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]">Kit partagé</span>
            </div>

            <div className="space-y-[var(--space-2)]">
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Ex: Tente MSR Hubba Hubba 2P..."
                aria-label="Nom de l'équipement"
                className={FIELD_CLASS}
              />

              <div className="grid grid-cols-3 gap-[var(--space-2)]">
                <input
                  type="number"
                  value={newItemWeight}
                  onChange={e => setNewItemWeight(e.target.value)}
                  placeholder="Poids (g)"
                  aria-label="Poids en grammes"
                  className={FIELD_CLASS}
                />
                <input
                  type="number"
                  min={1}
                  value={newQuantity}
                  onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Qté"
                  aria-label="Quantité"
                  className={FIELD_CLASS}
                />
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  aria-label="Catégorie"
                  className={FIELD_CLASS}
                >
                  {categories.filter(c => c !== 'Tout').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                aria-label="Qui porte cet objet"
                className={FIELD_CLASS}
              >
                <option value="">👤 Qui porte cet objet ? (Non attribué)</option>
                {members?.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user_profiles?.full_name || 'Membre'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-[var(--space-2)] pt-[var(--space-1)]">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAdding(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={!newItemName.trim() || loading} loading={loading}>
                {loading ? 'Ajout...' : 'Sauvegarder'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editingId && (
        <Card variant="compact" className="mb-[var(--space-4)] space-y-[var(--space-3)] p-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <h4 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Modifier l&apos;équipement</h4>
            <IconButton variant="ghost" size="sm" aria-label="Fermer l'édition" onClick={() => setEditingId(null)}>
              <Icon name="XMarkIcon" size={14} aria-hidden="true" />
            </IconButton>
          </div>

          <input
            type="text"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            aria-label="Nom de l'équipement"
            className={FIELD_CLASS}
          />

          <div className="grid grid-cols-3 gap-[var(--space-2)]">
            <input
              type="number"
              value={editForm.weightGrams}
              onChange={e => setEditForm(f => ({ ...f, weightGrams: e.target.value }))}
              placeholder="Poids (g)"
              aria-label="Poids en grammes"
              className={FIELD_CLASS}
            />
            <input
              type="number"
              min={1}
              value={editForm.quantity}
              onChange={e => setEditForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              placeholder="Qté"
              aria-label="Quantité"
              className={FIELD_CLASS}
            />
            <select
              value={editForm.assigned_to}
              onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
              aria-label="Porteur de l'objet"
              className={FIELD_CLASS}
            >
              <option value="">Non attribué</option>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={() => handleUpdateItem(editingId)}>
              Enregistrer
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-[var(--space-2)]">
        {filteredItems.length === 0 ? (
          <EmptyState
            compact
            icon={<span className="text-2xl" aria-hidden>🎒</span>}
            title={search ? 'Aucun objet trouvé' : 'Aucun équipement dans cette catégorie'}
            description="Ajoutez les éléments clés du bivouac pour équilibrer les sacs."
            actionLabel={!search ? 'Ajouter un objet' : undefined}
            onAction={!search ? () => setIsAdding(true) : undefined}
          />
        ) : (
          filteredItems.map(item => {
            const isAssigned = !!item.assigneeId && item.assignee !== 'Non attribué';
            const isMyAssignment = isAssigned && item.assigneeId === user?.id;

            return (
              <Card
                key={item.id}
                variant="compact"
                className="flex items-center justify-between gap-[var(--space-3)]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-[var(--space-2)]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] text-base" aria-hidden>
                    {CATEGORY_EMOJI[item.category || 'Divers'] || '🎒'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[var(--space-1)]">
                      <h4 className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                        {item.item}
                      </h4>
                      {item.quantity && item.quantity > 1 && (
                        <Badge>×{item.quantity}</Badge>
                      )}
                    </div>

                    <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      <span className="font-bold text-[color:var(--lkv-text-primary)]">
                        {item.weightGrams ? `${item.weightGrams}g` : item.weight || '—'}
                      </span>
                      <span aria-hidden>·</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignToMe(item)}
                        disabled={busyId === item.id}
                        aria-pressed={isMyAssignment}
                        className={`h-auto min-h-0 truncate px-0 underline decoration-dotted ${
                          isMyAssignment
                            ? 'font-bold text-[color:var(--lkv-success)]'
                            : isAssigned
                              ? 'text-[color:var(--lkv-text-primary)]'
                              : 'font-semibold text-[color:var(--lkv-warning-dark)]'
                        }`}
                      >
                        {isMyAssignment ? '👤 Porté par vous' : isAssigned ? `👤 ${item.assignee}` : '⚠️ Non attribué'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-[var(--space-1)]">
                  <IconButton
                    variant="glass"
                    size="sm"
                    onClick={() => startEdit(item)}
                    aria-label={`Modifier ${item.item}`}
                  >
                    <Icon name="PencilSquareIcon" size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    variant="glass"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={busyId === item.id}
                    aria-label={`Supprimer ${item.item}`}
                    className="text-[color:var(--lkv-danger)]"
                  >
                    <Icon name="TrashIcon" size={14} aria-hidden="true" />
                  </IconButton>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-[var(--space-4)] flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]">Poids total du matériel partagé</span>
        <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{totalKg} kg</span>
      </div>

      <Modal
        open={isImporting}
        onOpenChange={(next) => { if (!next) setIsImporting(false); }}
        title="Importer depuis mon kit"
        description="Sélectionnez les objets à partager avec l'équipe"
        size="lg"
        footer={
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button variant="secondary" onClick={() => setIsImporting(false)}>Annuler</Button>
            <Button onClick={executeImport} disabled={importingNow} loading={importingNow}>
              {importingNow ? 'Importation...' : 'Importer la sélection'}
            </Button>
          </div>
        }
      >
        <div className="space-y-[var(--space-3)]">
          <SearchField
            value={personalSearch}
            onChange={e => setPersonalSearch(e.target.value)}
            onClear={() => setPersonalSearch('')}
            placeholder="Filtrer mes équipements..."
            aria-label="Filtrer mes équipements"
          />

          <div className="max-h-[50vh] space-y-[var(--space-2)] overflow-y-auto pr-[var(--space-1)]">
            {personalItems
              .filter(g => !personalSearch || g.name.toLowerCase().includes(personalSearch.toLowerCase()))
              .map(gear => {
                const isChecked = !!selectedGear[gear.id];
                return (
                  <Card
                    key={gear.id}
                    variant="compact"
                    selected={isChecked}
                    onClick={() => setSelectedGear(s => ({ ...s, [gear.id]: !s[gear.id] }))}
                    className={`flex w-full items-center justify-between gap-[var(--space-2)] p-[var(--space-3)] text-left ${
                      isChecked
                        ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]'
                        : 'text-[color:var(--lkv-text-primary)]'
                    }`}
                  >
                    <div>
                      <h5 className="truncate text-[length:var(--lkv-text-caption)] font-bold">{gear.name}</h5>
                      <p className={`font-mono text-[length:var(--lkv-text-caption-2)] ${isChecked ? 'text-[color:var(--lkv-text-inverted)]/80' : 'text-[color:var(--lkv-text-muted)]'}`}>
                        {gear.weight_g ? `${gear.weight_g}g` : '—'} · {gear.category || 'Divers'}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 items-center justify-center rounded-[var(--lkv-radius-sm)] text-[length:var(--lkv-text-caption-2)] font-bold ${
                        isChecked ? 'bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)]' : 'border border-[color:var(--lkv-border-strong)]'
                      }`}
                    >
                      {isChecked ? '✓' : ''}
                    </span>
                  </Card>
                );
              })}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
