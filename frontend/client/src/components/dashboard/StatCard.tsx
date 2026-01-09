import { Card } from "../ui/card";

type StatCardProps = {
  title: string;
  value: number | string;
  subValue?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  change: number;
  changePeriod: string;
};

const StatCard = ({ title, value, subValue, icon, iconBg, iconColor, change, changePeriod }: StatCardProps) => {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card className="p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
            {subValue && (
              <span className="text-xs font-semibold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded">
                {subValue}
              </span>
            )}
          </div>
        </div>
        <div className={`h-12 w-12 ${iconBg} rounded-full flex items-center justify-center ${iconColor}`}>
          <i className={`fas fa-${icon}`}></i>
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        {isNeutral ? (
          <span className="text-amber-500 flex items-center">
            <i className="fas fa-minus mr-1"></i> {change}%
          </span>
        ) : isPositive ? (
          <span className="text-green-500 flex items-center">
            <i className="fas fa-arrow-up mr-1"></i> {change}%
          </span>
        ) : (
          <span className="text-red-500 flex items-center">
            <i className="fas fa-arrow-down mr-1"></i> {Math.abs(change)}%
          </span>
        )}
        <span className="text-gray-500 ml-2">{changePeriod}</span>
      </div>
    </Card>
  );
};

export default StatCard;
