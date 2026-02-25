import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import type { MonthYear } from '../services/databaseService';

interface MonthSelectorProps {
  availableMonths: MonthYear[];
  selectedMonth: MonthYear | null;
  onMonthSelect: (month: MonthYear) => void;
  isLoading?: boolean;
}

// Generate all months from 2020 to current year + 1
const generateAllMonths = (): MonthYear[] => {
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  const endYear = currentYear + 1; // Include next year for future planning
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const months: MonthYear[] = [];
  
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      months.push({
        month,
        year,
        label: `${monthNames[month - 1]} ${year}`
      });
    }
  }
  
  return months;
};

const MonthSelector: React.FC<MonthSelectorProps> = ({
  availableMonths,
  selectedMonth,
  onMonthSelect,
  isLoading = false
}) => {
  // Combine available months with all months, prioritizing available months
  const allMonthsToShow = React.useMemo(() => {
    const allMonths = generateAllMonths();
    const monthsMap = new Map<string, MonthYear>();
    
    // First add all months
    allMonths.forEach(month => {
      const key = `${month.year}-${month.month}`;
      monthsMap.set(key, month);
    });
    
    // Then override with available months (which have data)
    availableMonths.forEach(month => {
      const key = `${month.year}-${month.month}`;
      monthsMap.set(key, month);
    });
    
    // Convert back to array and sort by year and month (newest first)
    return Array.from(monthsMap.values()).sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year; // Newer years first
      }
      return b.month - a.month; // Newer months first within same year
    });
  }, [availableMonths]);
  
  const hasData = (month: MonthYear) => {
    return availableMonths.some(am => am.month === month.month && am.year === month.year);
  };
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Month & Year
      </label>
      <div className="relative">
        <select
          value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ''}
          onChange={(e) => {
            if (e.target.value) {
              const [year, month] = e.target.value.split('-').map(Number);
              const monthData = allMonthsToShow.find(m => m.year === year && m.month === month);
              if (monthData) {
                onMonthSelect(monthData);
              }
            }
          }}
          disabled={isLoading}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">
            Select a month...
          </option>
          {allMonthsToShow.map((month) => (
            <option 
              key={`${month.year}-${month.month}`} 
              value={`${month.year}-${month.month}`}
              style={{ 
                fontWeight: hasData(month) ? 'bold' : 'normal',
                color: hasData(month) ? '#059669' : '#6B7280'
              }}
            >
              {month.label} {hasData(month) ? '✓' : ''}
            </option>
          ))}
        </select>
        
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      </div>
      
      {availableMonths.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          No data available yet. Months with data will be marked with ✓
        </p>
      )}
      
      {availableMonths.length > 0 && (
        <p className="mt-2 text-sm text-green-600">
          ✓ Months with data are shown in green and bold
        </p>
      )}
    </div>
  );
};

export default MonthSelector;