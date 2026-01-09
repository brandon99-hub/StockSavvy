import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { User, Shop } from "../../types/index";
import { useAuth } from "../../lib/auth";
import { useQuery } from "@tanstack/react-query";
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
import {
  User as UserIcon,
  Mail,
  Shield,
  Store,
  Lock,
  Loader2,
  Fingerprint,
  Users
} from "lucide-react";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  shop: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserFormProps {
  initialData?: User | null;
  onSuccess: (user: User) => void;
}

const AddUserForm = ({ initialData, onSuccess }: AddUserFormProps) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.can_access_all_shops;

  // Fetch shops
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['/api/shops/'],
    queryFn: () => apiRequest('/api/shops/'),
    enabled: isAdmin,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      role: "staff",
      shop: "none",
      password: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        username: initialData.username,
        name: initialData.name,
        email: initialData.email || "",
        role: initialData.role,
        shop: initialData.shop?.toString() || "none",
        password: "",
      });
    }
  }, [initialData, form]);

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsLoading(true);
      const userData: any = {
        ...data,
        is_staff: data.role === 'admin',
        is_superuser: data.role === 'admin',
        // Convert shop to number if provided
        shop: data.shop && data.shop !== 'none' ? Number(data.shop) : (isAdmin ? null : currentUser?.shop),
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
    <div className="space-y-6 py-2">
      {/* Decorative Header */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 text-white shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors" />
        <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm shadow-inner group-hover:scale-110 transition-transform duration-500">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-xl font-bold tracking-tight">
            {initialData ? 'Update Profile' : 'Identity Registry'}
          </h2>
          <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-medium">
            System Account Provisioning
          </p>
        </div>
        <div className="ml-auto opacity-20 transform translate-x-2">
          <Fingerprint className="h-12 w-12" />
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm" placeholder="Enter username" {...field} />
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
                  <FormLabel className="flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-primary" />
                    Display Name
                  </FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm" placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input type="email" className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm" placeholder="user@stocksavvy.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    System Role
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm">
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

            {isAdmin && (
              <FormField
                control={form.control}
                name="shop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-primary" />
                      Assigned Location
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm">
                          <SelectValue placeholder="Select shop (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No shop assigned</SelectItem>
                        {shops.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id.toString()}>
                            {shop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  {initialData ? "Access Key (Optional)" : "Access Key"}
                </FormLabel>
                <FormControl>
                  <Input type="password" className="bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm" placeholder={initialData ? "Leave empty to keep current" : "Set secure password"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData ? "Synchronizing..." : "Provisioning..."}
                </>
              ) : (
                initialData ? "Commit Changes" : "Initialize Identity"
              )}
            </Button>
          </div>

          <div className="pt-2 text-center">
            <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1.5 uppercase tracking-widest">
              <span className="w-8 h-[1px] bg-slate-100" />
              StockSavvy Identity v2.0
              <span className="w-8 h-[1px] bg-slate-100" />
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddUserForm;
