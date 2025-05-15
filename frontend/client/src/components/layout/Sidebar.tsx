import {Link, useLocation} from "wouter";
import {useAuth} from "../../lib/auth";
import logo from '../../../assets/appstore_logo.png';

const Sidebar = ({isMobile, setMobileOpen}: { isMobile?: boolean; setMobileOpen?: (open: boolean) => void }) => {
    const [location] = useLocation();
    const {user} = useAuth();

    const isActive = (path: string) => {
        return location === path ? "bg-gray-700" : "";
    };

    const closeMobileMenu = () => {
        if (isMobile && setMobileOpen) {
            setMobileOpen(false);
        }
    };

    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    return (
        <div className="bg-gray-800 text-white w-full h-full flex flex-col">
            {/* Logo */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                    <img src={logo} alt="Working Wave Logo" className="w-8 h-8" />
                    <h1 className="text-xl font-bold">Working Wave</h1>
                </div>
                <p className="text-xs text-gray-400 mt-1">Stock Management System</p>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium">
                            {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-400 capitalize">{user?.role || 'Guest'}</p>
                    </div>
                </div>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-2 p-4">
                    <li>
                        <Link
                            href="/dashboard"
                            onClick={closeMobileMenu}
                            className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/dashboard")}`}
                        >
                            <i className="fas fa-tachometer-alt w-6"></i>
                            <span>Dashboard</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/inventory"
                            onClick={closeMobileMenu}
                            className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/inventory")}`}
                        >
                            <i className="fas fa-boxes w-6"></i>
                            <span>Inventory</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/sales"
                            onClick={closeMobileMenu}
                            className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/sales")}`}
                        >
                            <i className="fas fa-shopping-cart w-6"></i>
                            <span>Sales</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/reports"
                            onClick={closeMobileMenu}
                            className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/reports")}`}
                        >
                            <i className="fas fa-chart-bar w-6"></i>
                            <span>Reports</span>
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/forecasts"
                            onClick={closeMobileMenu}
                            className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/forecasts")}`}
                        >
                            <i className="fas fa-chart-pie w-6"></i>
                            <span>Forecasts</span>
                        </Link>
                    </li>
                    {isAdmin && (
                        <>
                            <li>
                                <Link
                                    href="/analytics"
                                    onClick={closeMobileMenu}
                                    className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/analytics")}`}
                                >
                                    <i className="fas fa-chart-line w-6"></i>
                                    <span>Advanced Analytics</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/users"
                                    onClick={closeMobileMenu}
                                    className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/users")}`}
                                >
                                    <i className="fas fa-users w-6"></i>
                                    <span>Users</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/manage-categories"
                                    onClick={closeMobileMenu}
                                    className={`flex items-center p-3 text-gray-300 hover:bg-gray-700 rounded-lg ${isActive("/manage-categories")}`}
                                >
                                    <i className="fas fa-tags w-6"></i>
                                    <span>Manage Categories</span>
                                </Link>
                            </li>
                        </>
                    )}
                </ul>
            </nav>
        </div>
    );
};

export default Sidebar;
