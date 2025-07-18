import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, TrendingUp, Package, Users, Award } from 'lucide-react';
import { RootState } from '../store';
import ProductCard from '../components/ecommerce/ProductCard';
import { getProducts, getCategories } from '../services/api';
import { useCart } from '../services/cartService';

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  images?: string[];
  stock: number;
  category_name?: string;
  featured?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const ECommerceHomePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { cart, fetchCart } = useCart();

  // Fetch products and categories
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery(
    'products',
    getProducts,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const { data: categories = [], isLoading: categoriesLoading } = useQuery(
    'categories',
    getCategories,
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  // Filter featured products
  const featuredProducts = products.filter((product: Product) => product.featured);
  const regularProducts = products.filter((product: Product) => !product.featured);

  const handleAddToCart = (productId: string, quantity: number) => {
    // Refresh cart after adding item
    fetchCart();
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading RouteClouds E-Commerce...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Welcome to RouteClouds
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Your Premier Destination for Cloud Infrastructure & DevOps Solutions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/products"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Shop Now
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900">{products.length}+</h3>
              <p className="text-gray-600">Products Available</p>
            </div>
            <div className="text-center">
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900">1000+</h3>
              <p className="text-gray-600">Happy Customers</p>
            </div>
            <div className="text-center">
              <Award className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900">99.9%</h3>
              <p className="text-gray-600">Uptime Guarantee</p>
            </div>
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900">24/7</h3>
              <p className="text-gray-600">Support Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Shop by Category
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((category: Category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-center"
                >
                  <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      {featuredProducts.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Featured Products
              </h2>
              <p className="text-gray-600">
                Discover our most popular cloud infrastructure solutions
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.map((product: Product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Products Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              All Products
            </h2>
            <p className="text-gray-600">
              Browse our complete catalog of DevOps and cloud solutions
            </p>
          </div>

          {productsError ? (
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load products. Please try again later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regularProducts.map((product: Product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* User Dashboard Section (for logged-in users) */}
      {user && (
        <section className="py-16 bg-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Welcome back, {user.firstName || user.username}!
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link
                  to="/cart"
                  className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2" />
                  <h3 className="font-semibold">Shopping Cart</h3>
                  <p className="text-sm text-blue-100">
                    {cart ? `${cart.totalItems} items` : 'View cart'}
                  </p>
                </Link>
                <Link
                  to="/orders"
                  className="bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition-colors text-center"
                >
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <h3 className="font-semibold">My Orders</h3>
                  <p className="text-sm text-green-100">View order history</p>
                </Link>
                <Link
                  to="/profile"
                  className="bg-purple-600 text-white p-6 rounded-lg hover:bg-purple-700 transition-colors text-center"
                >
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <h3 className="font-semibold">My Profile</h3>
                  <p className="text-sm text-purple-100">Manage account</p>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Infrastructure?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of companies using RouteClouds for their DevOps needs
          </p>
          {!user ? (
            <Link
              to="/login"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Get Started Today
            </Link>
          ) : (
            <Link
              to="/products"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Continue Shopping
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default ECommerceHomePage;
