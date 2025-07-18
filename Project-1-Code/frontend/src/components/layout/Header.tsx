import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ShoppingCart, User, Package, LogOut, Menu, X } from 'lucide-react';
import { RootState } from '../../store';
import { useCart } from '../../services/cartService';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import SearchBar from '../search/SearchBar';

const Header: React.FC = () => {
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const { cart, fetchCart } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user, fetchCart]);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold text-gray-900">RouteClouds</span>
          </Link>

          <div className="flex-1 max-w-2xl mx-8 hidden md:block">
            <SearchBar
              placeholder="Search products..."
              className="w-full"
            />
          </div>

          <nav className="hidden md:flex items-center space-x-4">
            {/* Products Link */}
            <Link
              to="/products"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Products
            </Link>

            {/* API Demo Link */}
            <Link
              to="/api-demo"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-lg transition-colors"
            >
              🚀 API Demo
            </Link>

            {/* Cart Link */}
            <Link to="/cart" className="relative">
              <ShoppingCart className="text-gray-600 hover:text-gray-900" size={24} />
              {(cart?.totalItems || cartItems.length) > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cart?.totalItems || cartItems.length}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Orders Link */}
                <Link
                  to="/orders"
                  className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Package size={20} />
                  <span className="text-sm font-medium">Orders</span>
                </Link>

                {/* Profile Link */}
                <Link to="/profile" className="flex items-center space-x-2">
                  <User className="text-gray-600" size={20} />
                  <span className="text-sm font-medium">{user.firstName || user.username}</span>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button and Icons */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Mobile Cart */}
            <Link to="/cart" className="relative">
              <ShoppingCart className="text-gray-600 hover:text-gray-900" size={24} />
              {(cart?.totalItems || cartItems.length) > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cart?.totalItems || cartItems.length}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            {/* Mobile Search */}
            <div className="px-4 py-3 border-b border-gray-200">
              <SearchBar
                placeholder="Search products..."
                className="w-full"
              />
            </div>

            {/* Mobile Navigation */}
            <div className="px-4 py-3 space-y-3">
              <Link
                to="/products"
                className="block text-base font-medium text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Products
              </Link>

              <Link
                to="/api-demo"
                className="block text-base font-medium text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                🚀 API Demo
              </Link>

              {user ? (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                  <Link
                    to="/orders"
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Package size={20} />
                    <span className="text-base font-medium">My Orders</span>
                  </Link>

                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors w-full text-left"
                  >
                    <LogOut size={20} />
                    <span className="text-base font-medium">Logout</span>
                  </button>

                  <div className="pt-2 text-sm text-gray-500">
                    Signed in as <span className="font-medium">{user.username}</span>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-gray-200">
                  <Link
                    to="/login"
                    className="block w-full text-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;