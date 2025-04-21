def check_token_auth(self, request):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            logger.warning('Missing or invalid authorization header')
            return False, None, False

        token = auth_header.split(' ')[1]
        if not token:
            logger.warning('Invalid token format')
            return False, None, False

        try:
            parts = token.split('_')
            user_id = int(parts[1]) if len(parts) > 1 else None
            
            # For receipt endpoint, we only need authentication, not authorization
            if request.resolver_match and request.resolver_match.url_name == 'sale-receipt':
                return True, user_id, True

            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT is_staff, is_superuser, role FROM users WHERE id = %s",
                    [user_id]
                )
                row = cursor.fetchone()
                if row:
                    is_staff, is_superuser, role = row
                    # Allow access if user is staff, superuser, admin, or manager
                    is_authorized = is_staff or is_superuser or (role and role.lower() in ['admin', 'manager', 'staff'])
                    return True, user_id, is_authorized
            return False, None, False
        except (IndexError, ValueError) as e:
            logger.warning(f'Error parsing token: {str(e)}')
            return False, None, False
    except Exception as e:
        logger.error(f'Unexpected error in token authentication: {str(e)}')
        return False, None, False 