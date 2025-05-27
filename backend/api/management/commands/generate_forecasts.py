import datetime
import logging
from django.core.management.base import BaseCommand
from django.db import connection
from api.models import Product, ProductForecast, Sale, SaleItem
from django.db import models
from typing import Dict, List, Optional
import pandas as pd
from prophet import Prophet

logger = logging.getLogger(__name__)

class ForecastGenerationError(Exception):
    """Custom exception for forecast generation errors"""
    pass

class Command(BaseCommand):
    help = 'Generate demand forecasts for each product using historical sales data'

    def __init__(self):
        super().__init__()
        self.MIN_DATA_POINTS = 3  # Reduced from 7 to 3 days of sales data required
        self.FORECAST_DAYS = 30   # Number of days to forecast
        self.HISTORY_DAYS = 90    # Reduced from 365 to 90 days of historical data
        self.MIN_SALES_THRESHOLD = 2  # Reduced from 5 to 2 minimum total sales required

    def get_sales_data(self, product: Product) -> Optional[pd.DataFrame]:
        """Get and validate sales data for a product"""
        try:
            sales_data = SaleItem.objects.filter(
                product=product,
                sale__sale_date__gte=datetime.date.today() - datetime.timedelta(days=self.HISTORY_DAYS)
            ).values('sale__sale_date').annotate(
                total_quantity=models.Sum('quantity')
            ).order_by('sale__sale_date')

            if not sales_data:
                logger.info(f"No sales data found for product {product.name}")
                return None

            # Convert to DataFrame
            df = pd.DataFrame(list(sales_data))
            df.columns = ['ds', 'y']
            df['ds'] = pd.to_datetime(df['ds'])

            # Validate data points
            if len(df) < self.MIN_DATA_POINTS:
                logger.info(f"Insufficient data points for {product.name}: {len(df)} < {self.MIN_DATA_POINTS}")
                return None

            # Validate total sales
            if df['y'].sum() < self.MIN_SALES_THRESHOLD:
                logger.info(f"Total sales below threshold for {product.name}: {df['y'].sum()} < {self.MIN_SALES_THRESHOLD}")
                return None

            return df

        except Exception as e:
            logger.error(f"Error getting sales data for {product.name}: {str(e)}")
            return None

    def generate_forecast(self, df: pd.DataFrame, product: Product) -> Optional[Dict]:
        """Generate forecast using Prophet model"""
        try:
            # Configure Prophet model with more flexible parameters for small datasets
            model = Prophet(
                yearly_seasonality=False,  # Disabled for small datasets
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.1,  # More flexible trend changes
                seasonality_prior_scale=5.0,  # Reduced seasonality strength
                holidays_prior_scale=5.0,     # Reduced holiday effects
            )

            # Add custom seasonality only if we have enough data
            if len(df) >= 7:
                model.add_seasonality(
                    name='monthly',
                    period=30.5,
                    fourier_order=3  # Reduced from 5 to 3 for smaller datasets
                )

            # Fit model
            model.fit(df)

            # Generate forecast
            future = model.make_future_dataframe(periods=self.FORECAST_DAYS)
            forecast = model.predict(future)

            # Get forecast metrics
            metrics = {
                'trend': forecast['trend'].iloc[-1],
                'seasonality': forecast['yearly'].iloc[-1] if 'yearly' in forecast else 0,
                'uncertainty': forecast['yhat_upper'].iloc[-1] - forecast['yhat_lower'].iloc[-1]
            }

            return {
                'forecast': forecast.tail(self.FORECAST_DAYS),
                'metrics': metrics
            }

        except Exception as e:
            logger.error(f"Error generating forecast for {product.name}: {str(e)}")
            return None

    def save_forecasts(self, product: Product, forecast_data: Dict) -> bool:
        """Save forecast data to database"""
        try:
            for _, row in forecast_data['forecast'].iterrows():
                forecast_date = row['ds'].date()
                forecast_quantity = max(0, int(round(row['yhat'])))
                
                # Calculate confidence interval
                lower_bound = max(0, int(round(row['yhat_lower'])))
                upper_bound = max(0, int(round(row['yhat_upper'])))
                
                ProductForecast.objects.update_or_create(
                    product=product,
                    forecast_date=forecast_date,
                    defaults={
                        'forecast_quantity': forecast_quantity,
                        'model_info': f"Prophet (CI: {lower_bound}-{upper_bound})"
                    }
                )
            return True
        except Exception as e:
            logger.error(f"Error saving forecasts for {product.name}: {str(e)}")
            return False

    def handle(self, *args, **options):
        try:
            # Get all products
            products = Product.objects.all()
            total_products = products.count()
            successful_forecasts = 0
            failed_forecasts = 0
            
            self.stdout.write(f"Starting forecast generation for {total_products} products...")
            
            for product in products:
                try:
                    # Get and validate sales data
                    df = self.get_sales_data(product)
                    if df is None:
                        failed_forecasts += 1
                        continue

                    # Generate forecast
                    forecast_data = self.generate_forecast(df, product)
                    if forecast_data is None:
                        failed_forecasts += 1
                        continue

                    # Save forecasts
                    if self.save_forecasts(product, forecast_data):
                        successful_forecasts += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Successfully generated forecasts for {product.name}')
                        )
                    else:
                        failed_forecasts += 1

                except Exception as e:
                    logger.error(f"Error processing product {product.name}: {str(e)}")
                    failed_forecasts += 1
                    continue

            # Print summary
            self.stdout.write(self.style.SUCCESS(
                f'Forecast generation completed.\n'
                f'Total products: {total_products}\n'
                f'Successful forecasts: {successful_forecasts}\n'
                f'Failed forecasts: {failed_forecasts}'
            ))

        except Exception as e:
            logger.error(f"Critical error in forecast generation: {str(e)}")
            self.stdout.write(
                self.style.ERROR(f'Error generating forecasts: {str(e)}')
            )
            raise ForecastGenerationError(str(e)) 