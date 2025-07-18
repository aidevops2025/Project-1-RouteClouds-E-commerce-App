import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchProducts, ApiProduct, transformProduct } from '../../services/api';
import { Product } from '../../types';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onSearchResults?: (results: Product[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  className = '',
  placeholder = 'Search products...',
  onSearchResults
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await searchProducts(query.trim());
        const transformedResults = response.results.map(transformProduct);
        setResults(transformedResults);
        setShowResults(true);
        
        if (onSearchResults) {
          onSearchResults(transformedResults);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search products');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, onSearchResults]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowResults(false);
    }
  };

  const handleProductClick = (product: Product) => {
    navigate(`/products/${product.id}`);
    setShowResults(false);
    setQuery('');
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setError(null);
    inputRef.current?.focus();
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.trim()})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-20 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {isLoading && (
            <Loader2 className="text-gray-400 animate-spin" size={16} />
          )}
          
          {query && !isLoading && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          
          <button
            type="submit"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Search size={20} />
          </button>
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {!error && results.length === 0 && !isLoading && query.trim() && (
            <div className="p-4 text-gray-500 text-sm">
              No products found for "{query}"
            </div>
          )}
          
          {!error && results.length > 0 && (
            <>
              <div className="p-2 border-b border-gray-100 text-xs text-gray-500 font-medium">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
              
              {results.slice(0, 8).map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {highlightMatch(product.name, query)}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {product.brand} • {product.category}
                      </div>
                      <div className="text-sm font-semibold text-blue-600">
                        ${product.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              
              {results.length > 8 && (
                <button
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                    setShowResults(false);
                  }}
                  className="w-full p-3 text-center text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                >
                  View all {results.length} results
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
