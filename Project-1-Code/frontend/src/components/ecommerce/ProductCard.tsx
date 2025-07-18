import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ShoppingCart, Plus, Minus, Star, Package } from 'lucide-react';
import { RootState } from '../../store';
import { useCart } from '../../services/cartService';

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

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string, quantity: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useSelector((state: RootState) => state.auth);
  const { addToCart, loading, error } = useCart();

  const handleAddToCart = async () => {
    if (!user) {
      alert('Please log in to add items to cart');
      return;
    }

    setIsAdding(true);
    try {
      await addToCart(product.id, quantity);
      
      // Call parent callback if provided
      if (onAddToCart) {
        onAddToCart(product.id, quantity);
      }
      
      // Show success message
      alert(`Added ${quantity}x ${product.name} to cart!`);
      setQuantity(1); // Reset quantity
    } catch (err) {
      console.error('Failed to add to cart:', err);
      alert('Failed to add item to cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const incrementQuantity = () => {
    if (quantity < product.stock) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Product Image */}
      <div className="relative h-48 bg-gray-200 flex items-center justify-center">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-16 w-16 text-gray-400" />
        )}
        
        {/* Featured badge */}
        {product.featured && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-medium">
            Featured
          </div>
        )}
        
        {/* Stock status badge */}
        {isOutOfStock && (
          <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-md text-xs font-medium">
            Out of Stock
          </div>
        )}
        {isLowStock && !isOutOfStock && (
          <div className="absolute top-2 right-2 bg-orange-600 text-white px-2 py-1 rounded-md text-xs font-medium">
            Low Stock
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Category */}
        {product.category_name && (
          <p className="text-sm text-gray-500 mb-1">{product.category_name}</p>
        )}
        
        {/* Brand and Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
        {product.brand && (
          <p className="text-sm text-gray-600 mb-2">by {product.brand}</p>
        )}
        
        {/* Description */}
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
          {product.description}
        </p>
        
        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
          <div className="flex items-center text-sm text-gray-500">
            <Package className="h-4 w-4 mr-1" />
            <span>{product.stock} in stock</span>
          </div>
        </div>
        
        {/* Quantity Selector and Add to Cart */}
        {!isOutOfStock && user && (
          <div className="space-y-3">
            {/* Quantity Selector */}
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-medium w-8 text-center">{quantity}</span>
              <button
                onClick={incrementQuantity}
                disabled={quantity >= product.stock}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={isAdding || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>
                {isAdding || loading ? 'Adding...' : `Add to Cart`}
              </span>
            </button>
          </div>
        )}
        
        {/* Out of Stock Message */}
        {isOutOfStock && (
          <div className="text-center py-2">
            <span className="text-red-600 font-medium">Currently Out of Stock</span>
          </div>
        )}
        
        {/* Login Required Message */}
        {!user && (
          <div className="text-center py-2">
            <span className="text-gray-600 text-sm">
              <a href="/login" className="text-blue-600 hover:underline">
                Log in
              </a> to add to cart
            </span>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mt-2 text-sm text-red-600 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
