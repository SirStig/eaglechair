import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../config/apiClient';
import logger from '../utils/logger';

const CONTEXT = 'CartStore';

/**
 * Cart Store
 * 
 * Handles cart state for both guest and authenticated users:
 * - Guest users: Cart stored in localStorage
 * - Authenticated users: Cart synced with backend database
 * - On login/register: Guest cart is merged into backend cart
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      // Guest cart items (stored in localStorage)
      guestItems: [],
      
      // Backend cart data (for authenticated users)
      backendCart: null,
      backendCartId: null,
      
      // UI state
      isOpen: false,
      isLoading: false,
      
      // Auth state
      isAuthenticated: false,

      // ========================================================================
      // Computed Properties
      // ========================================================================
      
      // Get current items (guest or backend)
      getItems: () => {
        const state = get();
        
        if (state.isAuthenticated && state.backendCart) {
          return state.backendCart.items || [];
        }
        return state.guestItems;
      },

      // Get total items count
      getItemCount: () => {
        const items = get().getItems();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Get total price
      getTotalPrice: () => {
        const items = get().getItems();
        return items.reduce((sum, item) => {
          const price = item.product?.price || item.product?.base_price || 0;
          return sum + (price * item.quantity);
        }, 0);
      },

      // ========================================================================
      // Add Item (works for both guest and authenticated)
      // ========================================================================
      
      addItem: async (product, quantity = 1, customizations = {}) => {
        const isAuth = get().isAuthenticated;
        
        if (isAuth) {
          // Authenticated: Add to backend
          return await get().addItemToBackend(product, quantity, customizations);
        } else {
          // Guest: Add to local storage
          get().addItemToGuest(product, quantity, customizations);
        }
      },

      // Add item to guest cart (localStorage)
      addItemToGuest: (product, quantity = 1, customizations = {}) => {
        set((state) => {
          const existingItemIndex = state.guestItems.findIndex(
            (item) => 
              item.product.id === product.id && 
              JSON.stringify(item.customizations) === JSON.stringify(customizations)
          );

          if (existingItemIndex > -1) {
            // Update quantity if item exists
            const newItems = [...state.guestItems];
            newItems[existingItemIndex].quantity += quantity;
            logger.info(CONTEXT, `Updated guest cart item quantity: ${product.name}`);
            return { guestItems: newItems };
          } else {
            // Add new item
            logger.info(CONTEXT, `Added item to guest cart: ${product.name}`);
            return { 
              guestItems: [...state.guestItems, { 
                product, 
                quantity, 
                customizations,
                addedAt: new Date().toISOString()
              }] 
            };
          }
        });
      },

      // Add item to backend cart
      addItemToBackend: async (product, quantity = 1, customizations = {}) => {
        set({ isLoading: true });
        try {
          // Extract finish and upholstery IDs from customization objects
          const finishId = customizations.finish?.id || 
                          customizations.selected_finish_id || 
                          null;
          const upholsteryId = customizations.upholstery?.id || 
                             customizations.selected_upholstery_id || 
                             null;
          
          // Preserve other customizations
          const customOptions = { ...customizations };
          if (customOptions.finish) delete customOptions.finish;
          if (customOptions.upholstery) delete customOptions.upholstery;
          if (customOptions.selected_finish_id) delete customOptions.selected_finish_id;
          if (customOptions.selected_upholstery_id) delete customOptions.selected_upholstery_id;
          
          const payload = {
            product_id: product.id,
            quantity,
            selected_finish_id: finishId,
            selected_upholstery_id: upholsteryId,
            item_notes: customizations.custom_notes || customizations.item_notes || null,
            custom_options: Object.keys(customOptions).length > 0 ? customOptions : null
          };
          
          console.log('Adding to backend cart:', payload);
          
          await apiClient.post('/api/v1/quotes/cart/items', payload);
          
          // Reload cart to get updated data
          await get().loadBackendCart();
          
          logger.info(CONTEXT, `Added item to backend cart: ${product.name}`);
        } catch (error) {
          logger.error(CONTEXT, 'Error adding item to backend cart', error);
          console.error('Failed to add to backend cart:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Remove Item
      // ========================================================================
      
      removeItem: async (itemIndex) => {
        const isAuth = get().isAuthenticated;
        
        if (isAuth) {
          // For backend cart, we need the item ID
          const items = get().getItems();
          const item = items[itemIndex];
          if (item && item.id) {
            await get().removeItemFromBackend(item.id);
          }
        } else {
          // Guest cart: remove by index
          set((state) => ({
            guestItems: state.guestItems.filter((_, index) => index !== itemIndex)
          }));
          logger.info(CONTEXT, 'Removed item from guest cart');
        }
      },

      removeItemFromBackend: async (cartItemId) => {
        set({ isLoading: true });
        try {
          await apiClient.delete(`/api/v1/quotes/cart/items/${cartItemId}`);
          
          // Reload cart to get updated data
          await get().loadBackendCart();
          
          logger.info(CONTEXT, `Removed item from backend cart: ${cartItemId}`);
        } catch (error) {
          logger.error(CONTEXT, 'Error removing item from backend cart', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Update Quantity
      // ========================================================================
      
      updateQuantity: async (itemIndex, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(itemIndex);
          return;
        }

        const isAuth = get().isAuthenticated;
        
        if (isAuth) {
          const items = get().getItems();
          const item = items[itemIndex];
          if (item && item.id) {
            await get().updateItemInBackend(item.id, { quantity });
          }
        } else {
          set((state) => {
            const newItems = [...state.guestItems];
            newItems[itemIndex].quantity = quantity;
            return { guestItems: newItems };
          });
          logger.info(CONTEXT, 'Updated quantity in guest cart');
        }
      },

      // ========================================================================
      // Update Customizations
      // ========================================================================
      
      updateCustomizations: async (itemIndex, customizations) => {
        const isAuth = get().isAuthenticated;
        
        if (isAuth) {
          const items = get().getItems();
          const item = items[itemIndex];
          if (item && item.id) {
            await get().updateItemInBackend(item.id, { 
              custom_options: customizations 
            });
          }
        } else {
          set((state) => {
            const newItems = [...state.guestItems];
            newItems[itemIndex].customizations = customizations;
            return { guestItems: newItems };
          });
          logger.info(CONTEXT, 'Updated customizations in guest cart');
        }
      },

      updateItemInBackend: async (cartItemId, updates) => {
        set({ isLoading: true });
        try {
          await apiClient.patch(`/api/v1/quotes/cart/items/${cartItemId}`, updates);
          
          // Reload cart to get updated data
          await get().loadBackendCart();
          
          logger.info(CONTEXT, `Updated cart item in backend: ${cartItemId}`);
        } catch (error) {
          logger.error(CONTEXT, 'Error updating cart item in backend', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Clear Cart
      // ========================================================================
      
      clearCart: async () => {
        const isAuth = get().isAuthenticated;
        
        if (isAuth) {
          await get().clearBackendCart();
        } else {
          set({ guestItems: [] });
          logger.info(CONTEXT, 'Cleared guest cart');
        }
      },

      clearBackendCart: async () => {
        set({ isLoading: true });
        try {
          await apiClient.delete('/api/v1/quotes/cart/clear');
          set({ backendCart: null });
          logger.info(CONTEXT, 'Cleared backend cart');
        } catch (error) {
          logger.error(CONTEXT, 'Error clearing backend cart', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Cart UI State
      // ========================================================================
      
      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      // ========================================================================
      // Backend Cart Operations
      // ========================================================================
      
      loadBackendCart: async () => {
        set({ isLoading: true });
        try {
          const cart = await apiClient.get('/api/v1/quotes/cart');
          
          // Validate cart response
          if (!cart || typeof cart !== 'object') {
            logger.error(CONTEXT, 'Invalid cart response from API', cart);
            set({
              backendCart: { items: [] },
              backendCartId: null,
            });
            return null;
          }
          
          set({
            backendCart: cart,
            backendCartId: cart.id,
          });
          
          logger.info(CONTEXT, 'Backend cart loaded', cart);
          return cart;
        } catch (error) {
          logger.error(CONTEXT, 'Error loading backend cart', error);
          // Set empty cart on error
          set({
            backendCart: { items: [] },
            backendCartId: null,
          });
          return null;
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Merge Guest Cart into Backend (called on login/register)
      // ========================================================================
      
      mergeGuestCart: async () => {
        const guestItems = get().guestItems;
        
        if (guestItems.length === 0) {
          logger.info(CONTEXT, 'No guest items to merge');
          set({ isAuthenticated: true });
          await get().loadBackendCart();
          return;
        }

        logger.info(CONTEXT, `Merging ${guestItems.length} guest items into backend cart`);

        set({ isLoading: true });
        try {
          // Convert guest items to CartItemCreate format for merge endpoint
          const mergePayload = guestItems.map(item => {
            const customizations = item.customizations || {};
            
            // Extract finish and upholstery IDs from customization objects
            // Customizations can be stored as:
            // - { finish: { id: 1, ... }, upholstery: { id: 2, ... } }
            // - { selected_finish_id: 1, selected_upholstery_id: 2 }
            const finishId = customizations.finish?.id || 
                            customizations.selected_finish_id || 
                            null;
            const upholsteryId = customizations.upholstery?.id || 
                               customizations.selected_upholstery_id || 
                               null;
            
            // Preserve other customizations in custom_options
            const customOptions = { ...customizations };
            // Remove finish/upholstery objects if they exist (we only need IDs)
            if (customOptions.finish) delete customOptions.finish;
            if (customOptions.upholstery) delete customOptions.upholstery;
            if (customOptions.selected_finish_id) delete customOptions.selected_finish_id;
            if (customOptions.selected_upholstery_id) delete customOptions.selected_upholstery_id;
            
            return {
              product_id: item.product.id,
              quantity: item.quantity,
              selected_finish_id: finishId,
              selected_upholstery_id: upholsteryId,
              custom_options: Object.keys(customOptions).length > 0 ? customOptions : null,
              item_notes: customizations.custom_notes || customizations.item_notes || item.item_notes || null
            };
          });
          
          logger.info(CONTEXT, 'Sending merge request with items:', mergePayload);
          
          // Use the merge endpoint to add all items at once
          const mergedCart = await apiClient.post('/api/v1/quotes/cart/merge', mergePayload);
          
          logger.info(CONTEXT, 'Cart merged successfully', mergedCart);
          
          // Load the merged cart from backend to get full item details
          await get().loadBackendCart();
          
          // Clear guest items and set authenticated
          set({ 
            guestItems: [],
            isAuthenticated: true
          });

          logger.info(CONTEXT, 'Guest cart merged successfully');
        } catch (error) {
          logger.error(CONTEXT, 'Error merging guest cart', error);
          console.error('Cart merge failed:', error);
          
          // If merge fails, fallback to adding items one by one
          logger.info(CONTEXT, 'Falling back to individual item addition');
          try {
            for (const item of guestItems) {
              try {
                await get().addItemToBackend(
                  item.product,
                  item.quantity,
                  item.customizations || {}
                );
              } catch (itemError) {
                logger.error(CONTEXT, `Failed to add item ${item.product?.name || 'unknown'}`, itemError);
              }
            }
            
            await get().loadBackendCart();
            set({ 
              guestItems: [],
              isAuthenticated: true
            });
            logger.info(CONTEXT, 'Guest cart merged using fallback method');
          } catch (fallbackError) {
            logger.error(CONTEXT, 'Fallback merge also failed', fallbackError);
            // If fallback also fails, still try to load backend cart (might already exist)
            try {
              await get().loadBackendCart();
              set({ isAuthenticated: true });
              logger.info(CONTEXT, 'Loaded existing backend cart after merge failure');
            } catch (loadError) {
              logger.error(CONTEXT, 'Failed to load backend cart', loadError);
              // Stay in guest mode
              set({ isAuthenticated: false });
            }
          }
        } finally {
          set({ isLoading: false });
        }
      },

      // ========================================================================
      // Auth State Management
      // ========================================================================
      
      // Switch to guest mode (on logout)
      switchToGuestMode: () => {
        set({
          isAuthenticated: false,
          backendCart: null,
          backendCartId: null,
        });
        logger.info(CONTEXT, 'Switched to guest cart mode');
      },

      // Switch to authenticated mode (on login)
      switchToAuthMode: async () => {
        // Don't set isAuthenticated yet - wait for merge to complete
        await get().mergeGuestCart();
        logger.info(CONTEXT, 'Switched to authenticated cart mode');
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ 
        // Only persist guest items
        guestItems: state.guestItems,
      }),
    }
  )
);


