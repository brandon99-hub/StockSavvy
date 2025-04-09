// @ts-ignore
import React, { useState } from "react";
import { User } from "../types";
import { useToast } from "../hooks/use-toast";
import UsersList from "../components/users/UsersList";
import AddUserForm from "../components/users/AddUserForm";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

const UsersPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Use React Query to fetch users
  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['/api/users/'],
    queryFn: () => apiRequest("/api/users/", { method: "GET" }),
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message === 'Authentication required') {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/users/${userId}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to delete user. You may not have permission for this action.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (userId: number) => {
    deleteUserMutation.mutate(userId);
  };

  const handleUserAdded = (newUser: User) => {
    queryClient.invalidateQueries({ queryKey: ['/api/users/'] });
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "User created successfully",
    });
  };

  const handleUserUpdated = (updatedUser: User) => {
    queryClient.invalidateQueries({ queryKey: ['/api/users/'] });
    setEditingUser(null);
    toast({
      title: "Success",
      description: "User updated successfully",
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading users...</div>
    </div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-red-500">
        {error instanceof Error 
          ? error.message 
          : "Error loading users. Please try again later."}
      </div>
    </div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
            </DialogHeader>
            <AddUserForm
              initialData={editingUser}
              onSuccess={editingUser ? handleUserUpdated : handleUserAdded}
            />
          </DialogContent>
        </Dialog>
      </div>
      <UsersList
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default UsersPage;
