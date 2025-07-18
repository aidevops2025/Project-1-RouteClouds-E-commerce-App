export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  price: number;
  description: string;
  specifications: Record<string, string>;
  images: string[];
  stock: number;
  featured: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
}

export interface User {
  id: string;
  email: string;
  companyName: string;
  role: 'customer' | 'admin';
  firstName: string;
  lastName: string;
}