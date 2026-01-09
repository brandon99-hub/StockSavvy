from rest_framework import permissions

class IsSystemAdmin(permissions.BasePermission):
    """
    Allows access only to users with the 'admin' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class IsShopManager(permissions.BasePermission):
    """
    Allows access to 'admin' and 'manager' roles.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in ['admin', 'manager']

class IsShopStaff(permissions.BasePermission):
    """
    Allows access to 'admin', 'manager', and 'staff' roles.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in ['admin', 'manager', 'staff']

class HasShopAccess(permissions.BasePermission):
    """
    Custom permission to check if a user has access to a specific shop.
    Admins or users with can_access_all_shops bypass this.
    Others must be assigned to the shop.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
            
        if user.role == 'admin' or user.can_access_all_shops:
            return True
            
        # Check if the object has a shop attribute (e.g. ShopInventory, Customer)
        if hasattr(obj, 'shop'):
            return obj.shop == user.shop
        
        # If the object itself is a Shop
        if hasattr(obj, 'id') and obj.__class__.__name__ == 'Shop':
            return obj == user.shop
            
        return False
