export interface TimesheetRecord {
  date: string;
  day: string;
  inTime: string;
  arrivalTime: string; // New column for official arrival time (9 AM - 12 PM)
  outTime: string;
  totalHours: number;
  overtimeHours: number;
  lateStatus: 'Late' | 'On Time' | '-';
  lunchBreakApplied: 'Yes' | 'No' | '-';
  eveningBreakApplied: 'Yes' | 'No' | '-';
  overtimeEligibility: 'Eligible for Overtime' | 'Overtime Not Eligible (Break Not Applied)' | '-';
  notes: string;
  status: 'Working Day' | 'On Leave' | 'Sunday';
}

export interface ProcessedStats {
  totalDaysInMonth: number;
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
}

export interface RawTimesheetEvent {
  employeeCode: string;
  employeeName: string;
  inOut: 'IN' | 'OUT';
  dateString: string;
  timeString: string;
}

export interface WorkSession {
  date: string;
  day: string;
  sessions: Array<{
    inTime: Date;
    outTime: Date;
    duration: number;
  }>;
  totalWorked: number;
  breaks: Array<{
    start: Date;
    end: Date;
    duration: number;
  }>;
  officialArrivalTime?: Date | null;
}