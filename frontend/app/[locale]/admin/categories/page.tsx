'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, ApiError } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  enabled: boolean;
  uploadMinGroup: string;
  browseMinGroup: string;
  subcats: string[];
  torrentCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  '#6c63ff','#22c55e','#3b82f6','#ef4444',
  '#f59e0b','#a855f7','#ec4899','#14b8a6',
  '#64748b','#f97316',
];

const BLANK = {
  slug: '', label: '', icon: '📁', color: '#6c63ff', sortOrder: 0,
  enabled: true, uploadMinGroup: 'power', browseMinGroup: 'all', subcats: [] as string[],
};

function token() { return localStorage.getItem('access_token') ?? ''; }

// ── Sortable row component ────────────────────────────────────────────────────

function SortableRow({
  cat,
  onToggle,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onToggle: (c: Category) => void;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-current/5 hover:bg-current/5"
    >
      <td className="p-2 text-center">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-40 hover:opacity-100 select-none"
          title="Drag to reorder"
        >
          ⠿
        </span>
        <span className="ml-1 text-xs opacity-40">{cat.sortOrder}</span>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: cat.color + '33' }}
          >
            {cat.icon}
          </span>
          <div>
            <p className="font-medium text-sm">{cat.label}</p>
            <p className="text-xs opacity-40">/browse?catId={cat.id}</p>
          </div>
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {cat.subcats.slice(0, 4).map(s => (
            <span key={s} className="px-2 py-0.5 rounded text-[10px] border border-current/20">{s}</span>
          ))}
          {cat.subcats.length > 4 && (
            <span className="px-2 py-0.5 rounded text-[10px] border border-current/20 opacity-60">+{cat.subcats.length - 4}</span>
          )}
        </div>
      </td>
      <td className="p-3 text-right text-sm">{cat.torrentCount}</td>
      <td className="p-3 text-sm opacity-70 capitalize">{cat.uploadMinGroup}</td>
      <td className="p-3">
        <button
          onClick={() => onToggle(cat)}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${cat.enabled ? 'bg-green-500' : 'bg-current/20'}`}
          title={cat.enabled ? 'Disable' : 'Enable'}
        >
          <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${cat.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </td>
      <td className="p-3">
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onEdit(cat)}
            className="px-3 py-1 rounded border border-current/20 text-xs hover:border-current/50"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(cat)}
            disabled={cat.torrentCount > 0}
            className="px-3 py-1 rounded border border-red-500/40 text-xs text-red-400 hover:border-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            title={cat.torrentCount > 0 ? `${cat.torrentCount} torrents — cannot delete` : 'Delete'}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [form, setForm] = useState(isEdit ? {
    label: initial.label, slug: initial.slug, icon: initial.icon,
    color: initial.color, sortOrder: initial.sortOrder,
    uploadMinGroup: initial.uploadMinGroup, browseMinGroup: initial.browseMinGroup,
    subcats: initial.subcats,
  } : { ...BLANK, subcats: [] as string[] });
  const [subcatInput, setSubcatInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function slugify(s: string) {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function onLabelChange(v: string) {
    setForm(f => ({ ...f, label: v, slug: isEdit ? f.slug : slugify(v) }));
  }

  function addSubcat() {
    const v = subcatInput.trim();
    if (!v || form.subcats.includes(v)) return;
    setForm(f => ({ ...f, subcats: [...f.subcats, v] }));
    setSubcatInput('');
  }

  function removeSubcat(s: string) {
    setForm(f => ({ ...f, subcats: f.subcats.filter(x => x !== s) }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch(`/api/admin/categories/${initial.id}`, form, token());
      } else {
        await api.post('/api/admin/categories', form, token());
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-lg border border-current/20 p-6 w-full max-w-lg space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{isEdit ? 'Edit Category' : 'New Category'}</h2>

        {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs opacity-60 block mb-1">Name *</label>
            <input value={form.label} onChange={e => onLabelChange(e.target.value)}
              className="w-full px-3 py-2 rounded border border-current/20 bg-transparent text-sm focus:outline-none focus:border-current/50" />
          </div>

          <div>
            <label className="text-xs opacity-60 block mb-1">Slug *</label>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
              className="w-full px-3 py-2 rounded border border-current/20 bg-transparent text-sm font-mono focus:outline-none focus:border-current/50" />
          </div>

          <div>
            <label className="text-xs opacity-60 block mb-2">Icon</label>
            <div className="flex items-center gap-4">
              <span className="text-5xl leading-none">{form.icon || '📁'}</span>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                className="flex-1 px-3 py-2 rounded border border-current/20 bg-transparent text-sm focus:outline-none focus:border-current/50"
                placeholder="Paste an emoji" />
            </div>
          </div>

          <div>
            <label className="text-xs opacity-60 block mb-2">Accent color</label>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs opacity-60 block mb-1">Subcategories</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.subcats.map(s => (
                <span key={s} className="flex items-center gap-1 px-2 py-0.5 rounded border border-current/20 text-xs">
                  {s}
                  <button onClick={() => removeSubcat(s)} className="opacity-60 hover:opacity-100 leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={subcatInput}
                onChange={e => setSubcatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubcat())}
                placeholder="Add subcategory…"
                className="flex-1 px-3 py-1.5 rounded border border-current/20 bg-transparent text-sm focus:outline-none focus:border-current/50"
              />
              <button onClick={addSubcat} className="px-3 py-1.5 rounded border border-current/20 text-sm hover:border-current/50">Add</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs opacity-60 block mb-1">Browse permission</label>
              <select value={form.browseMinGroup} onChange={e => setForm(f => ({ ...f, browseMinGroup: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-current/20 bg-transparent text-sm focus:outline-none">
                <option value="all">All</option>
                <option value="user">User</option>
                <option value="power">Power</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">Upload permission</label>
              <select value={form.uploadMinGroup} onChange={e => setForm(f => ({ ...f, uploadMinGroup: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-current/20 bg-transparent text-sm focus:outline-none">
                <option value="user">User</option>
                <option value="power">Power</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded border border-current/20 text-sm hover:border-current/50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.label || !form.slug}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const router = useRouter();
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    try {
      const data = await api.get<Category[]>('/api/admin/categories', token());
      setCategories(data);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 403) {
        const loc = locale === 'en' ? '' : `/${locale}`;
        router.push(`${loc}/login`);
      }
    }
  }, [router, locale]);

  useEffect(() => { void load(); }, [load]);

  async function toggleEnabled(cat: Category) {
    try {
      await api.patch(`/api/admin/categories/${cat.id}`, { enabled: !cat.enabled }, token());
      void load();
    } catch { showToast('Failed to toggle'); }
  }

  async function deleteCategory(cat: Category) {
    if (cat.torrentCount > 0) {
      showToast(`Cannot delete — ${cat.torrentCount} torrents in this category`);
      return;
    }
    try {
      await api.delete(`/api/admin/categories/${cat.id}`, token());
      showToast(`Deleted "${cat.label}"`);
      void load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ ...c, sortOrder: i + 1 }));
    setCategories(reordered);

    try {
      await api.patch('/api/admin/categories/reorder', {
        items: reordered.map(c => ({ id: c.id, sortOrder: c.sortOrder })),
      }, token());
    } catch { showToast('Reorder failed'); void load(); }
  }

  const enabled  = categories.filter(c => c.enabled).length;
  const disabled = categories.length - enabled;
  const totalTorrents = categories.reduce((s, c) => s + c.torrentCount, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" style={{ color: 'var(--text-primary)' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded border border-current/20 text-sm shadow-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + New category
        </button>
      </div>

      {/* Stat chips */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: 'Total',    value: categories.length, color: 'var(--text-muted)' },
          { label: 'Enabled',  value: enabled,           color: '#22c55e' },
          { label: 'Disabled', value: disabled,          color: '#ef4444' },
          { label: 'Torrents', value: totalTorrents,     color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="px-4 py-2 rounded border border-current/10 text-sm" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <span style={{ color: s.color }} className="font-bold mr-1">{s.value}</span>
            <span className="opacity-60">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded border border-current/10 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-current/10 text-xs" style={{ color: 'var(--text-muted)' }}>
              <th className="p-2 w-12 text-center">Order</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Subcategories</th>
              <th className="p-3 text-right">Torrents</th>
              <th className="p-3 text-left">Upload</th>
              <th className="p-3 text-left">Enabled</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {categories.map(cat => (
                  <SortableRow
                    key={cat.id}
                    cat={cat}
                    onToggle={toggleEnabled}
                    onEdit={c => { setEditTarget(c); setShowModal(true); }}
                    onDelete={deleteCategory}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <CategoryModal
          initial={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={() => { void load(); showToast('Saved'); }}
        />
      )}
    </div>
  );
}
