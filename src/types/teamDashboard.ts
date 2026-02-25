export interface EmployeeStats {
  employeeName: string;
  totalWorkingDays: number;
  totalSundays: number;
  totalLeaveDays: number;
  lateDays: number;
  overtimeDays: number;
  eligibleOvertimeDays: number;
  totalEligibleOvertimeHours: number;
  totalOvertimeHours: number;
  lostOvertimeHours: number;
  latePercentage: number;
  attendanceRate: number;
  performanceScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breakComplianceRate: number;
  avgDailyHours: number;
}

export interface TeamStats {
  totalEmployees: number;
  avgAttendanceRate: number;
  avgLatePercentage: number;
  totalOvertimeHours: number;
  totalLostOvertimeHours: number;
  highRiskEmployees: number;
  topPerformers: EmployeeStats[];
  needsAttention: EmployeeStats[];
  avgPerformanceRating?: number | null;
  monthlyTrends: {
    totalWorkingDays: number;
    avgHoursPerDay: number;
    complianceRate: number;
  };
}

export interface EmployeeData {
  employeeName: string;
  records: TimesheetRecord[];
  stats: EmployeeStats;
}