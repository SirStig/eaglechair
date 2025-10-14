import { create } from 'zustand';

export const useAdminStore = create((set) => ({
  selectedSection: 'products',
  editingItem: null,
  isLoading: false,
  error: null,

  setSection: (section) => set({ selectedSection: section }),
  
  setEditingItem: (item) => set({ editingItem: item }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  clearError: () => set({ error: null }),
}));


