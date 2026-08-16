'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  model?: string;
  sku?: string;
  price?: number;
  stock?: number;
  image?: string;
}

export interface ShopProduct {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  category_main: string;
  category_sub: string;
  price_eur: number;
  cost_price_eur?: number;
  vat_rate?: number;
  original_price?: number;
  savings?: number;
  weight_g: number;
  weight_grams: number;
  dimensions: string;
  materials: string;
  warranty: string;
  description_why: string;
  advantages_array: string[];
  disadvantages_array: string[];
  available_europe: boolean;
  available_usa: boolean;
  score_kdv: number;
  essentiality: string;
  cabin_compatible: boolean;
  image: string;
  image_alt: string;
  rating: number;
  review_count: number;
  available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  stock: number;
  min_stock?: number;
  supplier?: string;
  ean?: string;
  tags?: string[];
  variants?: ProductVariant[];
  meta_title?: string;
  meta_description?: string;
  transaction_type: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  storage_path: string;
  alt: string;
  is_primary: boolean;
  sort_order: number;
  created_at?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_table: string;
  target_id: string;
  target_name: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
}

export type AdminTab = 'catalogue' | 'editor' | 'stock' | 'categories' | 'import_export' | 'audit';
export type EditorSubTab = 'info' | 'images' | 'pricing' | 'stock' | 'variants' | 'categories' | 'seo' | 'supplier' | 'history';

const ESSENTIALITY_OPTIONS = ['Indispensable', 'Recommandé', 'Optionnel', 'Confort', 'Luxe'];
const TRANSACTION_TYPES = ['achat', 'location', 'enchère', 'occasion'];

// ─── Default Blank Product ───────────────────────────────────────────────────

const BLANK_PRODUCT: Partial<ShopProduct> = {
  product_id: '',
  slug: '',
  name: '',
  brand: 'Le Kit du Voyageur',
  model: '',
  category: 'Équipement du sac',
  category_main: 'Équipement du sac',
  category_sub: 'Général',
  price_eur: 0,
  cost_price_eur: 0,
  vat_rate: 20,
  original_price: 0,
  savings: 0,
  weight_g: 0,
  weight_grams: 0,
  dimensions: '',
  materials: '',
  warranty: '2 ans',
  description_why: '',
  advantages_array: [],
  disadvantages_array: [],
  available_europe: true,
  available_usa: false,
  score_kdv: 85,
  essentiality: 'Recommandé',
  cabin_compatible: false,
  image: '',
  image_alt: '',
  rating: 5,
  review_count: 0,
  available: true,
  is_active: true,
  stock: 10,
  min_stock: 2,
  supplier: 'BigBuy',
  ean: '',
  tags: [],
  variants: [],
  meta_title: '',
  meta_description: '',
  transaction_type: 'achat',
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// ─── Main Admin Component ─────────────────────────────────────────────────────

export default function AdminProductsManager() {
  const supabase = useMemo(() => createClient(), []);

  // Main navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('catalogue');
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('info');

  // Products state
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('admin@lekitduvoyageur.fr');

  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionType, setBulkActionType] = useState<string>('');
  const [bulkCategoryVal, setBulkCategoryVal] = useState<string>('');
  const [bulkPriceChange, setBulkPriceChange] = useState<{ type: 'percent' | 'fixed'; value: number }>({ type: 'percent', value: 0 });
  const [bulkStockVal, setBulkStockVal] = useState<number>(0);
  const [bulkTagVal, setBulkTagVal] = useState<string>('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'deleted'>('active');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<keyof ShopProduct>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Product Editing state
  const [editingProduct, setEditingProduct] = useState<Partial<ShopProduct> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);
  const [productAuditLogs, setProductAuditLogs] = useState<AuditLog[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Stock Adjustment quick form
  const [quickStockItem, setQuickStockItem] = useState<ShopProduct | null>(null);
  const [stockAdjType, setStockAdjType] = useState<'ajustement' | 'reassort' | 'inventaire' | 'retour'>('reassort');
  const [stockAdjQuantity, setStockAdjQuantity] = useState<number>(0);
  const [stockAdjNotes, setStockAdjNotes] = useState<string>('');

  // Categories & Subcategories
  const [newCatName, setNewCatName] = useState('');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [selectedParentCat, setSelectedParentCat] = useState('');

  // Global Stock Movements & Audit
  const [globalMovements, setGlobalMovements] = useState<StockMovement[]>([]);
  const [globalAuditLogs, setGlobalAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Notifications / Toast
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ─── Fetch Current User & Products ──────────────────────────────────────────

  const fetchAuthUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    } catch (e) {
      console.error('Error fetching auth user', e);
    }
  }, [supabase]);

  const fetchProducts = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      showToast(`Erreur chargement catalogue: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, showToast]);

  const fetchGlobalStockMovements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setGlobalMovements(data);
    } catch (e) {
      console.error(e);
    }
  }, [supabase]);

  const fetchGlobalAuditLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setGlobalAuditLogs(data);
    } catch (e) {
      console.error(e);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAuthUser();
    fetchProducts();
  }, [fetchAuthUser, fetchProducts]);

  useEffect(() => {
    if (activeTab === 'stock') fetchGlobalStockMovements();
    if (activeTab === 'audit') fetchGlobalAuditLogs();
  }, [activeTab, fetchGlobalStockMovements, fetchGlobalAuditLogs]);

  // ─── Categories & Brands Lists ──────────────────────────────────────────────

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category_main) set.add(p.category_main);
      else if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [products]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; subcategories: Set<string> }> = {};
    products.forEach(p => {
      const cat = p.category_main || p.category || 'Non catégorisé';
      if (!stats[cat]) {
        stats[cat] = { total: 0, active: 0, subcategories: new Set() };
      }
      stats[cat].total += 1;
      if (p.is_active && !p.deleted_at) stats[cat].active += 1;
      if (p.category_sub) stats[cat].subcategories.add(p.category_sub);
    });
    return stats;
  }, [products]);

  // ─── Filtered & Sorted Products ─────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Status filter
      if (filterStatus === 'active' && (p.deleted_at || !p.is_active)) return false;
      if (filterStatus === 'inactive' && (p.deleted_at || p.is_active)) return false;
      if (filterStatus === 'deleted' && !p.deleted_at) return false;

      // Stock status filter
      const minStock = p.min_stock ?? 2;
      if (filterStockStatus === 'in_stock' && p.stock <= minStock) return false;
      if (filterStockStatus === 'low_stock' && (p.stock <= 0 || p.stock > minStock)) return false;
      if (filterStockStatus === 'out_of_stock' && p.stock > 0) return false;

      // Category filter
      if (filterCategory && p.category_main !== filterCategory && p.category !== filterCategory) return false;

      // Brand filter
      if (filterBrand && p.brand !== filterBrand) return false;

      // Search term
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchBrand = p.brand?.toLowerCase().includes(q);
        const matchSku = p.product_id?.toLowerCase().includes(q);
        const matchCat = p.category?.toLowerCase().includes(q) || p.category_sub?.toLowerCase().includes(q);
        const matchTags = p.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchBrand && !matchSku && !matchCat && !matchTags) return false;
      }

      return true;
    });
  }, [products, filterStatus, filterStockStatus, filterCategory, filterBrand, search]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal = a[sortBy] ?? '';
      let bVal = b[sortBy] ?? '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, page, pageSize]);

  // ─── Stats KPI ──────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = products.filter(p => !p.deleted_at).length;
    const active = products.filter(p => p.is_active && !p.deleted_at).length;
    const lowStock = products.filter(p => !p.deleted_at && p.stock > 0 && p.stock <= (p.min_stock ?? 2)).length;
    const outOfStock = products.filter(p => !p.deleted_at && p.stock <= 0).length;
    const totalValuation = products
      .filter(p => !p.deleted_at && p.is_active)
      .reduce((acc, p) => acc + (p.price_eur || 0) * (p.stock || 0), 0);
    const totalUnits = products
      .filter(p => !p.deleted_at)
      .reduce((acc, p) => acc + (p.stock || 0), 0);

    return { total, active, lowStock, outOfStock, totalValuation, totalUnits };
  }, [products]);

  // ─── Audit Logger ───────────────────────────────────────────────────────────

  const logAdminAction = useCallback(async (action: string, targetId: string, targetName: string, oldData?: any, newData?: any) => {
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_email: userEmail,
        action,
        target_table: 'shop_products',
        target_id: targetId,
        target_name: targetName,
        old_data: oldData ?? null,
        new_data: newData ?? null,
      });
    } catch (err) {
      console.warn('Audit log error', err);
    }
  }, [supabase, userEmail]);

  // ─── Open Product Editor ────────────────────────────────────────────────────

  const openProductEditor = async (prod?: ShopProduct) => {
    if (prod) {
      setIsCreatingNew(false);
      setEditingProduct({ ...prod });
      setEditorSubTab('info');
      setActiveTab('editor');

      // Fetch images for this product
      try {
        const { data: imgData } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', prod.id)
          .order('sort_order', { ascending: true });
        setProductImages(imgData || []);
      } catch (e) {
        setProductImages([]);
      }

      // Fetch stock movements for this product
      try {
        const { data: movData } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('product_id', prod.id)
          .order('created_at', { ascending: false });
        setProductMovements(movData || []);
      } catch (e) {
        setProductMovements([]);
      }

      // Fetch audit logs for this product
      try {
        const { data: auditData } = await supabase
          .from('admin_audit_logs')
          .select('*')
          .eq('target_id', prod.id)
          .order('created_at', { ascending: false });
        setProductAuditLogs(auditData || []);
      } catch (e) {
        setProductAuditLogs([]);
      }
    } else {
      setIsCreatingNew(true);
      const generatedId = `PROD-${Date.now().toString().slice(-6)}`;
      setEditingProduct({
        ...BLANK_PRODUCT,
        product_id: generatedId,
        slug: `nouveau-produit-${Date.now().toString().slice(-4)}`,
        name: 'Nouveau Produit Outdoor',
      });
      setProductImages([]);
      setProductMovements([]);
      setProductAuditLogs([]);
      setEditorSubTab('info');
      setActiveTab('editor');
    }
  };

  // ─── Save / Update Product ──────────────────────────────────────────────────

  const handleSaveProduct = async () => {
    if (!editingProduct?.name?.trim()) {
      showToast('Le nom du produit est obligatoire', 'error');
      return;
    }

    setSavingProduct(true);
    try {
      const generatedSlug = editingProduct.slug?.trim() || slugify(editingProduct.name);
      
      const payload: Partial<ShopProduct> = {
        name: editingProduct.name.trim(),
        slug: generatedSlug,
        brand: editingProduct.brand || 'Le Kit du Voyageur',
        model: editingProduct.model || '',
        product_id: editingProduct.product_id || `KDV-${Date.now()}`,
        ean: editingProduct.ean || '',
        category: editingProduct.category_main || editingProduct.category || 'Équipement du sac',
        category_main: editingProduct.category_main || editingProduct.category || 'Équipement du sac',
        category_sub: editingProduct.category_sub || '',
        price_eur: Number(editingProduct.price_eur) || 0,
        cost_price_eur: Number(editingProduct.cost_price_eur) || 0,
        vat_rate: Number(editingProduct.vat_rate) || 20,
        original_price: Number(editingProduct.original_price) || 0,
        savings: Number(editingProduct.savings) || 0,
        weight_g: Number(editingProduct.weight_g || editingProduct.weight_grams) || 0,
        weight_grams: Number(editingProduct.weight_g || editingProduct.weight_grams) || 0,
        dimensions: editingProduct.dimensions || '',
        materials: editingProduct.materials || '',
        description_why: editingProduct.description_why || '',
        advantages_array: editingProduct.advantages_array || [],
        disadvantages_array: editingProduct.disadvantages_array || [],
        tags: editingProduct.tags || [],
        variants: editingProduct.variants || [],
        stock: Number(editingProduct.stock) || 0,
        min_stock: Number(editingProduct.min_stock) || 2,
        supplier: editingProduct.supplier || 'BigBuy',
        available: editingProduct.available ?? true,
        is_active: editingProduct.is_active ?? true,
        available_europe: editingProduct.available_europe ?? true,
        available_usa: editingProduct.available_usa ?? false,
        cabin_compatible: editingProduct.cabin_compatible ?? false,
        essentiality: editingProduct.essentiality || 'Recommandé',
        score_kdv: Number(editingProduct.score_kdv) || 80,
        meta_title: editingProduct.meta_title || `${editingProduct.name} | Le Kit du Voyageur`,
        meta_description: editingProduct.meta_description || editingProduct.description_why?.slice(0, 160) || '',
        transaction_type: editingProduct.transaction_type || 'achat',
        image: editingProduct.image || (productImages.length > 0 ? productImages[0].url : ''),
        image_alt: editingProduct.name,
      };

      if (isCreatingNew) {
        const { data, error } = await supabase
          .from('shop_products')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        
        await logAdminAction('create', data.id, data.name, null, data);
        showToast(`Produit "${data.name}" créé avec succès !`);
        setEditingProduct(data);
        setIsCreatingNew(false);
      } else if (editingProduct.id) {
        const oldProd = products.find(p => p.id === editingProduct.id);
        const { data, error } = await supabase
          .from('shop_products')
          .update(payload)
          .eq('id', editingProduct.id)
          .select()
          .single();

        if (error) throw error;

        // Check if stock changed, record movement
        if (oldProd && oldProd.stock !== payload.stock) {
          const diff = (payload.stock || 0) - (oldProd.stock || 0);
          await supabase.from('stock_movements').insert({
            product_id: data.id,
            product_slug: data.slug,
            product_name: data.name,
            movement_type: 'ajustement',
            quantity_change: diff,
            quantity_before: oldProd.stock || 0,
            quantity_after: payload.stock || 0,
            notes: 'Ajustement manuel depuis la fiche produit',
          });
        }

        await logAdminAction('update', data.id, data.name, oldProd, data);
        showToast(`Produit "${data.name}" mis à jour avec succès !`);
        setEditingProduct(data);
      }

      await fetchProducts();
    } catch (err: any) {
      showToast(`Erreur d'enregistrement: ${err.message}`, 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  // ─── Delete Product (Soft or Hard) ──────────────────────────────────────────

  const handleDeleteProduct = (prodId: string, prodName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer ce produit ?',
      message: `Êtes-vous sûr de vouloir supprimer définitivement "${prodName}" du catalogue ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        try {
          // Delete product images relations
          await supabase.from('product_images').delete().eq('product_id', prodId);
          
          // Delete product row
          const { error } = await supabase.from('shop_products').delete().eq('id', prodId);
          if (error) throw error;

          await logAdminAction('delete', prodId, prodName);
          showToast(`Produit "${prodName}" supprimé.`);
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(prodId);
            return next;
          });
          if (editingProduct?.id === prodId) {
            setActiveTab('catalogue');
            setEditingProduct(null);
          }
          await fetchProducts();
        } catch (err: any) {
          showToast(`Erreur suppression: ${err.message}`, 'error');
        }
      },
    });
  };

  // ─── Duplicate Product ──────────────────────────────────────────────────────

  const handleDuplicateProduct = async (prod: ShopProduct) => {
    try {
      const copySuffix = Math.floor(Math.random() * 900 + 100);
      const newName = `${prod.name} (Copie ${copySuffix})`;
      const newSku = `${prod.product_id || 'SKU'}-CPY${copySuffix}`;
      const newSlug = `${slugify(newName)}-${copySuffix}`;

      const { id, created_at, updated_at, ...cleanData } = prod;
      const payload = {
        ...cleanData,
        name: newName,
        product_id: newSku,
        slug: newSlug,
        stock: 5,
        is_active: false, // Inactive by default for review
      };

      const { data, error } = await supabase
        .from('shop_products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await logAdminAction('duplicate', data.id, data.name, { original_id: prod.id }, data);
      showToast(`Produit dupliqué: "${newName}" (inactif par défaut)`);
      await fetchProducts();
    } catch (err: any) {
      showToast(`Erreur duplication: ${err.message}`, 'error');
    }
  };

  // ─── Toggle Active / Inactive ───────────────────────────────────────────────

  const handleToggleActive = async (prod: ShopProduct) => {
    const newStatus = !prod.is_active;
    try {
      const { error } = await supabase
        .from('shop_products')
        .update({ is_active: newStatus })
        .eq('id', prod.id);

      if (error) throw error;

      setProducts(prev => prev.map(p => (p.id === prod.id ? { ...p, is_active: newStatus } : p)));
      await logAdminAction('toggle_active', prod.id, prod.name, { is_active: prod.is_active }, { is_active: newStatus });
      showToast(`"${prod.name}" ${newStatus ? 'activé' : 'désactivé'}.`);
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  };

  // ─── Image Upload & Management ──────────────────────────────────────────────

  const handleUploadImage = async (file: File) => {
    if (!editingProduct?.id) {
      showToast("Veuillez d'abord enregistrer le produit avant d'ajouter des images.", 'info');
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = slugify(editingProduct.slug || 'product');
      const filename = `${cleanName}-${Date.now()}.${ext}`;
      const storagePath = `${cleanName}/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath);

      const isFirst = productImages.length === 0;
      const nextSortOrder = productImages.length;

      // Insert into product_images table
      const { data: insertedImg, error: dbError } = await supabase
        .from('product_images')
        .insert([
          {
            product_id: editingProduct.id,
            url: publicUrl,
            storage_path: storagePath,
            alt: `${editingProduct.name} - photo`,
            is_primary: isFirst,
            sort_order: nextSortOrder,
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      const newImageList = [...productImages, insertedImg];
      setProductImages(newImageList);

      // If this is the primary or first image, update main product image
      if (isFirst || !editingProduct.image) {
        await supabase
          .from('shop_products')
          .update({ image: publicUrl })
          .eq('id', editingProduct.id);
        setEditingProduct(prev => prev ? { ...prev, image: publicUrl } : null);
      }

      showToast('Image téléversée et associée avec succès !');
    } catch (err: any) {
      showToast(`Erreur upload image: ${err.message}`, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSetPrimaryImage = async (img: ProductImage) => {
    if (!editingProduct?.id) return;
    try {
      // Set all to false, then target to true
      await supabase.from('product_images').update({ is_primary: false }).eq('product_id', editingProduct.id);
      await supabase.from('product_images').update({ is_primary: true }).eq('id', img.id);
      await supabase.from('shop_products').update({ image: img.url }).eq('id', editingProduct.id);

      setProductImages(prev => prev.map(i => ({ ...i, is_primary: i.id === img.id })));
      setEditingProduct(prev => prev ? { ...prev, image: img.url } : null);
      showToast('Image principale définie.');
    } catch (err: any) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  };

  const handleDeleteImage = async (img: ProductImage) => {
    if (!editingProduct?.id) return;
    try {
      await supabase.from('product_images').delete().eq('id', img.id);

      // Also try to delete from storage if path exists
      if (img.storage_path) {
        await supabase.storage.from('product-images').remove([img.storage_path]);
      }

      const remaining = productImages.filter(i => i.id !== img.id);
      setProductImages(remaining);

      // If deleted was primary, make first remaining primary
      if (img.is_primary && remaining.length > 0) {
        await handleSetPrimaryImage(remaining[0]);
      } else if (remaining.length === 0) {
        await supabase.from('shop_products').update({ image: '' }).eq('id', editingProduct.id);
        setEditingProduct(prev => prev ? { ...prev, image: '' } : null);
      }

      showToast('Image supprimée.');
    } catch (err: any) {
      showToast(`Erreur suppression image: ${err.message}`, 'error');
    }
  };

  // ─── Quick Stock Adjustment ─────────────────────────────────────────────────

  const handleApplyStockAdjustment = async () => {
    if (!quickStockItem) return;
    const qtyChange = Number(stockAdjQuantity);
    if (isNaN(qtyChange) || qtyChange === 0) {
      showToast('Veuillez spécifier une quantité valide', 'info');
      return;
    }

    const currentStock = quickStockItem.stock || 0;
    const newStock = Math.max(0, currentStock + qtyChange);

    try {
      const { error: prodErr } = await supabase
        .from('shop_products')
        .update({ stock: newStock })
        .eq('id', quickStockItem.id);

      if (prodErr) throw prodErr;

      // Insert stock movement record
      await supabase.from('stock_movements').insert({
        product_id: quickStockItem.id,
        product_slug: quickStockItem.slug,
        product_name: quickStockItem.name,
        movement_type: stockAdjType,
        quantity_change: qtyChange,
        quantity_before: currentStock,
        quantity_after: newStock,
        notes: stockAdjNotes || `Ajustement rapide ${stockAdjType}`,
      });

      await logAdminAction('stock_adjustment', quickStockItem.id, quickStockItem.name, { stock: currentStock }, { stock: newStock, type: stockAdjType });

      showToast(`Stock de "${quickStockItem.name}" mis à jour : ${currentStock} → ${newStock}`);
      setQuickStockItem(null);
      setStockAdjQuantity(0);
      setStockAdjNotes('');
      await fetchProducts();
      await fetchGlobalStockMovements();
    } catch (err: any) {
      showToast(`Erreur ajustement stock: ${err.message}`, 'error');
    }
  };

  // ─── Bulk Actions Execution ─────────────────────────────────────────────────

  const handleExecuteBulkAction = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    try {
      if (bulkActionType === 'activate') {
        await supabase.from('shop_products').update({ is_active: true }).in('id', ids);
        showToast(`${ids.length} produit(s) activé(s)`);
      } else if (bulkActionType === 'deactivate') {
        await supabase.from('shop_products').update({ is_active: false }).in('id', ids);
        showToast(`${ids.length} produit(s) désactivé(s)`);
      } else if (bulkActionType === 'category' && bulkCategoryVal) {
        await supabase.from('shop_products').update({ category: bulkCategoryVal, category_main: bulkCategoryVal }).in('id', ids);
        showToast(`Catégorie mise à jour pour ${ids.length} produit(s)`);
      } else if (bulkActionType === 'stock') {
        await supabase.from('shop_products').update({ stock: Number(bulkStockVal) }).in('id', ids);
        showToast(`Stock défini à ${bulkStockVal} pour ${ids.length} produit(s)`);
      } else if (bulkActionType === 'price') {
        // Fetch selected items to compute their new prices
        const selectedItems = products.filter(p => selectedIds.has(p.id));
        for (const item of selectedItems) {
          let newPrice = item.price_eur;
          if (bulkPriceChange.type === 'percent') {
            newPrice = Math.round(item.price_eur * (1 + bulkPriceChange.value / 100) * 100) / 100;
          } else {
            newPrice = Math.max(0, item.price_eur + bulkPriceChange.value);
          }
          await supabase.from('shop_products').update({ price_eur: newPrice }).eq('id', item.id);
        }
        showToast(`Prix ajustés pour ${ids.length} produit(s)`);
      } else if (bulkActionType === 'delete') {
        setConfirmModal({
          isOpen: true,
          title: `Supprimer ${ids.length} produits ?`,
          message: `Attention : cette action supprimera définitivement ${ids.length} produits du catalogue ainsi que leurs photos associées.`,
          danger: true,
          onConfirm: async () => {
            await supabase.from('product_images').delete().in('product_id', ids);
            await supabase.from('shop_products').delete().in('id', ids);
            showToast(`${ids.length} produit(s) supprimé(s) définitivement`);
            setSelectedIds(new Set());
            await fetchProducts();
          },
        });
        setIsBulkModalOpen(false);
        return;
      }

      setIsBulkModalOpen(false);
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (err: any) {
      showToast(`Erreur action groupée: ${err.message}`, 'error');
    }
  };

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCSV = (exportSelectedOnly = false) => {
    const dataToExport = exportSelectedOnly && selectedIds.size > 0
      ? products.filter(p => selectedIds.has(p.id))
      : sortedProducts;

    if (dataToExport.length === 0) {
      showToast('Aucun produit à exporter', 'info');
      return;
    }

    const headers = [
      'product_id',
      'name',
      'brand',
      'model',
      'category_main',
      'category_sub',
      'price_eur',
      'cost_price_eur',
      'vat_rate',
      'stock',
      'min_stock',
      'weight_g',
      'dimensions',
      'essentiality',
      'supplier',
      'ean',
      'slug',
      'is_active',
      'image',
      'description_why',
    ];

    const csvRows = [
      headers.join(';'),
      ...dataToExport.map(p =>
        [
          `"${p.product_id || ''}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.brand || '').replace(/"/g, '""')}"`,
          `"${(p.model || '').replace(/"/g, '""')}"`,
          `"${p.category_main || p.category || ''}"`,
          `"${p.category_sub || ''}"`,
          p.price_eur || 0,
          p.cost_price_eur || 0,
          p.vat_rate || 20,
          p.stock || 0,
          p.min_stock || 2,
          p.weight_g || p.weight_grams || 0,
          `"${p.dimensions || ''}"`,
          `"${p.essentiality || ''}"`,
          `"${p.supplier || ''}"`,
          `"${p.ean || ''}"`,
          `"${p.slug || ''}"`,
          p.is_active ? 'true' : 'false',
          `"${p.image || ''}"`,
          `"${(p.description_why || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        ].join(';')
      ),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogue_kdv_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Export CSV généré (${dataToExport.length} produits)`);
  };

  return (
    <div className="min-h-screen bg-[#0E1713] text-[#F5F3EE] font-sans">
      {/* ─── Notification Toast ──────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : notification.type === 'error'
              ? 'bg-red-950/90 text-red-200 border-red-500/30'
              : 'bg-sky-950/90 text-sky-200 border-sky-500/30'
          }`}
        >
          <Icon
            name={notification.type === 'success' ? 'CheckCircleIcon' : notification.type === 'error' ? 'XCircleIcon' : 'InformationCircleIcon'}
            size={18}
          />
          <span className="text-sm font-medium">{notification.text}</span>
        </div>
      )}

      {/* ─── Top Header & Tabs ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#131F1A]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs font-mono"
          >
            <Icon name="ArrowLeftIcon" size={14} />
            <span>Dashboard</span>
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
            Gestion Catalogue
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#17402C] text-[#8BAF7C] border border-[#8BAF7C]/30">
              {kpis.total} items
            </span>
          </h1>
        </div>

        {/* Tab Switcher */}
        <nav className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5 overflow-x-auto">
          {[
            { id: 'catalogue', label: 'Catalogue', icon: 'Squares2X2Icon' },
            { id: 'stock', label: 'Stocks & Mouvements', icon: 'ArchiveBoxIcon' },
            { id: 'categories', label: 'Catégories', icon: 'FolderIcon' },
            { id: 'import_export', label: 'Import / Export', icon: 'ArrowDownTrayIcon' },
            { id: 'audit', label: 'Journal Audit', icon: 'DocumentTextIcon' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as AdminTab);
                if (tab.id === 'catalogue') setEditingProduct(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#17402C] text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon name={tab.icon} size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchProducts()}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all disabled:opacity-50"
            title="Rafraîchir les données"
          >
            <Icon name="ArrowPathIcon" size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => openProductEditor()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2D6B4A] hover:bg-[#205238] text-white text-xs font-bold shadow-lg transition-all active:scale-95"
          >
            <Icon name="PlusIcon" size={16} />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content Container ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* ── KPI Row ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">Total Produits</span>
            <span className="text-2xl font-bold font-display text-white mt-1">{kpis.total}</span>
          </div>
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-emerald-400/80 uppercase tracking-wider">Actifs en Boutique</span>
            <span className="text-2xl font-bold font-display text-emerald-400 mt-1">{kpis.active}</span>
          </div>
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-amber-400/80 uppercase tracking-wider">Stock Faible</span>
            <span className="text-2xl font-bold font-display text-amber-400 mt-1">{kpis.lowStock}</span>
          </div>
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-red-400/80 uppercase tracking-wider">Ruptures Stock</span>
            <span className="text-2xl font-bold font-display text-red-400 mt-1">{kpis.outOfStock}</span>
          </div>
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">Unités en Stock</span>
            <span className="text-2xl font-bold font-display text-white mt-1">{kpis.totalUnits}</span>
          </div>
          <div className="bg-[#15231D] border border-white/10 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-[#8BAF7C] uppercase tracking-wider">Valeur Marchande</span>
            <span className="text-xl font-bold font-mono text-[#8BAF7C] mt-1">{Math.round(kpis.totalValuation).toLocaleString()} €</span>
          </div>
        </section>

        {/* ─── TAB 1: CATALOGUE LIST ─────────────────────────────────────────── */}
        {activeTab === 'catalogue' && (
          <section className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-[#15231D] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Rechercher produit, marque, SKU..."
                    className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#2D6B4A]"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#2D6B4A]"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* Brand Filter */}
                <select
                  value={filterBrand}
                  onChange={e => { setFilterBrand(e.target.value); setPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#2D6B4A]"
                >
                  <option value="">Toutes les marques</option>
                  {brands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#2D6B4A]"
                >
                  <option value="active">Actifs uniquement</option>
                  <option value="inactive">Inactifs uniquement</option>
                  <option value="all">Tous les statuts</option>
                </select>

                {/* Stock Status Filter */}
                <select
                  value={filterStockStatus}
                  onChange={e => { setFilterStockStatus(e.target.value as any); setPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#2D6B4A]"
                >
                  <option value="all">Tous les niveaux de stock</option>
                  <option value="in_stock">En stock suffisant</option>
                  <option value="low_stock">Stock faible (≤ min)</option>
                  <option value="out_of_stock">Rupture totale</option>
                </select>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-600/30 transition-all"
                  >
                    <Icon name="SparklesIcon" size={14} />
                    <span>Actions groupées ({selectedIds.size})</span>
                  </button>
                )}
                <button
                  onClick={() => handleExportCSV(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
                >
                  <Icon name="ArrowDownTrayIcon" size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-[#15231D] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/30 border-b border-white/10 text-[11px] font-mono text-white/50 uppercase tracking-wider">
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id))}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(paginatedProducts.map(p => p.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="rounded border-white/30 bg-transparent text-[#2D6B4A] focus:ring-0"
                        />
                      </th>
                      <th className="p-3.5 w-14">Image</th>
                      <th
                        onClick={() => {
                          if (sortBy === 'name') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('name'); setSortOrder('asc'); }
                        }}
                        className="p-3.5 cursor-pointer hover:text-white"
                      >
                        Produit & Marque {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => {
                          if (sortBy === 'category_main') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('category_main'); setSortOrder('asc'); }
                        }}
                        className="p-3.5 cursor-pointer hover:text-white"
                      >
                        Catégorie {sortBy === 'category_main' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => {
                          if (sortBy === 'price_eur') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('price_eur'); setSortOrder('desc'); }
                        }}
                        className="p-3.5 cursor-pointer hover:text-white"
                      >
                        Prix TTC {sortBy === 'price_eur' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => {
                          if (sortBy === 'stock') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setSortBy('stock'); setSortOrder('asc'); }
                        }}
                        className="p-3.5 cursor-pointer hover:text-white"
                      >
                        Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="p-3.5">Essentialité</th>
                      <th className="p-3.5">Statut</th>
                      <th className="p-3.5 text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-white/40">
                          <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto mb-2 text-[#2D6B4A]" />
                          Chargement des produits en cours...
                        </td>
                      </tr>
                    ) : paginatedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-white/40">
                          Aucun produit trouvé avec ces critères de recherche.
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map(prod => {
                        const isSelected = selectedIds.has(prod.id);
                        const minStock = prod.min_stock ?? 2;
                        const stockStatus = prod.stock <= 0 ? 'out' : prod.stock <= minStock ? 'low' : 'ok';

                        return (
                          <tr
                            key={prod.id}
                            className={`hover:bg-white/[0.03] transition-colors ${
                              isSelected ? 'bg-[#2D6B4A]/10' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(prod.id);
                                    else next.delete(prod.id);
                                    return next;
                                  });
                                }}
                                className="rounded border-white/30 bg-transparent text-[#2D6B4A] focus:ring-0"
                              />
                            </td>

                            {/* Image Thumbnail */}
                            <td className="p-3.5">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                                {prod.image ? (
                                  <img
                                    src={prod.image}
                                    alt={prod.name}
                                    className="w-full h-full object-cover"
                                    onError={e => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Icon name="PhotoIcon" size={16} className="text-white/20" />
                                )}
                              </div>
                            </td>

                            {/* Name & SKU */}
                            <td className="p-3.5 max-w-[240px]">
                              <button
                                onClick={() => openProductEditor(prod)}
                                className="text-left font-bold text-white hover:text-[#8BAF7C] transition-colors truncate block max-w-full"
                              >
                                {prod.name}
                              </button>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-white/40">
                                <span>{prod.brand || 'Sans marque'}</span>
                                <span>•</span>
                                <span>SKU: {prod.product_id || 'N/A'}</span>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="p-3.5 text-white/70">
                              <span className="block font-medium">{prod.category_main || prod.category}</span>
                              {prod.category_sub && (
                                <span className="text-[10px] text-white/40">{prod.category_sub}</span>
                              )}
                            </td>

                            {/* Price */}
                            <td className="p-3.5 font-mono font-bold text-white">
                              {prod.price_eur ? `${Number(prod.price_eur).toFixed(2)} €` : '0.00 €'}
                              {prod.cost_price_eur ? (
                                <span className="block text-[10px] font-normal text-white/40">
                                  Achat: {Number(prod.cost_price_eur).toFixed(2)} €
                                </span>
                              ) : null}
                            </td>

                            {/* Stock Badge */}
                            <td className="p-3.5 font-mono">
                              <button
                                onClick={() => {
                                  setQuickStockItem(prod);
                                  setStockAdjQuantity(0);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:scale-105 ${
                                  stockStatus === 'out'
                                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                    : stockStatus === 'low'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                }`}
                                title="Cliquer pour ajuster le stock"
                              >
                                <span>{prod.stock || 0}</span>
                                <span className="text-[9px] font-sans font-normal opacity-70">
                                  {stockStatus === 'out' ? 'Rupture' : stockStatus === 'low' ? 'Faible' : 'En stock'}
                                </span>
                              </button>
                            </td>

                            {/* Essentiality */}
                            <td className="p-3.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/70 border border-white/10">
                                {prod.essentiality || 'Recommandé'}
                              </span>
                            </td>

                            {/* Active Switch */}
                            <td className="p-3.5">
                              <button
                                onClick={() => handleToggleActive(prod)}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                                  prod.is_active
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                    : 'bg-white/10 text-white/40 hover:bg-white/20'
                                }`}
                              >
                                {prod.is_active ? 'Actif' : 'Inactif'}
                              </button>
                            </td>

                            {/* Row Actions */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/produit/${prod.slug}`}
                                  target="_blank"
                                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                  title="Voir sur la boutique"
                                >
                                  <Icon name="EyeIcon" size={14} />
                                </Link>
                                <button
                                  onClick={() => handleDuplicateProduct(prod)}
                                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                  title="Dupliquer"
                                >
                                  <Icon name="DocumentDuplicateIcon" size={14} />
                                </button>
                                <button
                                  onClick={() => openProductEditor(prod)}
                                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                  title="Modifier"
                                >
                                  <Icon name="PencilSquareIcon" size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Supprimer"
                                >
                                  <Icon name="TrashIcon" size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div className="bg-black/30 border-t border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <span>Afficher</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>sur {sortedProducts.length} produits</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Précédent
                  </button>
                  <span className="font-mono text-white">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── TAB 2: 9-TAB PRODUCT EDITOR ───────────────────────────────────── */}
        {activeTab === 'editor' && editingProduct && (
          <section className="bg-[#15231D] border border-white/10 rounded-[0.75rem] p-6 lg:p-8 space-y-6 shadow-2xl">
            {/* Header / Save Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <button
                  onClick={() => { setActiveTab('catalogue'); setEditingProduct(null); }}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white font-mono mb-1 transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={12} />
                  <span>Retour au catalogue</span>
                </button>
                <h2 className="text-xl font-bold font-display text-white">
                  {isCreatingNew ? 'Nouveau Produit' : `Modifier : ${editingProduct.name}`}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={editingProduct.slug ? `/produit/${editingProduct.slug}` : '#'}
                  target="_blank"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/70 hover:text-white transition-all ${
                    isCreatingNew ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <Icon name="EyeIcon" size={14} />
                  <span>Aperçu Boutique</span>
                </Link>
                <button
                  onClick={handleSaveProduct}
                  disabled={savingProduct}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2D6B4A] hover:bg-[#205238] text-white text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <Icon name="CheckIcon" size={16} className={savingProduct ? 'animate-spin' : ''} />
                  <span>{savingProduct ? 'Enregistrement...' : 'Enregistrer le Produit'}</span>
                </button>
              </div>
            </div>

            {/* Editor Subtabs Navigation */}
            <nav className="flex items-center gap-1.5 border-b border-white/10 pb-3 overflow-x-auto">
              {[
                { id: 'info', label: '1. Informations', icon: 'DocumentTextIcon' },
                { id: 'images', label: '2. Images & Galerie', icon: 'PhotoIcon', count: productImages.length },
                { id: 'pricing', label: '3. Prix & Marges', icon: 'CurrencyEuroIcon' },
                { id: 'stock', label: '4. Stock & Alertes', icon: 'ArchiveBoxIcon' },
                { id: 'variants', label: '5. Variantes', icon: 'SparklesIcon', count: editingProduct.variants?.length || 0 },
                { id: 'categories', label: '6. Catégories', icon: 'FolderIcon' },
                { id: 'seo', label: '7. SEO & URL', icon: 'GlobeAltIcon' },
                { id: 'supplier', label: '8. Fournisseur', icon: 'TruckIcon' },
                { id: 'history', label: '9. Historique', icon: 'ClockIcon' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEditorSubTab(tab.id as EditorSubTab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    editorSubTab === tab.id
                      ? 'bg-[#2D6B4A] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-[#8BAF7C]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* ── SubTab 1: General Info ── */}
            {editorSubTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Nom du produit *
                    </label>
                    <input
                      type="text"
                      value={editingProduct.name || ''}
                      onChange={e => {
                        const name = e.target.value;
                        setEditingProduct(prev => ({
                          ...prev,
                          name,
                          slug: isCreatingNew ? slugify(name) : prev?.slug,
                        }));
                      }}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                      placeholder="ex: Lampe Frontale Spot 400..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Marque
                      </label>
                      <input
                        type="text"
                        value={editingProduct.brand || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, brand: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: Black Diamond"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Modèle / Réf Interne
                      </label>
                      <input
                        type="text"
                        value={editingProduct.model || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, model: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: Spot 400 USB"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        SKU / Identifiant Unique
                      </label>
                      <input
                        type="text"
                        value={editingProduct.product_id || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, product_id: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: 1051281"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Code EAN / Code-barres
                      </label>
                      <input
                        type="text"
                        value={editingProduct.ean || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, ean: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: 8432456789012"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Description détaillée & justification
                    </label>
                    <textarea
                      rows={5}
                      value={editingProduct.description_why || ''}
                      onChange={e => setEditingProduct(p => ({ ...p, description_why: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                      placeholder="Expliquez pourquoi cet équipement est sélectionné pour l'aventure..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Poids (en grammes)
                      </label>
                      <input
                        type="number"
                        value={editingProduct.weight_g || 0}
                        onChange={e => setEditingProduct(p => ({ ...p, weight_g: Number(e.target.value), weight_grams: Number(e.target.value) }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#2D6B4A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Dimensions
                      </label>
                      <input
                        type="text"
                        value={editingProduct.dimensions || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, dimensions: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: 20 x 15 x 8 cm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Matériaux
                      </label>
                      <input
                        type="text"
                        value={editingProduct.materials || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, materials: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: Aluminium anodisé, Cordura..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Garantie
                      </label>
                      <input
                        type="text"
                        value={editingProduct.warranty || ''}
                        onChange={e => setEditingProduct(p => ({ ...p, warranty: e.target.value }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                        placeholder="ex: 2 ans fabricant"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Type de transaction
                    </label>
                    <select
                      value={editingProduct.transaction_type || 'achat'}
                      onChange={e => setEditingProduct(p => ({ ...p, transaction_type: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                    >
                      {TRANSACTION_TYPES.map(t => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle Options */}
                  <div className="pt-3 border-t border-white/10 space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.is_active ?? true}
                        onChange={e => setEditingProduct(p => ({ ...p, is_active: e.target.checked }))}
                        className="rounded border-white/30 bg-transparent text-[#2D6B4A] focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-white">Produit actif et visible en boutique</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.cabin_compatible ?? false}
                        onChange={e => setEditingProduct(p => ({ ...p, cabin_compatible: e.target.checked }))}
                        className="rounded border-white/30 bg-transparent text-[#2D6B4A] focus:ring-0 w-4 h-4"
                      />
                      <span className="text-xs text-white/80">Format compatible bagage cabine avion</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── SubTab 2: Images & Gallery ── */}
            {editorSubTab === 'images' && (
              <div className="space-y-6 animate-fade-in">
                {/* Upload Box */}
                <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-[#2D6B4A] transition-colors bg-black/20">
                  <input
                    type="file"
                    accept="image/*"
                    id="product-image-upload"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file);
                    }}
                  />
                  <label htmlFor="product-image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#2D6B4A]/20 text-[#8BAF7C] flex items-center justify-center">
                      <Icon name="CloudArrowUpIcon" size={24} className={uploadingImage ? 'animate-spin' : ''} />
                    </div>
                    <span className="text-sm font-bold text-white">
                      {uploadingImage ? 'Téléversement vers Supabase Storage...' : 'Ajouter une image'}
                    </span>
                    <span className="text-xs text-white/40">
                      JPG, PNG, WEBP acceptés — Stocké directement sur Supabase Storage (bucket product-images)
                    </span>
                  </label>
                </div>

                {/* Images Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider">
                    Galerie photos ({productImages.length})
                  </h3>
                  {productImages.length === 0 ? (
                    <p className="text-sm text-white/40 italic">Aucune image associée à ce produit pour le moment.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {productImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className={`relative group rounded-2xl overflow-hidden border bg-black/40 aspect-square ${
                            img.is_primary ? 'border-[#2D6B4A] ring-2 ring-[#2D6B4A]/50' : 'border-white/10'
                          }`}
                        >
                          <img src={img.url} alt={img.alt || 'Photo produit'} className="w-full h-full object-cover" />

                          {img.is_primary && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#2D6B4A] text-white text-[10px] font-bold shadow-md">
                              Principale
                            </span>
                          )}

                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                            {!img.is_primary && (
                              <button
                                onClick={() => handleSetPrimaryImage(img)}
                                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/40 text-white text-[11px] font-semibold transition-all"
                              >
                                Définir principale
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteImage(img)}
                              className="px-2.5 py-1 rounded-lg bg-red-500/40 hover:bg-red-500/70 text-white text-[11px] font-semibold transition-all"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SubTab 3: Pricing & Margins ── */}
            {editorSubTab === 'pricing' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Prix de vente conseillé (€ TTC) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.price_eur || 0}
                      onChange={e => setEditingProduct(p => ({ ...p, price_eur: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-[#2D6B4A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Prix d&apos;achat fournisseur (€ HT)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingProduct.cost_price_eur || 0}
                        onChange={e => setEditingProduct(p => ({ ...p, cost_price_eur: Number(e.target.value) }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Taux de TVA (%)
                      </label>
                      <input
                        type="number"
                        value={editingProduct.vat_rate || 20}
                        onChange={e => setEditingProduct(p => ({ ...p, vat_rate: Number(e.target.value) }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Prix d&apos;origine / barré (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingProduct.original_price || 0}
                        onChange={e => setEditingProduct(p => ({ ...p, original_price: Number(e.target.value) }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                        Économie affichée (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingProduct.savings || 0}
                        onChange={e => setEditingProduct(p => ({ ...p, savings: Number(e.target.value) }))}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Margin Calculation Card */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <h3 className="text-xs font-mono text-[#8BAF7C] uppercase tracking-wider font-bold">
                    Analyse Rentabilité & Marge
                  </h3>

                  {(() => {
                    const priceTTC = Number(editingProduct.price_eur) || 0;
                    const costHT = Number(editingProduct.cost_price_eur) || 0;
                    const vat = (Number(editingProduct.vat_rate) || 20) / 100;
                    const priceHT = priceTTC / (1 + vat);
                    const marginAmount = priceHT - costHT;
                    const marginPercent = priceHT > 0 ? (marginAmount / priceHT) * 100 : 0;
                    const coeff = costHT > 0 ? priceTTC / costHT : 0;

                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                          <span className="text-[11px] text-white/40 block">Marge brute unitaire</span>
                          <span className="text-xl font-bold font-mono text-white mt-1 block">
                            {marginAmount.toFixed(2)} € HT
                          </span>
                        </div>
                        <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                          <span className="text-[11px] text-white/40 block">Taux de marge brute</span>
                          <span className={`text-xl font-bold font-mono mt-1 block ${marginPercent >= 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {marginPercent.toFixed(1)} %
                          </span>
                        </div>
                        <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                          <span className="text-[11px] text-white/40 block">Prix de vente net HT</span>
                          <span className="text-lg font-mono text-white/80 mt-1 block">
                            {priceHT.toFixed(2)} € HT
                          </span>
                        </div>
                        <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                          <span className="text-[11px] text-white/40 block">Coefficient multiplicateur</span>
                          <span className="text-lg font-mono text-white/80 mt-1 block">
                            x {coeff.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── SubTab 4: Stock & Inventory ── */}
            {editorSubTab === 'stock' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Quantité en stock actuel
                    </label>
                    <input
                      type="number"
                      value={editingProduct.stock || 0}
                      onChange={e => setEditingProduct(p => ({ ...p, stock: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-[#2D6B4A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Seuil d&apos;alerte stock minimum
                    </label>
                    <input
                      type="number"
                      value={editingProduct.min_stock || 2}
                      onChange={e => setEditingProduct(p => ({ ...p, min_stock: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                    />
                    <span className="text-[11px] text-white/40 mt-1 block">
                      Déclenche le badge d&apos;alerte &quot;Stock faible&quot; lorsque le stock passe en dessous de ce seuil.
                    </span>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider font-bold">
                    Statut automatique calculé
                  </h3>
                  {(() => {
                    const st = editingProduct.stock || 0;
                    const min = editingProduct.min_stock ?? 2;
                    const isOut = st <= 0;
                    const isLow = st > 0 && st <= min;

                    return (
                      <div
                        className={`p-4 rounded-xl border flex items-center gap-3 ${
                          isOut
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : isLow
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <Icon
                          name={isOut ? 'ExclamationCircleIcon' : isLow ? 'ExclamationTriangleIcon' : 'CheckCircleIcon'}
                          size={24}
                        />
                        <div>
                          <p className="font-bold text-sm">
                            {isOut ? 'Rupture de Stock' : isLow ? 'Stock Faible (Alerte)' : 'En Stock (Normal)'}
                          </p>
                          <p className="text-xs opacity-70 mt-0.5">
                            {isOut
                              ? 'Ce produit est épuisé et ne peut plus être commandé.'
                              : isLow
                              ? `Quantité restante (${st}) inférieure ou égale au seuil (${min}). Réassort conseillé.`
                              : `Quantité disponible (${st} unités).`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── SubTab 5: Variants ── */}
            {editorSubTab === 'variants' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">
                    Définissez les variantes de ce produit (Tailles, Couleurs, Modèles spécifiques).
                  </p>
                  <button
                    onClick={() => {
                      const newVar: ProductVariant = {
                        id: `var-${Date.now()}`,
                        size: 'M',
                        color: 'Noir',
                        sku: `${editingProduct.product_id || 'SKU'}-M`,
                        price: editingProduct.price_eur || 0,
                        stock: 5,
                      };
                      setEditingProduct(p => ({
                        ...p,
                        variants: [...(p?.variants || []), newVar],
                      }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                  >
                    <Icon name="PlusIcon" size={14} />
                    <span>Ajouter une variante</span>
                  </button>
                </div>

                {(!editingProduct.variants || editingProduct.variants.length === 0) ? (
                  <p className="text-sm text-white/40 italic p-6 text-center border border-white/5 rounded-2xl bg-black/20">
                    Aucune variante pour ce produit (produit unique standard).
                  </p>
                ) : (
                  <div className="space-y-3">
                    {editingProduct.variants.map((variant, vIdx) => (
                      <div
                        key={variant.id || vIdx}
                        className="bg-black/30 border border-white/10 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-center"
                      >
                        <div>
                          <label className="text-[10px] font-mono text-white/40 uppercase block mb-1">Taille</label>
                          <input
                            type="text"
                            value={variant.size || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.map((v, i) => i === vIdx ? { ...v, size: val } : v),
                              }));
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-white/40 uppercase block mb-1">Couleur</label>
                          <input
                            type="text"
                            value={variant.color || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.map((v, i) => i === vIdx ? { ...v, color: val } : v),
                              }));
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-white/40 uppercase block mb-1">SKU Variante</label>
                          <input
                            type="text"
                            value={variant.sku || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.map((v, i) => i === vIdx ? { ...v, sku: val } : v),
                              }));
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-white/40 uppercase block mb-1">Prix (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.price || 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.map((v, i) => i === vIdx ? { ...v, price: val } : v),
                              }));
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-white/40 uppercase block mb-1">Stock</label>
                          <input
                            type="number"
                            value={variant.stock || 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.map((v, i) => i === vIdx ? { ...v, stock: val } : v),
                              }));
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>

                        <div className="text-right">
                          <button
                            onClick={() => {
                              setEditingProduct(p => ({
                                ...p,
                                variants: p?.variants?.filter((_, i) => i !== vIdx),
                              }));
                            }}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Supprimer la variante"
                          >
                            <Icon name="TrashIcon" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SubTab 6: Categories ── */}
            {editorSubTab === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Catégorie Principale
                    </label>
                    <select
                      value={editingProduct.category_main || editingProduct.category || ''}
                      onChange={e => {
                        const cat = e.target.value;
                        setEditingProduct(p => ({ ...p, category: cat, category_main: cat }));
                      }}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Sous-catégorie
                    </label>
                    <input
                      type="text"
                      value={editingProduct.category_sub || ''}
                      onChange={e => setEditingProduct(p => ({ ...p, category_sub: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                      placeholder="ex: Lampes frontales, Tentes 2 places..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Niveau d&apos;essentialité
                    </label>
                    <select
                      value={editingProduct.essentiality || 'Recommandé'}
                      onChange={e => setEditingProduct(p => ({ ...p, essentiality: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                    >
                      {ESSENTIALITY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-6 space-y-3">
                  <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider font-bold">
                    Ajouter une nouvelle catégorie
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      placeholder="Nom de la nouvelle catégorie..."
                      className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={() => {
                        if (newCatName.trim()) {
                          setEditingProduct(p => ({ ...p, category: newCatName.trim(), category_main: newCatName.trim() }));
                          setNewCatName('');
                          showToast('Catégorie sélectionnée pour ce produit');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[#2D6B4A] text-white text-xs font-bold hover:bg-[#205238]"
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SubTab 7: SEO & Meta ── */}
            {editorSubTab === 'seo' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Slug URL personnalisée
                    </label>
                    <input
                      type="text"
                      value={editingProduct.slug || ''}
                      onChange={e => setEditingProduct(p => ({ ...p, slug: slugify(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#2D6B4A]"
                    />
                    <span className="text-[11px] font-mono text-white/40 mt-1 block">
                      URL: /produit/{editingProduct.slug || 'slug-produit'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Meta Title SEO
                    </label>
                    <input
                      type="text"
                      value={editingProduct.meta_title || ''}
                      onChange={e => setEditingProduct(p => ({ ...p, meta_title: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                      placeholder="ex: Lampe Frontale Spot 400 | Le Kit du Voyageur"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Meta Description SEO (150-160 caractères)
                    </label>
                    <textarea
                      rows={3}
                      value={editingProduct.meta_description || ''}
                      onChange={e => setEditingProduct(p => ({ ...p, meta_description: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                      placeholder="Description concise pour les moteurs de recherche Google..."
                    />
                    <span className="text-[10px] font-mono text-white/40 block text-right">
                      {(editingProduct.meta_description || '').length} / 160 caractères
                    </span>
                  </div>
                </div>

                {/* Google SERP Live Preview */}
                <div className="bg-white p-5 rounded-2xl text-slate-800 shadow-xl space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Aperçu dans les résultats Google (SERP)
                  </span>
                  <div className="text-xs text-[#202124] truncate">
                    https://lekitduvoyageur.fr › produit › {editingProduct.slug || 'produit'}
                  </div>
                  <h4 className="text-base text-[#1a0dab] font-medium hover:underline cursor-pointer truncate">
                    {editingProduct.meta_title || `${editingProduct.name || 'Produit Outdoor'} | Le Kit du Voyageur`}
                  </h4>
                  <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                    {editingProduct.meta_description || editingProduct.description_why || 'Découvrez notre sélection de matériel outdoor de précision pour la randonnée et le voyage.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── SubTab 8: Supplier & Sourcing ── */}
            {editorSubTab === 'supplier' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-white/60 uppercase tracking-wider mb-1.5">
                      Nom du fournisseur
                    </label>
                    <input
                      type="text"
                      value={editingProduct.supplier || 'BigBuy'}
                      onChange={e => setEditingProduct(p => ({ ...p, supplier: e.target.value }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2D6B4A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.available_europe ?? true}
                        onChange={e => setEditingProduct(p => ({ ...p, available_europe: e.target.checked }))}
                        className="rounded text-[#2D6B4A]"
                      />
                      <span className="text-xs text-white">Livraison Europe</span>
                    </label>
                    <label className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingProduct.available_usa ?? false}
                        onChange={e => setEditingProduct(p => ({ ...p, available_usa: e.target.checked }))}
                        className="rounded text-[#2D6B4A]"
                      />
                      <span className="text-xs text-white">Livraison USA</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── SubTab 9: History & Audit for this Product ── */}
            {editorSubTab === 'history' && (
              <div className="space-y-6 animate-fade-in">
                {/* Stock Movements */}
                <div>
                  <h3 className="text-xs font-mono text-[#8BAF7C] uppercase tracking-wider font-bold mb-3">
                    Historique des mouvements de stock
                  </h3>
                  {productMovements.length === 0 ? (
                    <p className="text-sm text-white/40 italic">Aucun mouvement de stock enregistré.</p>
                  ) : (
                    <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-black/40 text-[10px] font-mono text-white/40 uppercase">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Variation</th>
                            <th className="p-3">Avant → Après</th>
                            <th className="p-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {productMovements.map(m => (
                            <tr key={m.id}>
                              <td className="p-3 text-white/60">{new Date(m.created_at).toLocaleString()}</td>
                              <td className="p-3 uppercase text-white/80">{m.movement_type}</td>
                              <td className={`p-3 font-bold ${m.quantity_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                              </td>
                              <td className="p-3 text-white/70">{m.quantity_before} → {m.quantity_after}</td>
                              <td className="p-3 font-sans text-white/50">{m.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Audit Logs */}
                <div>
                  <h3 className="text-xs font-mono text-white/60 uppercase tracking-wider font-bold mb-3">
                    Modifications effectuées par les admins
                  </h3>
                  {productAuditLogs.length === 0 ? (
                    <p className="text-sm text-white/40 italic">Aucune modification archivée.</p>
                  ) : (
                    <div className="space-y-2">
                      {productAuditLogs.map(log => (
                        <div key={log.id} className="bg-black/30 border border-white/10 rounded-xl p-3 text-xs flex items-center justify-between gap-4">
                          <div>
                            <span className="font-mono text-[11px] font-bold text-amber-400 uppercase mr-2">{log.action}</span>
                            <span className="text-white/60">par {log.admin_email}</span>
                          </div>
                          <span className="text-[10px] font-mono text-white/40">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── TAB 3: STOCK MANAGEMENT & MOVEMENTS ────────────────────────────── */}
        {activeTab === 'stock' && (
          <section className="space-y-6">
            <div className="bg-[#15231D] border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-bold font-display text-white mb-1">Mouvements de Stock Réents</h2>
              <p className="text-xs text-white/50 mb-4">
                Historique complet des réassorts, ventes, retours et ajustements d&apos;inventaire.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-black/30 border-b border-white/10 text-[10px] font-mono text-white/50 uppercase">
                      <th className="p-3">Date</th>
                      <th className="p-3">Produit</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Variation</th>
                      <th className="p-3">Stock Final</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {globalMovements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-white/30 font-sans">
                          Aucun mouvement de stock récent.
                        </td>
                      </tr>
                    ) : (
                      globalMovements.map(m => (
                        <tr key={m.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-white/50">{new Date(m.created_at).toLocaleString()}</td>
                          <td className="p-3 font-sans font-bold text-white max-w-[200px] truncate">{m.product_name}</td>
                          <td className="p-3 uppercase text-white/70">{m.movement_type}</td>
                          <td className={`p-3 font-bold ${m.quantity_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                          </td>
                          <td className="p-3 text-white font-bold">{m.quantity_after}</td>
                          <td className="p-3 font-sans text-white/50">{m.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ─── TAB 4: CATEGORIES MANAGEMENT ───────────────────────────────────── */}
        {activeTab === 'categories' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryStats).map(([catName, data]) => (
                <div key={catName} className="bg-[#15231D] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm truncate">{catName}</h3>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#17402C] text-[#8BAF7C]">
                      {data.total} produits
                    </span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>Produits actifs : <span className="font-bold text-emerald-400">{data.active}</span></p>
                    <p>Sous-catégories : <span className="text-white/80">{Array.from(data.subcategories).join(', ') || 'Aucune'}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      setFilterCategory(catName);
                      setActiveTab('catalogue');
                    }}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all text-center"
                  >
                    Voir les produits
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── TAB 5: IMPORT / EXPORT ─────────────────────────────────────────── */}
        {activeTab === 'import_export' && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className="bg-[#15231D] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2D6B4A]/20 text-[#8BAF7C] flex items-center justify-center">
                  <Icon name="ArrowDownTrayIcon" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Exporter le Catalogue</h3>
                  <p className="text-xs text-white/50">Téléchargez l&apos;intégralité des produits au format CSV ou XLSX.</p>
                </div>
              </div>
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={() => handleExportCSV(false)}
                  className="w-full py-2.5 rounded-xl bg-[#2D6B4A] hover:bg-[#205238] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Icon name="DocumentArrowDownIcon" size={16} />
                  <span>Exporter tous les produits ({products.length})</span>
                </button>
              </div>
            </div>

            {/* Info Import Card */}
            <div className="bg-[#15231D] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Icon name="CloudArrowUpIcon" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Import Catalogue</h3>
                  <p className="text-xs text-white/50">Mettez à jour ou importez de nouveaux produits via CSV.</p>
                </div>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Les colonnes reconnues : <code className="text-sky-300 font-mono">product_id, name, brand, price_eur, stock, category_main</code>.
                Les doublons de SKU existants seront automatiquement mis à jour.
              </p>
            </div>
          </section>
        )}

        {/* ─── TAB 6: AUDIT LOGS ──────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <section className="bg-[#15231D] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold font-display text-white">Journal d&apos;Audit des Opérations</h2>
                <p className="text-xs text-white/50">Traces certifiées des créations, modifications et suppressions.</p>
              </div>
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Filtrer l'audit..."
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-black/30 border-b border-white/10 text-[10px] font-mono text-white/50 uppercase">
                    <th className="p-3">Date</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Cible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {globalAuditLogs
                    .filter(l => !auditSearch || l.target_name?.toLowerCase().includes(auditSearch.toLowerCase()) || l.action.includes(auditSearch))
                    .map(log => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-white/50">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-3 text-white/80">{log.admin_email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-sans text-white font-medium">{log.target_name || log.target_id}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* ─── MODAL: Quick Stock Adjustment ──────────────────────────────────── */}
      {quickStockItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15231D] border border-white/15 rounded-[0.75rem] p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Ajustement de Stock Rapide</h3>
              <button onClick={() => setQuickStockItem(null)} className="text-white/40 hover:text-white">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <p className="text-xs text-white/70">
              Produit : <span className="font-bold text-white">{quickStockItem.name}</span> (Stock actuel: {quickStockItem.stock})
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Type de mouvement</label>
                <select
                  value={stockAdjType}
                  onChange={e => setStockAdjType(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="reassort">Réassort (+)</option>
                  <option value="ajustement">Ajustement inventaire (+ / -)</option>
                  <option value="retour">Retour client (+)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Variation de quantité (ex: +10 ou -5)</label>
                <input
                  type="number"
                  value={stockAdjQuantity || ''}
                  onChange={e => setStockAdjQuantity(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-base font-mono font-bold text-white"
                  placeholder="Quantité (+ ou -)"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Motif / Commentaire</label>
                <input
                  type="text"
                  value={stockAdjNotes}
                  onChange={e => setStockAdjNotes(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  placeholder="ex: Réception commande fournisseur..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setQuickStockItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleApplyStockAdjustment}
                className="flex-1 py-2.5 rounded-xl bg-[#2D6B4A] hover:bg-[#205238] text-xs font-bold text-white shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Bulk Actions ─────────────────────────────────────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15231D] border border-white/15 rounded-[0.75rem] p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Actions Groupées ({selectedIds.size} sélectionnés)</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-white/40 hover:text-white">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Action à appliquer</label>
                <select
                  value={bulkActionType}
                  onChange={e => setBulkActionType(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Choisir une action groupée --</option>
                  <option value="activate">Activer les produits</option>
                  <option value="deactivate">Désactiver les produits</option>
                  <option value="category">Changer de catégorie</option>
                  <option value="price">Ajuster les prix</option>
                  <option value="stock">Définir le stock</option>
                  <option value="delete">Supprimer définitivement</option>
                </select>
              </div>

              {bulkActionType === 'category' && (
                <div>
                  <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Nouvelle catégorie</label>
                  <select
                    value={bulkCategoryVal}
                    onChange={e => setBulkCategoryVal(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {bulkActionType === 'stock' && (
                <div>
                  <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Nouveau stock unitaire</label>
                  <input
                    type="number"
                    value={bulkStockVal}
                    onChange={e => setBulkStockVal(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              )}

              {bulkActionType === 'price' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Type d&apos;ajustement</label>
                    <select
                      value={bulkPriceChange.type}
                      onChange={e => setBulkPriceChange(p => ({ ...p, type: e.target.value as any }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="percent">Pourcentage (%)</option>
                      <option value="fixed">Montant fixe (€)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-white/50 uppercase block mb-1">Valeur (+ ou -)</label>
                    <input
                      type="number"
                      value={bulkPriceChange.value}
                      onChange={e => setBulkPriceChange(p => ({ ...p, value: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono text-white"
                      placeholder="ex: +10 ou -5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleExecuteBulkAction}
                disabled={!bulkActionType}
                className="flex-1 py-2.5 rounded-xl bg-[#2D6B4A] hover:bg-[#205238] text-xs font-bold text-white disabled:opacity-40 shadow-md"
              >
                Appliquer aux {selectedIds.size} produits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Confirmation Dialog ─────────────────────────────────────── */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15231D] border border-white/15 rounded-[0.75rem] p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <h3 className={`font-bold text-base ${confirmModal.danger ? 'text-red-400' : 'text-white'}`}>
              {confirmModal.title}
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md ${
                  confirmModal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2D6B4A] hover:bg-[#205238]'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
