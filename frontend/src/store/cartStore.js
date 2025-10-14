import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, quantity = 1, customizations = {}) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (item) => 
              item.product.id === product.id && 
              JSON.stringify(item.customizations) === JSON.stringify(customizations)
          );

          if (existingItemIndex > -1) {
            // Update quantity if item exists
            const newItems = [...state.items];
            newItems[existingItemIndex].quantity += quantity;
            return { items: newItems };
          } else {
            // Add new item
            return { 
              items: [...state.items, { 
                product, 
                quantity, 
                customizations,
                addedAt: new Date().toISOString()
              }] 
            };
          }
        });
      },

      removeItem: (itemIndex) => {
        set((state) => ({
          items: state.items.filter((_, index) => index !== itemIndex)
        }));
      },

      updateQuantity: (itemIndex, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemIndex);
          return;
        }

        set((state) => {
          const newItems = [...state.items];
          newItems[itemIndex].quantity = quantity;
          return { items: newItems };
        });
      },

      updateCustomizations: (itemIndex, customizations) => {
        set((state) => {
          const newItems = [...state.items];
          newItems[itemIndex].customizations = customizations;
          return { items: newItems };
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      // Get total items count
      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Get total price (if prices are available)
      getTotalPrice: () => {
        return get().items.reduce((sum, item) => {
          const price = item.product.price || 0;
          return sum + (price * item.quantity);
        }, 0);
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);


