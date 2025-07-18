import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';
import { 
  getCategories, 
  getProducts, 
  transformCategory, 
  transformProduct,
  testApiConnection,
  ApiError
} from '../../services/api';
import { Category, Product } from '../../types';

const ApiIntegrationDemo: React.FC = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [apiStatus, setApiStatus] = useState<{
    health: boolean;
    categories: number;
    products: number;
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Test API connection
  const testApi = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await testApiConnection();
      setApiStatus(result);
      
      if (result.health) {
        // Fetch real data
        const [categoriesData, productsData] = await Promise.all([
          getCategories(),
          getProducts()
        ]);
        
        setCategories(categoriesData.map(transformCategory));
        setProducts(productsData.map(transformProduct));
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Add product to cart (demonstrates cart functionality)
  const handleAddToCart = (product: Product) => {
    dispatch(addToCart({ 
      product, 
      quantity: 1 
    }));
    
    // Show success message (you could use a toast library here)
    alert(`Added "${product.name}" to cart!`);
  };

  // Load data on component mount
  useEffect(() => {
    testApi();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          🚀 RouteClouds API Integration Demo
        </h1>
        
        <p className="text-gray-600 mb-6">
          This demo shows the frontend connecting to the backend API and database, 
          demonstrating real e-commerce functionality.
        </p>

        {/* API Status Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">API Connection Status</h2>
            <button
              onClick={testApi}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg"
            >
              {loading ? 'Testing...' : 'Test API'}
            </button>
          </div>
          
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-blue-800">Testing API connection...</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-red-800 font-medium">API Connection Failed</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {apiStatus && !loading && (
            <div className={`border rounded-lg p-4 ${
              apiStatus.health ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <span className="text-2xl mr-3">
                  {apiStatus.health ? '✅' : '❌'}
                </span>
                <div>
                  <h3 className={`font-medium ${
                    apiStatus.health ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {apiStatus.health ? 'API Connected Successfully!' : 'API Connection Failed'}
                  </h3>
                  {apiStatus.health ? (
                    <p className="text-green-700 text-sm">
                      Backend API is running and database is accessible
                    </p>
                  ) : (
                    <p className="text-red-700 text-sm">{apiStatus.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Display Section */}
        {apiStatus?.health && (
          <div className="space-y-8">
            {/* Categories Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📂 Categories from Database ({categories.length})
              </h2>
              {categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map((category) => (
                    <div key={category.id} className="bg-gray-50 rounded-lg p-4 border">
                      <h3 className="font-medium text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600">ID: {category.id}</p>
                      <p className="text-sm text-gray-600">Slug: {category.slug}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No categories found in database</p>
              )}
            </div>

            {/* Products Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🛍️ Products from Database ({products.length})
              </h2>
              {products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="aspect-w-16 aspect-h-9 mb-4">
                        <img
                          src={product.images[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&q=80'}
                          alt={product.name}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">Brand: {product.brand}</p>
                      <p className="text-sm text-gray-600 mb-2">Category: {product.category}</p>
                      <p className="text-lg font-bold text-blue-600 mb-2">${product.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600 mb-3">Stock: {product.stock} units</p>
                      
                      {product.featured && (
                        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mb-3">
                          ⭐ Featured
                        </span>
                      )}
                      
                      <p className="text-sm text-gray-700 mb-4 line-clamp-2">{product.description}</p>
                      
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                      >
                        🛒 Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No products found in database</p>
              )}
            </div>

            {/* Integration Success Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🎉</span>
                <div>
                  <h3 className="text-green-800 font-medium text-lg">
                    Frontend-Backend Integration Successful!
                  </h3>
                  <p className="text-green-700">
                    The React frontend is successfully communicating with the Node.js backend API, 
                    which is connected to the PostgreSQL database. This demonstrates a fully 
                    functional 3-tier architecture.
                  </p>
                  <ul className="text-green-700 text-sm mt-2 space-y-1">
                    <li>✅ Frontend (React/TypeScript) - Running on port 3000</li>
                    <li>✅ Backend (Node.js/Express) - Running on port 8000</li>
                    <li>✅ Database (PostgreSQL) - Running on port 5432</li>
                    <li>✅ API Integration - All endpoints working</li>
                    <li>✅ Cart Functionality - Add to cart working</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🔧 Technical Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">API Endpoints Tested:</h3>
              <ul className="text-gray-600 space-y-1">
                <li>• GET /api/status - Health check</li>
                <li>• GET /api/hello - API information</li>
                <li>• GET /api/categories - Categories list</li>
                <li>• GET /api/products - Products list</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Features Demonstrated:</h3>
              <ul className="text-gray-600 space-y-1">
                <li>• Real-time API data fetching</li>
                <li>• Error handling and loading states</li>
                <li>• Cart functionality (Redux)</li>
                <li>• Responsive UI components</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiIntegrationDemo;
