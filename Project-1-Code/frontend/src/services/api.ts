// API Service for RouteClouds E-Commerce Backend Integration

// API Response Types (matching backend structure)
export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  created_at: string;
}

export interface ApiProduct {
  id: number;
  name: string;
  brand: string | null;
  category_id: number | null;
  sub_category: string | null;
  price: string; // Decimal comes as string from API
  description: string | null;
  specifications: any | null;
  images: string[] | null;
  stock: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  category_name: string | null;
}

export interface ApiHealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

export interface ApiHelloResponse {
  message: string;
  version: string;
  endpoints: string[];
}

export interface ApiSearchResponse {
  query: string;
  results: ApiProduct[];
  count: number;
  filters: {
    category: string | null;
    minPrice: number | null;
    maxPrice: number | null;
  };
}

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Generic API Error Class
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic API Request Function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        `API Error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json();
    console.log(`✅ API Response: ${endpoint}`, data);
    return data;
  } catch (error) {
    console.error(`❌ API Error: ${endpoint}`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// API Service Functions

/**
 * Health Check - Test API connectivity
 */
export async function checkApiHealth(): Promise<ApiHealthResponse> {
  return apiRequest<ApiHealthResponse>('/status');
}

/**
 * Hello Endpoint - Get API information
 */
export async function getApiInfo(): Promise<ApiHelloResponse> {
  return apiRequest<ApiHelloResponse>('/hello');
}

/**
 * Get all categories from the backend
 */
export async function getCategories(): Promise<ApiCategory[]> {
  return apiRequest<ApiCategory[]>('/categories');
}

/**
 * Get all products from the backend
 */
export async function getProducts(): Promise<ApiProduct[]> {
  return apiRequest<ApiProduct[]>('/products');
}

/**
 * Get a specific product by ID
 */
export async function getProduct(id: number): Promise<ApiProduct> {
  return apiRequest<ApiProduct>(`/products/${id}`);
}

/**
 * Search products with optional filters
 */
export async function searchProducts(
  query: string,
  filters?: SearchFilters
): Promise<ApiSearchResponse> {
  const params = new URLSearchParams();
  params.append('q', query);

  if (filters?.category) {
    params.append('category', filters.category);
  }
  if (filters?.minPrice !== undefined) {
    params.append('minPrice', filters.minPrice.toString());
  }
  if (filters?.maxPrice !== undefined) {
    params.append('maxPrice', filters.maxPrice.toString());
  }
  if (filters?.limit !== undefined) {
    params.append('limit', filters.limit.toString());
  }

  return apiRequest<ApiSearchResponse>(`/products/search?${params.toString()}`);
}

/**
 * Create a new category (Admin function)
 */
export async function createCategory(category: {
  name: string;
  slug: string;
  parent_id?: number;
}): Promise<ApiCategory> {
  return apiRequest<ApiCategory>('/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
}

/**
 * Create a new product (Admin function)
 */
export async function createProduct(product: {
  name: string;
  brand?: string;
  category_id?: number;
  sub_category?: string;
  price: number;
  description?: string;
  specifications?: any;
  images?: string[];
  stock?: number;
  featured?: boolean;
}): Promise<ApiProduct> {
  return apiRequest<ApiProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

// Data Transformation Functions

/**
 * Transform API Category to Frontend Category
 */
export function transformCategory(apiCategory: ApiCategory): import('../types').Category {
  return {
    id: apiCategory.id.toString(),
    name: apiCategory.name,
    slug: apiCategory.slug,
    children: [], // Would need to implement hierarchical categories
  };
}

/**
 * Transform API Product to Frontend Product
 */
export function transformProduct(apiProduct: ApiProduct): import('../types').Product {
  return {
    id: apiProduct.id.toString(),
    name: apiProduct.name,
    brand: apiProduct.brand || 'Unknown',
    category: apiProduct.category_name || 'Uncategorized',
    subCategory: apiProduct.sub_category || '',
    price: parseFloat(apiProduct.price),
    description: apiProduct.description || '',
    specifications: apiProduct.specifications || {},
    images: apiProduct.images || ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&q=80'],
    stock: apiProduct.stock,
    featured: apiProduct.featured,
  };
}

// React Query Hooks (for use with React Query)

/**
 * Custom hook for fetching categories
 */
export const useCategoriesQuery = () => ({
  queryKey: ['categories'],
  queryFn: getCategories,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

/**
 * Custom hook for fetching products
 */
export const useProductsQuery = () => ({
  queryKey: ['products'],
  queryFn: getProducts,
  staleTime: 2 * 60 * 1000, // 2 minutes
});

/**
 * Custom hook for fetching a single product
 */
export const useProductQuery = (id: number) => ({
  queryKey: ['product', id],
  queryFn: () => getProduct(id),
  enabled: !!id,
});

/**
 * Custom hook for searching products
 */
export const useProductSearchQuery = (query: string, filters?: SearchFilters) => ({
  queryKey: ['products', 'search', query, filters],
  queryFn: () => searchProducts(query, filters),
  enabled: !!query && query.trim().length > 0,
  staleTime: 30 * 1000, // 30 seconds
});

// API Testing Function
export async function testApiConnection(): Promise<{
  health: boolean;
  categories: number;
  products: number;
  error?: string;
}> {
  try {
    console.log('🧪 Testing API Connection...');

    // Test health endpoint
    const health = await checkApiHealth();
    console.log('✅ Health Check:', health);

    // Test categories endpoint
    const categories = await getCategories();
    console.log('✅ Categories:', categories.length, 'found');

    // Test products endpoint
    const products = await getProducts();
    console.log('✅ Products:', products.length, 'found');

    return {
      health: health.status === 'ok',
      categories: categories.length,
      products: products.length,
    };
  } catch (error) {
    console.error('❌ API Connection Test Failed:', error);
    return {
      health: false,
      categories: 0,
      products: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  checkApiHealth,
  getApiInfo,
  getCategories,
  getProducts,
  getProduct,
  searchProducts,
  createCategory,
  createProduct,
  transformCategory,
  transformProduct,
  testApiConnection,
};
