import { base, TABLES } from '../lib/airtable';
import type { TimesheetRecord, ProcessedStats } from '../types/timesheet';
import type { EmployeeData, EmployeeStats } from '../types/teamDashboard';

export interface MonthYear {
  month: number;
  year: number;
  label: string;
}

export interface PerformanceRating {
  employee_name: string;
  performance_star_rating: number | null;
  month: number;
  year: number;
  project_manager?: string;
}

// Column name mapping from snake_case to Airtable display names
const COLUMN_MAPPING = {
  // Timesheet Records
  employee_name: 'Employee Name',
  month: 'Month',
  year: 'Year',
  date: 'Date',
  day: 'Day',
  in_time: 'In Time',
  arrival_time: 'Arrival Time',
  out_time: 'Out Time',
  total_hours: 'Total Hours',
  overtime_hours: 'Overtime Hours',
  late_status: 'Late Status',
  lunch_break_applied: 'Lunch Break Applied',
  evening_break_applied: 'Evening Break Applied',
  overtime_eligibility: 'Overtime Eligibility',
  notes: 'Notes',
  status: 'Status',
  
  // Employee Monthly Stats
  total_days_in_month: 'Total Days In Month',
  total_working_days: 'Total Working Days',
  total_sundays: 'Total Sundays',
  total_leave_days: 'Total Leave Days',
  late_days: 'Late Days',
  overtime_days: 'Overtime Days',
  eligible_overtime_days: 'Eligible Overtime Days',
  total_eligible_overtime_hours: 'Total Eligible Overtime Hours',
  total_overtime_hours: 'Total Overtime Hours',
  lost_overtime_hours: 'Lost Overtime Hours',
  late_percentage: 'Late Percentage',
  attendance_rate: 'Attendance Rate',
  performance_score: 'Performance Score',
  risk_level: 'Risk Level',
  break_compliance_rate: 'Break Compliance Rate',
  avg_daily_hours: 'Avg Daily Hours',
  
  // Performance Ratings
  performance_star_rating: 'Performance Star Rating',
  project_manager: 'Project Manager',
  rating_notes: 'Rating Notes'
};

// Helper function to add delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to batch operations (max 10 records per request)
const batchArray = <T>(array: T[], batchSize: number = 10): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

export class DatabaseService {
  // Get available months from database
  static async getAvailableMonths(): Promise<MonthYear[]> {
    try {
      const records = await base(TABLES.EMPLOYEE_MONTHLY_STATS)
        .select({
          fields: [COLUMN_MAPPING.month, COLUMN_MAPPING.year],
          sort: [
            { field: COLUMN_MAPPING.year, direction: 'desc' },
            { field: COLUMN_MAPPING.month, direction: 'desc' }
          ]
        })
        .all();

      const uniqueMonths = new Map<string, MonthYear>();
      
      records.forEach(record => {
        const month = record.fields[COLUMN_MAPPING.month] as number;
        const year = record.fields[COLUMN_MAPPING.year] as number;
        const key = `${year}-${month}`;
        
        if (!uniqueMonths.has(key)) {
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          uniqueMonths.set(key, {
            month,
            year,
            label: `${monthNames[month - 1]} ${year}`
          });
        }
      });

      return Array.from(uniqueMonths.values());
    } catch (error) {
      console.error('Error fetching available months:', error);
      return [];
    }
  }

  // Get performance ratings for a specific month/year
  static async getPerformanceRatings(month: number, year: number): Promise<PerformanceRating[]> {
    try {
      const records = await base(TABLES.EMPLOYEE_PERFORMANCE_RATINGS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`
        })
        .all();

      return records.map(record => ({
        employee_name: record.fields[COLUMN_MAPPING.employee_name] as string,
        performance_star_rating: record.fields[COLUMN_MAPPING.performance_star_rating] as number | null,
        month: record.fields[COLUMN_MAPPING.month] as number,
        year: record.fields[COLUMN_MAPPING.year] as number,
        project_manager: record.fields[COLUMN_MAPPING.project_manager] as string
      }));
    } catch (error) {
      console.error('Error fetching performance ratings:', error);
      return [];
    }
  }

  // Get last updated timestamp for a month/year
  static async getLastUpdatedTimestamp(month: number, year: number): Promise<string | null> {
    try {
      const records = await base(TABLES.EMPLOYEE_MONTHLY_STATS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`,
          sort: [{ field: 'Last modified time', direction: 'desc' }],
          maxRecords: 1
        })
        .all();

      return records.length > 0 ? records[0].createdTime : null;
    } catch (error) {
      console.error('Error fetching last updated timestamp:', error);
      return null;
    }
  }

  // Save timesheet data to database
  static async saveTimesheetData(
    employeeData: EmployeeData[],
    month: number,
    year: number
  ): Promise<void> {
    console.log('💾 Starting Airtable save for', employeeData.length, 'employees');
    
    try {
      // First, delete existing data for this month/year
      console.log('🗑️ Deleting existing data for', month, '/', year);
      await this.deleteMonthData(month, year);

      // Prepare timesheet records
      console.log('📝 Preparing timesheet records...');
      const timesheetRecords = employeeData.flatMap(emp =>
        emp.records.map(record => ({
          fields: {
            [COLUMN_MAPPING.employee_name]: emp.employeeName,
            [COLUMN_MAPPING.month]: month,
            [COLUMN_MAPPING.year]: year,
            [COLUMN_MAPPING.date]: record.date,
            [COLUMN_MAPPING.day]: record.day,
            [COLUMN_MAPPING.in_time]: record.inTime,
            [COLUMN_MAPPING.arrival_time]: record.arrivalTime,
            [COLUMN_MAPPING.out_time]: record.outTime,
            [COLUMN_MAPPING.total_hours]: record.totalHours,
            [COLUMN_MAPPING.overtime_hours]: record.overtimeHours,
            [COLUMN_MAPPING.late_status]: record.lateStatus,
            [COLUMN_MAPPING.lunch_break_applied]: record.lunchBreakApplied,
            [COLUMN_MAPPING.evening_break_applied]: record.eveningBreakApplied,
            [COLUMN_MAPPING.overtime_eligibility]: record.overtimeEligibility,
            [COLUMN_MAPPING.notes]: record.notes,
            [COLUMN_MAPPING.status]: record.status
          }
        }))
      );

      // Prepare employee stats
      console.log('📈 Preparing employee stats...');
      const employeeStats = employeeData.map(emp => ({
        fields: {
          [COLUMN_MAPPING.employee_name]: emp.employeeName,
          [COLUMN_MAPPING.month]: month,
          [COLUMN_MAPPING.year]: year,
          [COLUMN_MAPPING.total_days_in_month]: emp.stats.totalWorkingDays + emp.stats.totalSundays + emp.stats.totalLeaveDays,
          [COLUMN_MAPPING.total_working_days]: emp.stats.totalWorkingDays,
          [COLUMN_MAPPING.total_sundays]: emp.stats.totalSundays,
          [COLUMN_MAPPING.total_leave_days]: emp.stats.totalLeaveDays,
          [COLUMN_MAPPING.late_days]: emp.stats.lateDays,
          [COLUMN_MAPPING.overtime_days]: emp.stats.overtimeDays,
          [COLUMN_MAPPING.eligible_overtime_days]: emp.stats.eligibleOvertimeDays,
          [COLUMN_MAPPING.total_eligible_overtime_hours]: emp.stats.totalEligibleOvertimeHours,
          [COLUMN_MAPPING.total_overtime_hours]: emp.stats.totalOvertimeHours,
          [COLUMN_MAPPING.lost_overtime_hours]: emp.stats.lostOvertimeHours,
          [COLUMN_MAPPING.late_percentage]: emp.stats.latePercentage,
          [COLUMN_MAPPING.attendance_rate]: emp.stats.attendanceRate,
          [COLUMN_MAPPING.performance_score]: emp.stats.performanceScore,
          [COLUMN_MAPPING.risk_level]: emp.stats.riskLevel,
          [COLUMN_MAPPING.break_compliance_rate]: emp.stats.breakComplianceRate,
          [COLUMN_MAPPING.avg_daily_hours]: emp.stats.avgDailyHours
        }
      }));

      // Insert timesheet records in batches
      console.log('💾 Inserting timesheet records in batches...');
      const recordBatches = batchArray(timesheetRecords);
      for (const batch of recordBatches) {
        await base(TABLES.TIMESHEET_RECORDS).create(batch);
        await delay(200); // Rate limiting: 5 requests/second
      }

      // Insert employee stats in batches
      console.log('💾 Inserting employee stats in batches...');
      const statsBatches = batchArray(employeeStats);
      for (const batch of statsBatches) {
        await base(TABLES.EMPLOYEE_MONTHLY_STATS).create(batch);
        await delay(200); // Rate limiting: 5 requests/second
      }

      console.log(`✅ Successfully saved data to Airtable for ${month}/${year} - ${employeeData.length} employees, ${timesheetRecords.length} records`);
    } catch (error) {
      console.error('Error saving timesheet data to Airtable:', error);
      throw error;
    }
  }

  // Delete existing data for a specific month/year
  static async deleteMonthData(month: number, year: number): Promise<void> {
    try {
      // Delete timesheet records
      const timesheetRecords = await base(TABLES.TIMESHEET_RECORDS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`
        })
        .all();

      if (timesheetRecords.length > 0) {
        const recordIds = timesheetRecords.map(record => record.id);
        const deleteBatches = batchArray(recordIds);
        for (const batch of deleteBatches) {
          await base(TABLES.TIMESHEET_RECORDS).destroy(batch);
          await delay(200);
        }
      }

      // Delete employee stats
      const statsRecords = await base(TABLES.EMPLOYEE_MONTHLY_STATS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`
        })
        .all();

      if (statsRecords.length > 0) {
        const statsIds = statsRecords.map(record => record.id);
        const statsBatches = batchArray(statsIds);
        for (const batch of statsBatches) {
          await base(TABLES.EMPLOYEE_MONTHLY_STATS).destroy(batch);
          await delay(200);
        }
      }

      console.log(`Successfully deleted existing timesheet and stats data from Airtable for ${month}/${year}`);
    } catch (error) {
      console.error('Error deleting month data from Airtable:', error);
      throw error;
    }
  }

  // Load data for a specific month/year
  static async loadMonthData(month: number, year: number): Promise<{
    employeeData: EmployeeData[];
    performanceRatings: PerformanceRating[];
    lastUpdated: string | null;
    hasData: boolean;
  }> {
    try {
      console.log(`🔍 Loading month data from Airtable for ${month}/${year}`);
      
      // Get performance ratings FIRST
      const performanceRatings = await this.getPerformanceRatings(month, year);
      console.log(`⭐ DatabaseService - Found ${performanceRatings.length} performance ratings for ${month}/${year}`);
      
      // Get employee stats
      const statsRecords = await base(TABLES.EMPLOYEE_MONTHLY_STATS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`,
          sort: [{ field: COLUMN_MAPPING.employee_name, direction: 'asc' }]
        })
        .all();
      
      console.log(`🔍 Found ${statsRecords.length} employee stats records`);

      if (statsRecords.length === 0) {
        return { employeeData: [], performanceRatings, lastUpdated: null, hasData: false };
      }

      // Get timesheet records
      const recordsData = await base(TABLES.TIMESHEET_RECORDS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`,
          sort: [
            { field: COLUMN_MAPPING.employee_name, direction: 'asc' },
            { field: COLUMN_MAPPING.date, direction: 'asc' }
          ]
        })
        .all();
      
      console.log(`🔍 Found ${recordsData.length} timesheet records`);

      // Get last updated timestamp
      const lastUpdated = await this.getLastUpdatedTimestamp(month, year);

      // Group records by employee
      const recordsByEmployee = new Map<string, TimesheetRecord[]>();
      recordsData.forEach(record => {
        const employeeName = record.fields[COLUMN_MAPPING.employee_name] as string;
        if (!recordsByEmployee.has(employeeName)) {
          recordsByEmployee.set(employeeName, []);
        }
        recordsByEmployee.get(employeeName)!.push({
          date: record.fields[COLUMN_MAPPING.date] as string,
          day: record.fields[COLUMN_MAPPING.day] as string,
          inTime: record.fields[COLUMN_MAPPING.in_time] as string,
          arrivalTime: record.fields[COLUMN_MAPPING.arrival_time] as string,
          outTime: record.fields[COLUMN_MAPPING.out_time] as string,
          totalHours: record.fields[COLUMN_MAPPING.total_hours] as number,
          overtimeHours: record.fields[COLUMN_MAPPING.overtime_hours] as number,
          lateStatus: record.fields[COLUMN_MAPPING.late_status] as any,
          lunchBreakApplied: record.fields[COLUMN_MAPPING.lunch_break_applied] as any,
          eveningBreakApplied: record.fields[COLUMN_MAPPING.evening_break_applied] as any,
          overtimeEligibility: record.fields[COLUMN_MAPPING.overtime_eligibility] as any,
          notes: record.fields[COLUMN_MAPPING.notes] as string,
          status: record.fields[COLUMN_MAPPING.status] as any
        });
      });
      
      // Combine stats and records, and recalculate performance scores with ratings
      const employeeData: EmployeeData[] = statsRecords.map(record => {
        const fields = record.fields;
        const employeeName = fields[COLUMN_MAPPING.employee_name] as string;
        const employeeRating = performanceRatings.find(r => r.employee_name === employeeName);
        const recalculatedPerformanceScore = this.calculatePerformanceScoreWithRating(
          fields,
          employeeRating?.performance_star_rating || null
        );

        const employeeRecords = recordsByEmployee.get(employeeName) || [];
        
        return {
          employeeName,
          records: employeeRecords,
          stats: {
            employeeName,
            totalWorkingDays: fields[COLUMN_MAPPING.total_working_days] as number,
            totalSundays: fields[COLUMN_MAPPING.total_sundays] as number,
            totalLeaveDays: fields[COLUMN_MAPPING.total_leave_days] as number,
            lateDays: fields[COLUMN_MAPPING.late_days] as number,
            overtimeDays: fields[COLUMN_MAPPING.overtime_days] as number,
            eligibleOvertimeDays: fields[COLUMN_MAPPING.eligible_overtime_days] as number,
            totalEligibleOvertimeHours: fields[COLUMN_MAPPING.total_eligible_overtime_hours] as number,
            totalOvertimeHours: fields[COLUMN_MAPPING.total_overtime_hours] as number,
            lostOvertimeHours: fields[COLUMN_MAPPING.lost_overtime_hours] as number,
            latePercentage: fields[COLUMN_MAPPING.late_percentage] as number,
            attendanceRate: fields[COLUMN_MAPPING.attendance_rate] as number,
            performanceScore: recalculatedPerformanceScore,
            riskLevel: fields[COLUMN_MAPPING.risk_level] as any,
            breakComplianceRate: fields[COLUMN_MAPPING.break_compliance_rate] as number,
            avgDailyHours: fields[COLUMN_MAPPING.avg_daily_hours] as number
          }
        };
      });

      return { employeeData, performanceRatings, lastUpdated, hasData: true };
    } catch (error) {
      console.error('Error loading month data from Airtable:', error);
      return { employeeData: [], performanceRatings: [], lastUpdated: null, hasData: false };
    }
  }

  // Calculate performance score including performance rating
  static calculatePerformanceScoreWithRating(fields: any, performanceRating: number | null): number {
    let score = 100;
    
    // Deduct for late arrivals (30% weight)
    score -= (fields[COLUMN_MAPPING.late_percentage] as number) * 0.3;
    
    // Deduct for break non-compliance (20% weight)
    score -= (100 - (fields[COLUMN_MAPPING.break_compliance_rate] as number)) * 0.2;
    
    // Deduct for absences (25% weight)
    const attendanceRate = fields[COLUMN_MAPPING.attendance_rate] as number;
    score -= (100 - attendanceRate) * 0.25;
    
    // Performance rating component (25% weight)
    if (performanceRating !== null && performanceRating > 0) {
      // Convert 5-star rating to percentage and apply weight
      const ratingPercentage = (performanceRating / 5) * 100;
      const ratingComponent = ratingPercentage * 0.25;
      
      // Replace the base score component with rating-based score
      score = score * 0.75 + ratingComponent;
    }
    
    // Bonus for consistent overtime eligibility (up to 5 points)
    const overtimeDays = fields[COLUMN_MAPPING.overtime_days] as number;
    if (overtimeDays > 0) {
      const eligibleOvertimeDays = fields[COLUMN_MAPPING.eligible_overtime_days] as number;
      const eligibilityRate = (eligibleOvertimeDays / overtimeDays) * 100;
      score += eligibilityRate * 0.05;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Check if data exists for a specific month/year
  static async checkDataExists(month: number, year: number): Promise<boolean> {
    try {
      console.log(`🔍 Checking if data exists in Airtable for ${month}/${year}`);
      
      const records = await base(TABLES.EMPLOYEE_MONTHLY_STATS)
        .select({
          filterByFormula: `AND({${COLUMN_MAPPING.month}} = ${month}, {${COLUMN_MAPPING.year}} = ${year})`,
          maxRecords: 1
        })
        .all();
      
      const exists = records.length > 0;
      console.log(`🔍 Data exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error('Error checking data existence in Airtable:', error);
      return false;
    }
  }

  // API Methods for external data upload (these would need to be implemented as Airtable-compatible endpoints)
  static async uploadDataViaAPI(payload: {
    month: number;
    year: number;
    timesheet_records: any[];
    employee_stats: any[];
    performance_ratings: any[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      // This would need to be implemented as an Airtable-compatible API endpoint
      // For now, we'll use the direct database methods
      console.log('Direct Airtable upload not implemented via API - using direct methods');
      throw new Error('API upload not implemented for Airtable - use direct upload methods');
    } catch (error) {
      console.error('Error uploading data via API:', error);
      throw error;
    }
  }

  static async deleteMonthDataViaAPI(month: number, year: number): Promise<{ success: boolean; message: string }> {
    try {
      // This would need to be implemented as an Airtable-compatible API endpoint
      console.log('Direct Airtable deletion not implemented via API - using direct methods');
      throw new Error('API deletion not implemented for Airtable - use direct methods');
    } catch (error) {
      console.error('Error deleting data via API:', error);
      throw error;
    }
  }
}