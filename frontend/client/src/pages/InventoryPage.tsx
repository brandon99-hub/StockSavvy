import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchProducts, fetchCategories } from '../services/api';
import InventoryList from '../components/inventory/InventoryList';
import { Product } from '../types';
import { Button, Container, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
    enabled: !!user,
  });

  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: !!user,
  });

  const handleAddProduct = () => {
    navigate('/inventory/add');
  };

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (isLoadingProducts || isLoadingCategories) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (productsError || categoriesError) {
    return (
      <Container>
        <Alert severity="error">
          {productsError ? 'Error loading products' : 'Error loading categories'}
        </Alert>
      </Container>
    );
  }

  if (!products || !categories) {
    return (
      <Container>
        <Alert severity="warning">No data available</Alert>
      </Container>
    );
  }

  return (
    <Container>
      <Box sx={{ my: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Inventory Management
          </Typography>
          {user?.role === 'admin' && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddProduct}
            >
              Add Product
            </Button>
          )}
        </Box>
        <InventoryList
          products={products}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearch={handleSearch}
        />
      </Box>
    </Container>
  );
};

export default InventoryPage;
