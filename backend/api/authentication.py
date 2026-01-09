from rest_framework import authentication
from rest_framework import exceptions
from .models import User

class CustomTokenAuthentication(authentication.BaseAuthentication):
    """
    Standardizes the custom 'token_{user_id}' approach into a DRF Authentication class.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        try:
            token = auth_header.split(' ')[1]
            if not token.startswith('token_'):
                return None
                
            user_id = int(token.split('_')[1])
            user = User.objects.get(id=user_id)
            return (user, None)
        except (IndexError, ValueError, User.DoesNotExist):
            raise exceptions.AuthenticationFailed('Invalid token')
        except Exception as e:
            raise exceptions.AuthenticationFailed(str(e))

    def authenticate_header(self, request):
        return 'Bearer'
