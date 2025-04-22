import api from '../lib/api';
import { ProductBatch, BatchSaleItem } from '@/types/batch';

const BASE_URL = '/api';

export const batchService = {
  // Get all batches for a product
  getProductBatches: async (productId: number): Promise<ProductBatch[]> => {
    try {
      const response = await api.get(`${BASE_URL}/product-batches/?product_id=${productId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
  },

  // Create a new batch
  createBatch: async (batchData: Omit<ProductBatch, 'id'>): Promise<ProductBatch> => {
    try {
      const response = await api.post(`${BASE_URL}/product-batches/`, batchData);
      return response.data;
    } catch (error) {
      console.error('Error creating batch:', error);
      throw error;
    }
  },

  // Update a batch
  updateBatch: async (batchId: number, batchData: Partial<ProductBatch>): Promise<ProductBatch> => {
    try {
      const response = await api.patch(`${BASE_URL}/product-batches/${batchId}/`, batchData);
      return response.data;
    } catch (error) {
      console.error('Error updating batch:', error);
      throw error;
    }
  },

  // Delete a batch
  deleteBatch: async (batchId: number): Promise<void> => {
    try {
      await api.delete(`${BASE_URL}/product-batches/${batchId}/`);
    } catch (error) {
      console.error('Error deleting batch:', error);
      throw error;
    }
  },

  // Get batch sale items for a sale
  getBatchSaleItems: async (saleId: number): Promise<BatchSaleItem[]> => {
    try {
      const response = await api.get(`${BASE_URL}/batch-sale-items/?sale_id=${saleId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batch sale items:', error);
      throw error;
    }
  },

  // Create batch sale items
  createBatchSaleItem: async (saleItemData: Omit<BatchSaleItem, 'id'>): Promise<BatchSaleItem> => {
    try {
      const response = await api.post(`${BASE_URL}/batch-sale-items/`, saleItemData);
      return response.data;
    } catch (error) {
      console.error('Error creating batch sale item:', error);
      throw error;
    }
  },

  // Get batch stats for a product
  getBatchStats: async (productId: number): Promise<any> => {
    try {
      const response = await api.get(`${BASE_URL}/product-batches/stats/?product_id=${productId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batch stats:', error);
      throw error;
    }
  }
}; 