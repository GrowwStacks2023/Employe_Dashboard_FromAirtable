import React from 'react';
import { Calendar, Clock, AlertTriangle, TrendingUp, Users, Coffee, Home, UserX } from 'lucide-react';
import type { ProcessedStats } from '../types/timesheet';

interface DashboardProps {
  stats: ProcessedStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const decimalHoursToHM = (decimalHours: number): string => {
    if (decimalHours === 0) return "0:00";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage > 50) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (percentage > 20) return 'bg-gradient-to-r from-orange-500 to-orange-600';
    return 'bg-gradient-to-r from-green-500 to-green-600';
  };

  // Calculate attendance rate excluding absent days
  const totalWorkingDaysAvailable = stats.totalDaysInMonth - stats.totalSundays;
  const saturdayHolidays = Math.floor(stats.totalDaysInMonth / 7) * 2; // Approximate Saturday holidays
  const adjustedWorkingDaysAvailable = totalWorkingDaysAvailable - saturdayHolidays;
  const attendanceRateExcludingAbsents = adjustedWorkingDaysAvailable > 0 
    ? Math.min(100, (stats.totalWorkingDays / (adjustedWorkingDaysAvailable - stats.totalLeaveDays)) * 100)
    : 0;

  const cards = [
    {
      title: 'Working Days',
      value: stats.totalWorkingDays.toString(),
      icon: Calendar,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      description: 'Total working days attended'
    },
    {
      title: 'Late Arrivals',
      value: `${stats.lateDays} (${stats.latePercentage.toFixed(1)}%)`,
      icon: AlertTriangle,
      color: getStatusColor(stats.latePercentage),
      description: 'Days with late arrival',
      alert: stats.latePercentage > 20
    },
    {
      title: 'Total Overtime',
      value: decimalHoursToHM(stats.totalOvertimeHours),
      icon: Clock,
      color: 'bg-gradient-to-r from-purple-500 to-purple-600',
      description: 'Total overtime worked'
    },
    {
      title: 'Lost Overtime',
      value: decimalHoursToHM(stats.lostOvertimeHours),
      icon: TrendingUp,
      color: 'bg-gradient-to-r from-orange-500 to-orange-600',
      description: 'OT lost due to break non-compliance'
    },
    {
      title: 'Eligible Overtime',
      value: decimalHoursToHM(stats.totalEligibleOvertimeHours),
      icon: Coffee,
      color: 'bg-gradient-to-r from-teal-500 to-teal-600',
      description: 'Eligible for payment'
    },
    {
      title: 'OT Days',
      value: stats.overtimeDays.toString(),
      icon: Users,
      color: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
      description: 'Days with overtime work'
    },
    {
      title: 'Total Sundays',
      value: stats.totalSundays.toString(),
      icon: Home,
      color: 'bg-gradient-to-r from-gray-500 to-gray-600',
      description: 'All Sundays are off'
    },
    {
      title: 'Absent Days',
      value: stats.totalLeaveDays.toString(),
      icon: UserX,
      color: 'bg-gradient-to-r from-red-500 to-red-600',
      description: 'Days marked as absent'
    }
  ];

  return (
    <div>
      {/* Alert Banner */}
      {stats.latePercentage > 20 && (
        <div className={`
          mb-6 rounded-xl p-6 text-white
          ${stats.latePercentage > 50 ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'}
        `}>
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {stats.latePercentage > 50 ? '🚨 Critical Attendance Alert' : '⚠️ Attendance Warning'}
              </h3>
              <p className="opacity-90">
                {stats.latePercentage > 50 
                  ? `Critical: ${stats.latePercentage.toFixed(1)}% late arrival rate requires immediate intervention. This significantly exceeds acceptable attendance standards.`
                  : `Warning: ${stats.latePercentage.toFixed(1)}% late arrival rate detected. Consider attendance improvement measures.`
                }
              </p>
              <p className="text-sm opacity-80 mt-2">
                Lost overtime due to break non-compliance: {decimalHoursToHM(stats.lostOvertimeHours)} hours
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Policy Info */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start">
          <Calendar className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Company Holiday Policy</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p><strong>🏠 All Sundays:</strong> Complete holiday</p>
                <p><strong>📅 2nd & 4th Saturdays:</strong> Holiday</p>
              </div>
              <div>
                <p><strong>⏰ 1st & 3rd Saturdays:</strong> Half day (9 AM - 1 PM)</p>
                <p><strong>❌ No Login:</strong> Marked as absent</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-200"
            >
              <div className={`${card.color} p-6 text-white relative overflow-hidden`}>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <h3 className="text-2xl font-bold">{card.value}</h3>
                    <p className="text-sm opacity-90">{card.title}</p>
                  </div>
                  <Icon className="h-8 w-8 opacity-80" />
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-20">
                  <Icon className="h-16 w-16" />
                </div>
                {card.alert && (
                  <div className="absolute top-2 right-2">
                    <div className="h-3 w-3 bg-yellow-300 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50">
                <p className="text-xs text-gray-600">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Metrics */}
      <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Analysis</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {isNaN(attendanceRateExcludingAbsents) ? '0.0' : attendanceRateExcludingAbsents.toFixed(1)}%
            </div>
            <p className="text-sm text-gray-600">Attendance Rate (excluding absents & holidays)</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.eligibleOvertimeDays}
            </div>
            <p className="text-sm text-gray-600">Eligible OT Days</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.overtimeDays - stats.eligibleOvertimeDays}
            </div>
            <p className="text-sm text-gray-600">Non-Eligible OT Days</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;