// @ts-ignore
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { User } from "../../types";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.string().min(1, "Role is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserFormProps {
  initialData?: User | null;
  onSuccess: (user: User) => void;
}

const AddUserForm = ({ initialData, onSuccess }: AddUserFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      name: "",
      role: "staff",
      password: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        username: initialData.username,
        name: initialData.name,
        role: initialData.role,
        password: "",
      });
    }
  }, [initialData, form]);

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsLoading(true);
      const userData = {
        ...data,
        is_staff: data.role === 'admin',
        is_superuser: data.role === 'admin',
        // Only include password if it's provided (for updates)
        ...((!data.password || data.password.trim() === '') && initialData 
          ? { password: undefined } 
          : {})
      };
      
      // Remove undefined values
      Object.keys(userData).forEach(key => {
        if (userData[key] === undefined) {
          delete userData[key];
        }
      });
      
      const endpoint = initialData ? `/api/users/${initialData.id}/` : "/api/users/";
      const method = initialData ? "PUT" : "POST";
      
      const response = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(userData),
      });

      toast({
        title: "Success",
        description: initialData ? "User updated successfully" : "User created successfully",
      });

      onSuccess(response);
      if (!initialData) {
        form.reset();
      }
    } catch (error) {
      console.error("User operation failed:", error);
      toast({
        title: "Error",
        description: initialData 
          ? "Failed to update user. You may not have permission for this action."
          : "Failed to create user. You may not have permission for this action.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { value: "admin", label: "Administrator" },
    { value: "manager", label: "Manager" },
    { value: "staff", label: "Staff" },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{initialData ? "New Password (leave empty to keep current)" : "Password"}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={initialData ? "Enter new password" : "Enter password"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update User" : "Create User")}
        </Button>
      </form>
    </Form>
  );
};

export default AddUserForm;
