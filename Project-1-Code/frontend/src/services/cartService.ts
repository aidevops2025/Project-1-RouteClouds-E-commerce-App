import React from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types for cart operations
export interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    brand: string;
    price: number;
    description: string;
    images: string[];
    stock: number;
    category: string;
  };
  quantity: number;
  totalPrice: number;
  addedAt: string;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
}

export interface Order {
  id: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  shippingAddress: string;
  billingAddress?: string;
  paymentMethod: string;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  product: {
    id: string;
    name: string;
    brand: string;
    description: string;
    images: string[];
    category: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateOrderData {
  shippingAddress: string;
  billingAddress?: string;
  paymentMethod: string;
  notes?: string;
}

// Get authentication headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Cart API functions
export const cartService = {
  // Get user's cart
  async getCart(): Promise<Cart> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/cart`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching cart:', error);
      throw new Error('Failed to fetch cart');
    }
  },

  // Add item to cart
  async addToCart(productId: string, quantity: number = 1): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/api/cart/add`, {
        productId,
        quantity
      }, {
        headers: getAuthHeaders()
      });
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      throw new Error(error.response?.data?.message || 'Failed to add item to cart');
    }
  },

  // Update cart item quantity
  async updateCartItem(cartItemId: string, quantity: number): Promise<void> {
    try {
      await axios.put(`${API_BASE_URL}/api/cart/update/${cartItemId}`, {
        quantity
      }, {
        headers: getAuthHeaders()
      });
    } catch (error: any) {
      console.error('Error updating cart item:', error);
      throw new Error(error.response?.data?.message || 'Failed to update cart item');
    }
  },

  // Remove item from cart
  async removeFromCart(cartItemId: string): Promise<void> {
    try {
      await axios.delete(`${API_BASE_URL}/api/cart/remove/${cartItemId}`, {
        headers: getAuthHeaders()
      });
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      throw new Error(error.response?.data?.message || 'Failed to remove item from cart');
    }
  },

  // Clear entire cart
  async clearCart(): Promise<void> {
    try {
      await axios.delete(`${API_BASE_URL}/api/cart/clear`, {
        headers: getAuthHeaders()
      });
    } catch (error: any) {
      console.error('Error clearing cart:', error);
      throw new Error(error.response?.data?.message || 'Failed to clear cart');
    }
  }
};

// Order API functions
export const orderService = {
  // Create order from cart
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/orders/create`, orderData, {
        headers: getAuthHeaders()
      });
      return response.data.order;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw new Error(error.response?.data?.message || 'Failed to create order');
    }
  },

  // Get user's orders
  async getOrders(): Promise<Order[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders`, {
        headers: getAuthHeaders()
      });
      return response.data.orders;
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch orders');
    }
  },

  // Get specific order details
  async getOrder(orderId: string): Promise<Order> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching order:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch order details');
    }
  }
};

// React hooks for cart and order management
export const useCart = () => {
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const cartData = await cartService.getCart();
      setCart(cartData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      await cartService.addToCart(productId, quantity);
      await fetchCart(); // Refresh cart
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (cartItemId: string, quantity: number) => {
    setLoading(true);
    setError(null);
    try {
      await cartService.updateCartItem(cartItemId, quantity);
      await fetchCart(); // Refresh cart
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (cartItemId: string) => {
    setLoading(true);
    setError(null);
    try {
      await cartService.removeFromCart(cartItemId);
      await fetchCart(); // Refresh cart
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    setError(null);
    try {
      await cartService.clearCart();
      await fetchCart(); // Refresh cart
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      fetchCart();
    }
  }, []);

  return {
    cart,
    loading,
    error,
    fetchCart,
    addToCart,
    updateItem,
    removeItem,
    clearCart
  };
};

export const useOrders = () => {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const ordersData = await orderService.getOrders();
      setOrders(ordersData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (orderData: CreateOrderData) => {
    setLoading(true);
    setError(null);
    try {
      const order = await orderService.createOrder(orderData);
      await fetchOrders(); // Refresh orders
      return order;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      fetchOrders();
    }
  }, []);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    createOrder
  };
};
