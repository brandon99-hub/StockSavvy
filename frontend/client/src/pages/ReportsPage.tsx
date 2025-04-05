import ReportGenerator from '../components/reports/ReportGenerator';

const ReportsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Reports & Analytics</h1>
        <p className="text-gray-600">
          Generate and export detailed reports on inventory, sales, and profits.
        </p>
      </div>
      
      <ReportGenerator />
    </div>
  );
};

export default ReportsPage;
