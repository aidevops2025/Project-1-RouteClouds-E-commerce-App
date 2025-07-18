import React from 'react';
import { Link } from 'react-router-dom';
import { Category } from '../../types';

interface CategoryNavProps {
  categories: Category[];
}

const CategoryNav: React.FC<CategoryNavProps> = ({ categories }) => {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex space-x-8 h-14">
          {categories.map((category) => (
            <li key={category.id} className="relative group">
              <Link
                to={`/category/${category.slug}`}
                className="inline-flex items-center h-14 text-gray-700 hover:text-blue-600"
              >
                {category.name}
              </Link>
              {category.children && category.children.length > 0 && (
                <div className="absolute hidden group-hover:block w-48 left-0 top-full bg-white shadow-lg rounded-md py-2">
                  {category.children.map((subCategory) => (
                    <Link
                      key={subCategory.id}
                      to={`/category/${subCategory.slug}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {subCategory.name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default CategoryNav;