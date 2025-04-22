import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/types/product';
import { ProductBatches } from '@/components/inventory/ProductBatches';
import apiClient from '@/lib/api';

export const ProductDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProduct();
    }, [id]);

    const fetchProduct = async () => {
        try {
            const response = await apiClient.get(`/api/products/${id}/`);
            setProduct(response.data);
        } catch (err) {
            setError('Failed to fetch product details');
            console.error('Error fetching product:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading product details...</div>;
    if (error) return <div className="text-red-500">{error}</div>;
    if (!product) return <div>Product not found</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Product Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold">Name</h3>
                            <p>{product.name}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">SKU</h3>
                            <p>{product.sku}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Category</h3>
                            <p>{product.category}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Quantity</h3>
                            <p>{product.quantity}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Buy Price</h3>
                            <p>{formatCurrency(product.buy_price)}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Sell Price</h3>
                            <p>{formatCurrency(product.sell_price)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <ProductBatches productId={product.id} />
        </div>
    );
}; 