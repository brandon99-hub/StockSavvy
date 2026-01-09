import { Link, useLocation } from "wouter";
import { useAuth } from "../../lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BarChart3,
    CreditCard,
    Users,
    TrendingUp,
    LineChart,
    UserCog,
    Store,
    Tags,
    ChevronRight,
    ChevronLeft,
    Menu
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import logo from '../../../assets/appstore_logo.png';

interface NavItem {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const Sidebar = ({ isMobile, setMobileOpen }: { isMobile?: boolean; setMobileOpen?: (open: boolean) => void }) => {
    const [location] = useLocation();
    const { user } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        // Load collapsed state from localStorage
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        // Save collapsed state to localStorage
        localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    }, [isCollapsed]);

    const isActive = (path: string) => {
        return location === path;
    };

    const closeMobileMenu = () => {
        if (isMobile && setMobileOpen) {
            setMobileOpen(false);
        }
    };

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    const isAdmin = user?.role === 'admin';

    const navSections: NavSection[] = [
        {
            title: "Core",
            items: [
                { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                { path: "/pos", label: "Point of Sale", icon: CreditCard },
            ]
        },
        {
            title: "Management",
            items: [
                { path: "/inventory", label: "Inventory", icon: Package },
                { path: "/sales", label: "Sales", icon: ShoppingCart },
                { path: "/customers", label: "Customers", icon: Users },
                { path: "/manage-categories", label: "Categories", icon: Tags, adminOnly: true },
            ]
        },
        {
            title: "Insights",
            items: [
                { path: "/reports", label: "Reports", icon: BarChart3 },
                { path: "/forecasts", label: "Forecasts", icon: TrendingUp },
                { path: "/analytics", label: "Advanced Analytics", icon: LineChart, adminOnly: true },
            ]
        },
        {
            title: "Admin",
            items: [
                { path: "/users", label: "Users", icon: UserCog, adminOnly: true },
                { path: "/shops", label: "Shops", icon: Store, adminOnly: true },
            ]
        }
    ];

    return (
        <TooltipProvider delayDuration={300}>
            <motion.div
                className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white h-full flex flex-col relative overflow-hidden"
                animate={{ width: isCollapsed && !isMobile ? '80px' : '256px' }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
            >
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full">
                    {/* Logo Section */}
                    <motion.div
                        className="p-6 border-b border-white/10 flex items-center justify-between"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-0.5 flex-shrink-0">
                                <div className="w-full h-full rounded-xl bg-gray-900 flex items-center justify-center">
                                    <img src={logo} alt="Working Wave Logo" className="w-6 h-6" />
                                </div>
                            </div>
                            <AnimatePresence>
                                {!isCollapsed && (
                                    <motion.div
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: "auto" }}
                                        exit={{ opacity: 0, width: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                                            Working Wave
                                        </h1>
                                        <p className="text-xs text-gray-400 whitespace-nowrap">Stock Management</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Collapse Toggle Button - Desktop Only */}
                        {!isMobile && (
                            <motion.button
                                onClick={toggleCollapse}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                                )}
                            </motion.button>
                        )}
                    </motion.div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {navSections.map((section, sectionIdx) => {
                            const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
                            if (visibleItems.length === 0) return null;

                            return (
                                <motion.div
                                    key={section.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: sectionIdx * 0.1 }}
                                >
                                    <AnimatePresence>
                                        {!isCollapsed && (
                                            <motion.h3
                                                className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                {section.title}
                                            </motion.h3>
                                        )}
                                    </AnimatePresence>
                                    <ul className="space-y-1">
                                        {visibleItems.map((item) => {
                                            const Icon = item.icon;
                                            const active = isActive(item.path);

                                            const navItem = (
                                                <Link
                                                    href={item.path}
                                                    onClick={closeMobileMenu}
                                                >
                                                    <motion.div
                                                        className={`
                              group relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-lg cursor-pointer
                              transition-all duration-200
                              ${active
                                                                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/20'
                                                                : 'text-gray-300 hover:bg-white/5'
                                                            }
                            `}
                                                        whileHover={{ x: isCollapsed ? 0 : 4 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                                                            <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-300'}`} />
                                                            <AnimatePresence>
                                                                {!isCollapsed && (
                                                                    <motion.span
                                                                        className="text-sm font-medium whitespace-nowrap"
                                                                        initial={{ opacity: 0, width: 0 }}
                                                                        animate={{ opacity: 1, width: "auto" }}
                                                                        exit={{ opacity: 0, width: 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                    >
                                                                        {item.label}
                                                                    </motion.span>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                        {active && !isCollapsed && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                transition={{ duration: 0.2 }}
                                                            >
                                                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                                            </motion.div>
                                                        )}
                                                        {active && (
                                                            <motion.div
                                                                className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full"
                                                                layoutId="activeIndicator"
                                                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                            />
                                                        )}
                                                    </motion.div>
                                                </Link>
                                            );

                                            return (
                                                <li key={item.path}>
                                                    {isCollapsed ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                {navItem}
                                                            </TooltipTrigger>
                                                            <TooltipContent
                                                                side="right"
                                                                className="bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700 text-white shadow-xl"
                                                            >
                                                                <p className="font-medium">{item.label}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        navItem
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </motion.div>
                            );
                        })}
                    </nav>

                    {/* User Profile Section */}
                    <motion.div
                        className="p-4 border-t border-white/10 bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-xl"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group`}>
                                    <div className="relative flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/20 group-hover:ring-white/40 transition-all">
                                            <span className="text-sm font-bold">
                                                {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                                            </span>
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                                    </div>
                                    <AnimatePresence>
                                        {!isCollapsed && (
                                            <motion.div
                                                className="flex-1 min-w-0"
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: "auto" }}
                                                exit={{ opacity: 0, width: 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <p className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</p>
                                                <p className="text-xs text-gray-400 capitalize">{user?.role || 'Guest'}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </TooltipTrigger>
                            {isCollapsed && (
                                <TooltipContent
                                    side="right"
                                    className="bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700 text-white shadow-xl"
                                >
                                    <p className="font-semibold">{user?.name || 'User'}</p>
                                    <p className="text-xs text-gray-400 capitalize">{user?.role || 'Guest'}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </motion.div>
                </div>
            </motion.div>
        </TooltipProvider>
    );
};

export default Sidebar;
