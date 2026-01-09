// @ts-ignore
import React, { useState } from "react";
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../hooks/use-toast';
import { User } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useAuth } from '../../lib/auth';
import { Pencil, Trash2, Mail, User as UserIcon, Shield, Calendar, Search, Users, Store } from "lucide-react";
import { Input } from "../ui/input";

interface UsersListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: number) => Promise<void>;
}

const UsersList = ({ users, onEdit, onDelete }: UsersListProps) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.shop_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle delete button click
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Confirm delete action
  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        setIsDeleting(true);
        await onDelete(userToDelete.id);
        toast({
          title: 'User deleted',
          description: 'The user has been deleted successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive',
        });
      } finally {
        setIsDeleting(false);
        setDeleteDialogOpen(false);
      }
    }
  };

  // Get role badge color
  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'secondary';
      case 'staff':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <>
      <Card className="shadow-lg border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Users className="h-5 w-5 text-primary" />
              Manage Users
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search identity..."
                className="pl-9 bg-white border-slate-200 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                    Identity
                  </div>
                </TableHead>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    Contact
                  </div>
                </TableHead>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                  <div className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-slate-400" />
                    Branch
                  </div>
                </TableHead>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-slate-400" />
                    Authority
                  </div>
                </TableHead>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Provisioned
                  </div>
                </TableHead>
                <TableHead className="py-4 px-6 font-semibold text-slate-900 border-none text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="group hover:bg-slate-50 transition-colors border-slate-100">
                  <TableCell className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{user.name}</span>
                      <span className="text-xs text-slate-500 font-mono tracking-tighter">@{user.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <span className="text-sm text-slate-600">{user.email || '—'}</span>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${user.shop_name ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                        {user.shop_name || 'Central HQ'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize px-3 py-0.5 font-medium shadow-sm">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-sm text-slate-600">
                    {new Date(user.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-full"
                        onClick={() => onEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/5 rounded-full"
                        onClick={() => handleDeleteClick(user)}
                        disabled={isDeleting && userToDelete?.id === user.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="h-10 w-10 text-slate-100" />
                      No identity records found matching your query.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the user "{userToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersList;
