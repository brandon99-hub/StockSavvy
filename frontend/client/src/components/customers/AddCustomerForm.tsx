import React from 'react';
import { useForm } from 'react-hook-form';
import { Customer, Shop } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { User as UserIcon, Phone, CreditCard, Store, Shield, DollarSign } from 'lucide-react';
import { Badge } from '../ui/badge';

interface AddCustomerFormProps {
    initialData?: Customer | null;
    shops: Shop[];
    isAdmin: boolean;
    userShop?: number;
    onSubmit: (data: any) => void;
    onCancel: () => void;
    isLoading: boolean;
}

export function AddCustomerForm({
    initialData,
    shops,
    isAdmin,
    userShop,
    onSubmit,
    onCancel,
    isLoading
}: AddCustomerFormProps) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
            id_number: formData.get('id_number') as string,
            credit_limit: Number(formData.get('credit_limit')),
            shop: formData.get('shop') ? Number(formData.get('shop')) : userShop,
            status: initialData?.status || 'active',
        };

        const payAmount = Number(formData.get('pay_amount'));
        if (payAmount > 0) {
            data.payment = {
                amount: payAmount,
                method: formData.get('pay_method'),
                notes: formData.get('pay_notes'),
            };
        }
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Identity Name
                        </Label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                id="name"
                                name="name"
                                defaultValue={initialData?.name}
                                required
                                placeholder="e.g., John Doe"
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Communication (Phone)
                        </Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                id="phone"
                                name="phone"
                                defaultValue={initialData?.phone}
                                required
                                placeholder="e.g., +254 700 000 000"
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="id_number" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            National ID / Passport
                        </Label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                id="id_number"
                                name="id_number"
                                defaultValue={initialData?.id_number}
                                placeholder="e.g., 12345678"
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="credit_limit" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Credit Limit (KES)
                        </Label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                id="credit_limit"
                                name="credit_limit"
                                type="number"
                                step="0.01"
                                defaultValue={initialData?.credit_limit || 0}
                                placeholder="0.00"
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isAdmin && (
                <div className="space-y-2">
                    <Label htmlFor="shop" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Assigned Branch
                    </Label>
                    <div className="relative">
                        <Store className="absolute left-3 top-2.5 h-4 w-4 z-10 text-slate-400" />
                        <Select name="shop" defaultValue={initialData?.shop?.toString() || userShop?.toString()}>
                            <SelectTrigger className="pl-10">
                                <SelectValue placeholder="Select shop" />
                            </SelectTrigger>
                            <SelectContent>
                                {shops.map(shop => (
                                    <SelectItem key={shop.id} value={shop.id.toString()}>
                                        {shop.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {initialData && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-green-800 font-bold flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Record New Payment
                        </Label>
                        <Badge variant="outline" className="bg-white text-green-700 border-green-200">
                            Balance: KES {initialData.current_balance.toLocaleString()}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pay_amount" className="text-[10px] font-bold uppercase text-green-600">Amount to Pay</Label>
                            <Input
                                id="pay_amount"
                                name="pay_amount"
                                type="number"
                                placeholder="0.00"
                                className="border-green-200 focus:border-green-500 focus:ring-green-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pay_method" className="text-[10px] font-bold uppercase text-green-600">Method</Label>
                            <Select name="pay_method" defaultValue="Cash">
                                <SelectTrigger className="border-green-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                                    <SelectItem value="Bank">Bank Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pay_notes" className="text-[10px] font-bold uppercase text-green-600">Internal Memo / Notes</Label>
                        <Input
                            id="pay_notes"
                            name="pay_notes"
                            placeholder="e.g., Check #1234 or M-Pesa ref..."
                            className="border-green-200 focus:border-green-500 focus:ring-green-500/20"
                        />
                    </div>
                    <p className="text-[10px] text-green-700 italic">
                        Recording a payment will immediately decrease the customer's outstanding balance and create a history record.
                    </p>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="text-slate-500 hover:text-slate-900"
                >
                    Discard
                </Button>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-slate-900 text-white hover:bg-slate-800 px-8 shadow-lg shadow-slate-200"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin border-2 border-white/30 border-t-white rounded-full" />
                            Saving...
                        </div>
                    ) : (
                        initialData ? 'Update Record' : 'Provision Customer'
                    )}
                </Button>
            </div>
        </form>
    );
}
