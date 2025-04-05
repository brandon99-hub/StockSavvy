import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { Product, Sale, SaleItem } from "../../../shared/schema";
import { format } from 'date-fns';

// Helper to convert array of objects to CSV string
const objectsToCSV = (data: Record<string, any>[]) => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if it contains commas or quotes
      return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

// Export data to CSV
export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  const csv = objectsToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export inventory report to PDF
export const exportInventoryToPDF = (products: Product[], categories: Record<number, string>) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text('Inventory Report', 14, 22);
  
  // Add date
  doc.setFontSize(11);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
  
  // Format data for table
  const tableData = products.map(product => [
    product.sku,
    product.name,
    categories[product.categoryId || 0] || 'Uncategorized',
    product.quantity.toString(),
    `$${Number(product.buyPrice).toFixed(2)}`,
    `$${Number(product.sellPrice).toFixed(2)}`,
    product.quantity < product.minStockLevel ? 'Low Stock' : 'In Stock'
  ]);
  
  // @ts-ignore - jspdf-autotable extends jsPDF prototype
  doc.autoTable({
    startY: 40,
    head: [['SKU', 'Product Name', 'Category', 'Quantity', 'Buy Price', 'Sell Price', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Save the PDF
  doc.save(`inventory_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Export sales report to PDF
export const exportSalesToPDF = (sales: Sale[], saleItems: Record<number, SaleItem[]>, products: Record<number, Product>) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text('Sales Report', 14, 22);
  
  // Add date
  doc.setFontSize(11);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
  
  // Summary data
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  
  // Summary table
  // @ts-ignore - jspdf-autotable extends jsPDF prototype
  doc.autoTable({
    startY: 40,
    head: [['Total Sales', 'Number of Transactions', 'Average Transaction']],
    body: [[
      `$${totalSales.toFixed(2)}`,
      sales.length.toString(),
      `$${(totalSales / (sales.length || 1)).toFixed(2)}`
    ]],
    theme: 'plain',
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Sales details
  const salesData = sales.map(sale => [
    format(new Date(sale.saleDate), 'PPp'),
    `$${Number(sale.totalAmount).toFixed(2)}`,
    // Get number of items in this sale
    saleItems[sale.id]?.reduce((sum, item) => sum + item.quantity, 0).toString() || '0'
  ]);
  
  // @ts-ignore - jspdf-autotable extends jsPDF prototype
  const finalY = doc.autoTable({
    startY: doc.autoTable.previous.finalY + 15,
    head: [['Date', 'Amount', 'Items Sold']],
    body: salesData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Save the PDF
  doc.save(`sales_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Export profit report to PDF
export const exportProfitToPDF = (salesData: any[], dateRange: { start: Date, end: Date }) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text('Profit Report', 14, 22);
  
  // Add date range
  doc.setFontSize(11);
  doc.text(`Period: ${format(dateRange.start, 'PPP')} to ${format(dateRange.end, 'PPP')}`, 14, 30);
  
  // Calculate summary data
  const totalRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalCost = salesData.reduce((sum, day) => sum + day.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = (totalProfit / totalRevenue) * 100;
  
  // Summary table
  // @ts-ignore - jspdf-autotable extends jsPDF prototype
  doc.autoTable({
    startY: 40,
    head: [['Total Revenue', 'Total Cost', 'Total Profit', 'Profit Margin']],
    body: [[
      `$${totalRevenue.toFixed(2)}`,
      `$${totalCost.toFixed(2)}`,
      `$${totalProfit.toFixed(2)}`,
      `${profitMargin.toFixed(2)}%`
    ]],
    theme: 'plain',
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Daily data
  const dailyData = salesData.map(day => [
    format(new Date(day.date), 'PPP'),
    `$${day.revenue.toFixed(2)}`,
    `$${day.cost.toFixed(2)}`,
    `$${(day.revenue - day.cost).toFixed(2)}`,
    `${((day.revenue - day.cost) / day.revenue * 100).toFixed(2)}%`
  ]);
  
  // @ts-ignore - jspdf-autotable extends jsPDF prototype
  const finalY = doc.autoTable({
    startY: doc.autoTable.previous.finalY + 15,
    head: [['Date', 'Revenue', 'Cost', 'Profit', 'Margin']],
    body: dailyData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  });
  
  // Save the PDF
  doc.save(`profit_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
