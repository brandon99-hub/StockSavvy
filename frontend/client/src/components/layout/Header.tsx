import {useState} from "react";
import {useAuth} from "../../lib/auth";
import {useToast} from "../../hooks/use-toast";
import {useQueryClient, useQuery} from "@tanstack/react-query";
import {formatDistanceToNow} from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../ui/dropdown-menu";
import {Activity} from "../../../../shared/schema";

interface HeaderProps {
    toggleSidebar: () => void;
}

const Header = ({toggleSidebar}: HeaderProps) => {
    const {user, logout} = useAuth();
    const {toast} = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [readNotifications, setReadNotifications] = useState<Set<number>>(new Set());

    // Fetch activities from the /api/activities endpoint
    const {data: activities = []} = useQuery<Activity[]>({
        queryKey: ['/api/activities/'],
        select: (data) => data.filter(activity =>
            ['stock_added', 'stock_removed', 'order', 'restock_order', 'sale'].includes(activity.type)
        )
    });

    // Get unread count
    const unreadCount = activities.filter(
        activity => !readNotifications.has(activity.id)
    ).length;

    // Notification type mapping
    const getNotificationMeta = (type: string) => {
        switch (type) {
            case 'stock_added':
                return {icon: 'fas fa-arrow-up', color: 'bg-green-100 text-green-500'};
            case 'stock_removed':
                return {icon: 'fas fa-arrow-down', color: 'bg-red-100 text-red-500'};
            case 'order':
                return {icon: 'fas fa-box', color: 'bg-blue-100 text-blue-500'};
            case 'restock_order':
                return {icon: 'fas fa-truck', color: 'bg-purple-100 text-purple-500'};
            case 'sale':
                return {icon: 'fas fa-shopping-cart', color: 'bg-orange-100 text-orange-500'};
            default:
                return {icon: 'fas fa-info-circle', color: 'bg-gray-100 text-gray-500'};
        }
    };

    const handleLogout = () => {
        logout();
        queryClient.clear();
        toast({
            title: "Logged out",
            description: "You have been successfully logged out.",
        });
    };

    const markAllAsRead = () => {
        const newRead = new Set([...readNotifications, ...activities.map(a => a.id)]);
        setReadNotifications(newRead);
    };

    return (
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
            <div className="flex items-center md:hidden">
                <button
                    className="text-gray-600 hover:text-gray-900"
                    onClick={toggleSidebar}
                >
                    <i className="fas fa-bars"></i>
                </button>
            </div>

            <div className="flex-1 md:ml-4">
                <div className="relative max-w-md">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                        <i className="fas fa-search"></i>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="relative p-2 text-gray-600 hover:text-gray-900">
                            <i className="fas fa-bell"></i>
                            {unreadCount > 0 && (
                                <span
                                    className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {unreadCount}
                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <div className="p-2 border-b border-gray-100 flex justify-between items-center">
                            <h4 className="text-sm font-semibold">System Notifications</h4>
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
                                Mark all as read
                            </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {activities.map(activity => {
                                const meta = getNotificationMeta(activity.type);
                                const isUnread = !readNotifications.has(activity.id);

                                return (
                                    <DropdownMenuItem
                                        key={activity.id}
                                        className="p-3 hover:bg-gray-50 relative"
                                        onSelect={() => {
                                            setReadNotifications(prev => new Set([...prev, activity.id]));
                                            toast({
                                                title: "Activity Details",
                                                description: activity.description,
                                            });
                                        }}
                                    >
                                        {isUnread && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                        )}
                                        <div className="flex items-start w-full">
                                            <div
                                                className={`rounded-full h-8 w-8 flex items-center justify-center ${meta.color} mr-3`}>
                                                <i className={`${meta.icon} text-sm`}></i>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">
                                                    {activity.type.replace(/_/g, ' ').toUpperCase()}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{activity.description}</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {activity.created_at ? formatDistanceToNow(new Date(activity.created_at), {addSuffix: true}) : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                );
                            })}
                            {activities.length === 0 && (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    No new notifications
                                </div>
                            )}
                        </div>
                        <DropdownMenuSeparator/>
                        <div className="p-2 text-center">
                            <button
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                onClick={() => {
                                    toast({
                                        title: "All Activities",
                                        description: "Redirecting to activities page...",
                                    });
                                }}
                            >
                                View all activities
                            </button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center space-x-2 focus:outline-none">
                            <span className="hidden md:block text-sm">{user?.name || 'User'}</span>
                            <i className="fas fa-chevron-down text-xs"></i>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => {
                            toast({
                                title: "Profile Accessed",
                                description: `Welcome to your dashboard, ${user?.name || 'User'}!`,
                                variant: "default",
                            });
                        }}>
                            <i className="fas fa-user mr-2"></i> Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                            toast({
                                title: "Settings Panel",
                                description: "System preferences and user settings are now configurable.",
                                variant: "default",
                            });
                        }}>
                            <i className="fas fa-cog mr-2"></i> Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem onClick={handleLogout}>
                            <i className="fas fa-sign-out-alt mr-2"></i> Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};

export default Header;