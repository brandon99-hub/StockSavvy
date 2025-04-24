// @ts-ignore
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../../hooks/use-toast';
import { AlertCircle, Pencil, Save, Trash2, X } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";

// Define Category interface
interface Category {
    id: number;
    name: string;
}

const CategoryManager = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [newCategory, setNewCategory] = useState<string>('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Fetch categories
    const { data: categories, isLoading, error } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            try {
                const data = await apiRequest('/api/categories/', { method: 'GET' });
                return data as Category[];
            } catch (err) {
                setErrorMessage("You don't have permission to view categories");
                return [] as Category[];
            }
        },
    });

    // Create category mutation
    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            return await apiRequest('/api/categories/', {
                method: 'POST',
                body: JSON.stringify({ name }),
            });
        },
        onSuccess: () => {
            toast({
                title: 'Success',
                description: 'Category created successfully',
            });
            setNewCategory('');
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: `Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: 'destructive',
            });
        },
    });

    // Update category mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, name }: { id: number; name: string }) => {
            return await apiRequest(`/api/categories/${id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ name }),
            });
        },
        onSuccess: () => {
            toast({
                title: 'Success',
                description: 'Category updated successfully',
            });
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: `Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: 'destructive',
            });
        },
    });

    // Delete category mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            setDeleteError(null); // Clear any previous errors
            try {
                return await apiRequest(`/api/categories/${id}/`, {
                    method: 'DELETE',
                });
            } catch (error: any) {
                // Extract error message from response
                const errorMessage = error.response?.data?.detail || 
                    (error instanceof Error ? error.message : 'Unknown error');

                // Set the error state for the dialog
                setDeleteError(errorMessage);

                // Rethrow to trigger onError
                throw error;
            }
        },
        onSuccess: () => {
            toast({
                title: 'Success',
                description: 'Category deleted successfully',
            });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setCategoryToDelete(null); // Close the dialog
        },
        onError: (error) => {
            // Only show toast for errors that aren't displayed in the dialog
            if (!deleteError) {
                toast({
                    title: 'Error',
                    description: `Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: 'destructive',
                });
                setCategoryToDelete(null); // Close the dialog for unexpected errors
            }
            // For errors handled in the dialog, keep the dialog open
        },
    });

    // Add new category
    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory.trim()) {
            toast({
                title: 'Error',
                description: 'Category name cannot be empty',
                variant: 'destructive',
            });
            return;
        }
        createMutation.mutate(newCategory);
    };

    // Start editing a category
    const handleEditStart = (category: Category) => {
        setEditingId(category.id);
        setEditName(category.name);
    };

    // Cancel editing
    const handleEditCancel = () => {
        setEditingId(null);
    };

    // Save edited category
    const handleEditSave = (id: number) => {
        if (!editName.trim()) {
            toast({
                title: 'Error',
                description: 'Category name cannot be empty',
                variant: 'destructive',
            });
            return;
        }
        updateMutation.mutate({ id, name: editName });
    };

    // Delete a category
    const handleDelete = (category: Category) => {
        setCategoryToDelete(category);
    };

    const confirmDelete = () => {
        if (categoryToDelete) {
            deleteMutation.mutate(categoryToDelete.id);
            // Don't close the dialog here, it will be closed in onSuccess
            // or kept open in onError to show the error message
        }
    };

    if (isLoading) {
        return <div>Loading categories...</div>;
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Manage Categories</CardTitle>
            </CardHeader>
            <CardContent>
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        <span>Error loading categories: {errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleAddCategory} className="flex items-center space-x-2 mb-6">
                    <Input
                        placeholder="New category name"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="flex-1"
                    />
                    <Button 
                        type="submit" 
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? 'Adding...' : 'Add Category'}
                    </Button>
                </form>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                                    No categories found. Add a new category to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            categories?.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell>
                                        {editingId === category.id ? (
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            category.name
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {editingId === category.id ? (
                                            <div className="flex justify-end space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleEditSave(category.id)}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleEditCancel}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end space-x-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEditStart(category)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(category)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Delete Confirmation Dialog */}
                <AlertDialog 
                    open={!!categoryToDelete} 
                    onOpenChange={(open) => {
                        if (!open) {
                            setCategoryToDelete(null);
                            setDeleteError(null);
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {deleteError ? 'Cannot Delete Category' : 'Delete Category'}
                            </AlertDialogTitle>
                            {deleteError ? (
                                <div>
                                    <AlertDialogDescription className="text-red-500 font-medium mb-2">
                                        {deleteError}
                                    </AlertDialogDescription>
                                    <AlertDialogDescription>
                                        Categories that have associated products cannot be deleted to maintain data integrity.
                                        Consider reassigning products to a different category before deleting this one.
                                    </AlertDialogDescription>
                                </div>
                            ) : (
                                <AlertDialogDescription>
                                    Are you sure you want to delete the category "{categoryToDelete?.name}"? 
                                    This action cannot be undone and may affect products assigned to this category.
                                </AlertDialogDescription>
                            )}
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>
                                {deleteError ? 'Close' : 'Cancel'}
                            </AlertDialogCancel>
                            {!deleteError && (
                                <AlertDialogAction
                                    onClick={confirmDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                            )}
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
};

export default CategoryManager;
