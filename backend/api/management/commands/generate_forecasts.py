import datetime
from django.core.management.base import BaseCommand
from django.db import connection
from api.models import Product, ProductForecast, Sale, SaleItem
from django.db import models

class Command(BaseCommand):
    help = 'Generate demand forecasts for each product using historical sales data'

    def handle(self, *args, **options):
        try:
            import pandas as pd
            from prophet import Prophet
        except ImportError:
            self.stdout.write(self.style.ERROR('Required packages not installed. Please install pandas and prophet.'))
            return

        # Get all products
        products = Product.objects.all()
        
        for product in products:
            # Get historical sales data
            sales_data = SaleItem.objects.filter(
                product=product,
                sale__sale_date__gte=datetime.date.today() - datetime.timedelta(days=365)  # Last year of data
            ).values('sale__sale_date').annotate(
                total_quantity=models.Sum('quantity')
            ).order_by('sale__sale_date')

            if not sales_data:
                continue

            # Prepare data for Prophet
            df = pd.DataFrame(list(sales_data))
            df.columns = ['ds', 'y']
            df['ds'] = pd.to_datetime(df['ds'])

            # Create and fit model
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False
            )
            model.fit(df)

            # Generate forecast for next 30 days
            future = model.make_future_dataframe(periods=30)
            forecast = model.predict(future)

            # Store forecasts
            for _, row in forecast.tail(30).iterrows():
                forecast_date = row['ds'].date()
                forecast_quantity = max(0, int(round(row['yhat'])))  # Ensure non-negative
                
                ProductForecast.objects.update_or_create(
                    product=product,
                    forecast_date=forecast_date,
                    defaults={
                        'forecast_quantity': forecast_quantity,
                        'model_info': 'Prophet'
                    }
                )

            self.stdout.write(
                self.style.SUCCESS(f'Successfully generated forecasts for {product.name}')
            )

        self.stdout.write(self.style.SUCCESS('All forecasts generated.')) 