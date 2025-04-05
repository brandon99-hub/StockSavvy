import { useAuth } from '../lib/auth';
import AdvancedAnalytics from '../components/reports/AdvancedAnalytics';
import { useLocation } from 'wouter';

const AdvancedAnalyticsPage = () => {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  
  // Only allow admin and manager access
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-4">
      <AdvancedAnalytics />
    </div>
  );
};

export default AdvancedAnalyticsPage;