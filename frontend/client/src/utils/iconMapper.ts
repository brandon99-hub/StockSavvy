import { LucideIcon, ShoppingCart, Shirt, Dumbbell, ShoppingBag, Watch, Phone, Laptop, Headphones, Camera, Utensils, Coffee, Wine, Gift, Star, Pen } from 'lucide-react';
import { PencilIcon, PencilSquareIcon, ShoppingBagIcon } from '@heroicons/react/24/solid';
import BookRoundedIcon from '@mui/icons-material/BookRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';

// Use Heroicons for pen, pencil, shoe, and hat (as examples)
// PencilIcon for pencil, PencilSquareIcon for pen, ShoppingBagIcon for shoe/footwear

interface IconMapping {
  keywords: string[];
  icon: any; // Accept both LucideIcon and Heroicon
  category?: string;
}

// Define icon mappings with keywords and categories
const iconMappings: IconMapping[] = [
  // Clothing
  { keywords: ['shirt', 't-shirt', 'tshirt', 'blouse', 'top'], icon: Shirt, category: 'clothing' },
  // Footwear (use ShoppingBagIcon from Heroicons)
  { keywords: ['shoe', 'sneaker', 'boot', 'footwear'], icon: ShoppingBagIcon, category: 'footwear' },
  // Accessories (use Gift as fallback)
  { keywords: ['hat', 'cap', 'beanie'], icon: Gift, category: 'accessories' },
  
  // Electronics
  { keywords: ['phone', 'mobile', 'smartphone'], icon: Phone, category: 'electronics' },
  { keywords: ['laptop', 'computer', 'notebook'], icon: Laptop, category: 'electronics' },
  { keywords: ['headphone', 'earphone', 'earbud'], icon: Headphones, category: 'electronics' },
  { keywords: ['camera', 'dslr', 'mirrorless'], icon: Camera, category: 'electronics' },
  
  // Stationery
  { keywords: ['pen'], icon: PencilSquareIcon, category: 'stationery' },
  { keywords: ['pencil'], icon: PencilIcon, category: 'stationery' },
  { keywords: ['marker'], icon: Pen, category: 'stationery' },
  { keywords: ['book', 'notebook', 'diary'], icon: BookRoundedIcon, category: 'stationery' },
  
  // Food & Beverages
  { keywords: ['coffee', 'tea', 'beverage'], icon: Coffee, category: 'food' },
  { keywords: ['wine', 'beer', 'alcohol'], icon: Wine, category: 'food' },
  { keywords: ['utensil', 'cutlery', 'kitchen'], icon: Utensils, category: 'food' },
  
  // General
  { keywords: ['gift', 'present'], icon: Gift, category: 'general' },
  { keywords: ['watch', 'clock', 'timepiece'], icon: Watch, category: 'accessories' },
  { keywords: ['package', 'box', 'container', 'cardboard'], icon: Inventory2RoundedIcon, category: 'general' },
  { keywords: ['bag', 'backpack', 'purse'], icon: ShoppingBag, category: 'accessories' },
  { keywords: ['dumbbell', 'weight', 'fitness'], icon: Dumbbell, category: 'sports' },
];

// Fallback icons for different categories
const categoryFallbacks: Record<string, any> = {
  clothing: Shirt,
  footwear: ShoppingBagIcon,
  electronics: Phone,
  stationery: PencilIcon,
  food: Utensils,
  accessories: ShoppingBag,
  sports: Dumbbell,
  general: Inventory2RoundedIcon,
};

export function getProductIcon(productName: string, category?: string): any {
  // Convert product name to lowercase for case-insensitive matching
  const normalizedName = productName.toLowerCase();
  
  // First try to match by product name keywords
  for (const mapping of iconMappings) {
    if (mapping.keywords.some(keyword => normalizedName.includes(keyword))) {
      return mapping.icon;
    }
  }
  
  // If no match found and category is provided, use category fallback
  if (category) {
    const normalizedCategory = category.toLowerCase();
    for (const [cat, icon] of Object.entries(categoryFallbacks)) {
      if (normalizedCategory.includes(cat)) {
        return icon;
      }
    }
  }
  
  // If still no match, use default fallback
  return Inventory2RoundedIcon;
}

// Helper function to get icon color based on category
export function getIconColor(category?: string): string {
  // Use a neutral color for all icons
  return 'text-gray-700';
} 