from django.utils import timezone
import pytz
import datetime

def to_nairobi(dt):
    if not dt:
        return None
    nairobi_tz = pytz.timezone('Africa/Nairobi')
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, datetime.timezone.utc)
    return dt.astimezone(nairobi_tz) 