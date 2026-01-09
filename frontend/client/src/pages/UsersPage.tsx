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
  DialogTrigger,
} from "../components/ui/dialog";
import { UserPlus, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

const UsersPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Get shop filter from URL
  const queryParams = new URLSearchParams(window.location.search);
  const shopFilter = queryParams.get('shop');

  // Use React Query to fetch users
  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['/api/users/', shopFilter],
    queryFn: () => apiRequest(`/api/users/${shopFilter ? `?shop=${shopFilter}` : ''}`, { method: "GET" }),
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
    <div className="container mx-auto py-8 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 p-6 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-xl shadow-inner">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Identity Control</h1>
            <p className="text-sm text-slate-500 font-medium">Manage system access and roles</p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 px-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center gap-2"
              onClick={() => setEditingUser(null)}
            >
              <UserPlus className="h-5 w-5" />
              Provision Identity
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-none p-0 bg-transparent shadow-none [&>button]:hidden">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar relative">
              <AddUserForm
                initialData={editingUser}
                onSuccess={editingUser ? handleUserUpdated : handleUserAdded}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Close
              </Button>
            </div>
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
