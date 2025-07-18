import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import Hero from '../components/home/Hero';
import CategoryNav from '../components/products/CategoryNav';
import ProductGrid from '../components/products/ProductGrid';
import FeaturedProductSlider from '../components/products/FeaturedProductSlider';
import { Category, Product } from '../types';
import { 
  getCategories, 
  getProducts, 
  transformCategory, 
  transformProduct,
  testApiConnection,
  ApiError
} from '../services/api';

// Loading Component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

// Error Component
const ErrorMessage: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-8">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">API Connection Error</h3>
        <p className="text-sm text-red-700 mt-1">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

// API Status Component
const ApiStatus: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<{
    health: boolean;
    categories: number;
    products: number;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const testApi = async () => {
    setTesting(true);
    const result = await testApiConnection();
    setApiStatus(result);
    setTesting(false);
  };

  useEffect(() => {
    testApi();
  }, []);

  if (testing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800">🧪 Testing API connection...</p>
      </div>
    );
  }

  if (!apiStatus) return null;

  return (
    <div className={`border rounded-lg p-4 mb-6 ${
      apiStatus.health ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-medium ${apiStatus.health ? 'text-green-800' : 'text-red-800'}`}>
            {apiStatus.health ? '✅ API Connected' : '❌ API Connection Failed'}
          </h3>
          {apiStatus.health ? (
            <p className="text-green-700 text-sm">
              Found {apiStatus.categories} categories and {apiStatus.products} products
            </p>
          ) : (
            <p className="text-red-700 text-sm">{apiStatus.error}</p>
          )}
        </div>
        <button
          onClick={testApi}
          className="text-sm bg-white px-3 py-1 rounded border hover:bg-gray-50"
        >
          Test Again
        </button>
      </div>
    </div>
  );
};

const HomePageWithAPI: React.FC = () => {
  // Fetch categories from API
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories
  } = useQuery('categories', getCategories, {
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch products from API
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts
  } = useQuery('products', getProducts, {
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Transform API data to frontend format
  const categories: Category[] = categoriesData ? categoriesData.map(transformCategory) : [];
  const products: Product[] = productsData ? productsData.map(transformProduct) : [];
  const featuredProducts = products.filter(p => p.featured);

  // Handle errors
  const hasError = categoriesError || productsError;
  const errorMessage = categoriesError instanceof ApiError 
    ? `Categories: ${categoriesError.message}` 
    : productsError instanceof ApiError 
    ? `Products: ${productsError.message}`
    : 'Unknown API error';

  const handleRetry = () => {
    refetchCategories();
    refetchProducts();
  };

  return (
    <div>
      <Hero />
      
      {/* API Status Indicator */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <ApiStatus />
      </div>

      {/* Error Handling */}
      {hasError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorMessage error={errorMessage} onRetry={handleRetry} />
        </div>
      )}

      {/* Categories Section */}
      {categoriesLoading ? (
        <LoadingSpinner message="Loading categories..." />
      ) : categories.length > 0 ? (
        <CategoryNav categories={categories} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-500 text-center">No categories found</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Featured Products Section */}
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Featured Products
          {featuredProducts.length > 0 && (
            <span className="text-lg font-normal text-gray-600 ml-2">
              ({featuredProducts.length} items)
            </span>
          )}
        </h2>
        
        {productsLoading ? (
          <LoadingSpinner message="Loading featured products..." />
        ) : featuredProducts.length > 0 ? (
          <FeaturedProductSlider products={featuredProducts} />
        ) : (
          <p className="text-gray-500 text-center py-8">No featured products found</p>
        )}

        {/* All Products Section */}
        <h2 className="text-3xl font-bold text-gray-900 my-8">
          All Products
          {products.length > 0 && (
            <span className="text-lg font-normal text-gray-600 ml-2">
              ({products.length} items)
            </span>
          )}
        </h2>
        
        {productsLoading ? (
          <LoadingSpinner message="Loading all products..." />
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="text-gray-500 text-center py-8">No products found</p>
        )}

        {/* Debug Information (only in development) */}
        {import.meta.env.DEV && (
          <div className="mt-12 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-2">Debug Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>API Base URL: {import.meta.env.VITE_API_URL || 'http://localhost:8000'}</p>
              <p>Categories loaded: {categories.length}</p>
              <p>Products loaded: {products.length}</p>
              <p>Featured products: {featuredProducts.length}</p>
              <p>Categories loading: {categoriesLoading ? 'Yes' : 'No'}</p>
              <p>Products loading: {productsLoading ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePageWithAPI;
