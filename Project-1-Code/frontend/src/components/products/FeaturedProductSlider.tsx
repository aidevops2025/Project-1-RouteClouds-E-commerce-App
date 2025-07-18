import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../../types';
import ProductCard from './ProductCard';

interface FeaturedProductSliderProps {
  products: Product[];
}

const FeaturedProductSlider: React.FC<FeaturedProductSliderProps> = ({ products }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerSlide = 3;

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex + itemsPerSlide >= products.length ? 0 : prevIndex + itemsPerSlide
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex - itemsPerSlide < 0 ? Math.max(0, products.length - itemsPerSlide) : prevIndex - itemsPerSlide
    );
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * (100 / itemsPerSlide)}%)` }}
        >
          {products.map((product) => (
            <div 
              key={product.id}
              className="w-full sm:w-1/2 lg:w-1/3 flex-shrink-0 px-2"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
      >
        <ChevronLeft className="w-6 h-6 text-gray-600" />
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
      >
        <ChevronRight className="w-6 h-6 text-gray-600" />
      </button>

      <div className="flex justify-center mt-4 space-x-2">
        {Array.from({ length: Math.ceil(products.length / itemsPerSlide) }).map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              Math.floor(currentIndex / itemsPerSlide) === index 
                ? 'bg-blue-600' 
                : 'bg-gray-300'
            }`}
            onClick={() => setCurrentIndex(index * itemsPerSlide)}
          />
        ))}
      </div>
    </div>
  );
};

export default FeaturedProductSlider;