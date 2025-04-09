// @ts-ignore
import React, { useState, useEffect } from "react";
import { User } from "../types";
import { apiRequest } from "../lib/queryClient";
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

const UsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest("/api/users/", { method: "GET" });
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users. You may not have permission to view this data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (userId: number) => {
    try {
      await apiRequest(`/api/users/${userId}/`, { method: "DELETE" });
      setUsers(users.filter((user) => user.id !== userId));
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user. You may not have permission for this action.",
        variant: "destructive",
      });
    }
  };

  const handleUserAdded = (newUser: User) => {
    setUsers([...users, newUser]);
    setIsAddDialogOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map((user) => 
      user.id === updatedUser.id ? updatedUser : user
    ));
    setIsAddDialogOpen(false);
    setEditingUser(null);
  };

  if (isLoading) {
    return <div>Loading users...</div>;
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
