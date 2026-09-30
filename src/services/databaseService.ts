import { sql, TABLES } from '../lib/neon';
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

// Column lists for the Neon tables (order matters for bulk inserts)
const TIMESHEET_COLUMNS = [
  'employee_name', 'month', 'year', 'date', 'day', 'in_time', 'arrival_time', 'out_time',
  'total_hours', 'overtime_hours', 'late_status', 'lunch_break_applied', 'evening_break_applied',
  'overtime_eligibility', 'notes', 'status'
];

const STATS_COLUMNS = [
  'employee_name', 'month', 'year', 'total_days_in_month', 'total_working_days', 'total_sundays',
  'total_leave_days', 'late_days', 'overtime_days', 'eligible_overtime_days',
  'total_eligible_overtime_hours', 'total_overtime_hours', 'lost_overtime_hours', 'late_percentage',
  'attendance_rate', 'performance_score', 'risk_level', 'break_compliance_rate', 'avg_daily_hours'
];

// Postgres NUMERIC columns come back as strings from the driver
const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

// Helper function to split rows into chunks (keeps bind parameters well under Postgres' 65535 limit)
const batchArray = <T>(array: T[], batchSize: number = 500): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

// Build a parameterized multi-row INSERT for the given table/columns
const buildInsert = (table: string, columns: string[], rows: unknown[][]) => {
  const params: unknown[] = [];
  const values = rows.map(row => {
    const placeholders = row.map(value => {
      params.push(value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  return sql.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}`, params);
};

// --- In-memory cache (lives for the duration of the browser session) ---
interface CacheEntry<T> { data: T; timestamp: number }
const _cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  _cache.set(key, { data, timestamp: Date.now() });
}

// Call this after uploading/importing new data so stale cache is cleared
export function invalidateCache(month?: number, year?: number): void {
  if (month !== undefined && year !== undefined) {
    _cache.delete(`month_data_${month}_${year}`);
  }
  _cache.delete('available_months');
}

export class DatabaseService {
  // Get available months from database
  static async getAvailableMonths(): Promise<MonthYear[]> {
    const cached = getCached<MonthYear[]>('available_months');
    if (cached) return cached;

    try {
      const rows = await sql.query(
        `SELECT DISTINCT month, year FROM ${TABLES.EMPLOYEE_MONTHLY_STATS} ORDER BY year DESC, month DESC`
      );

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const result: MonthYear[] = rows.map(row => {
        const month = num(row.month);
        const year = num(row.year);
        return { month, year, label: `${monthNames[month - 1]} ${year}` };
      });

      setCached('available_months', result);
      return result;
    } catch (error) {
      console.error('Error fetching available months:', error);
      return [];
    }
  }

  // Get performance ratings for a specific month/year
  static async getPerformanceRatings(month: number, year: number): Promise<PerformanceRating[]> {
    try {
      const rows = await sql.query(
        `SELECT employee_name, performance_star_rating, month, year, project_manager
         FROM ${TABLES.EMPLOYEE_PERFORMANCE_RATINGS}
         WHERE month = $1 AND year = $2`,
        [month, year]
      );

      return rows.map(row => ({
        employee_name: row.employee_name as string,
        performance_star_rating: numOrNull(row.performance_star_rating),
        month: num(row.month),
        year: num(row.year),
        project_manager: (row.project_manager ?? undefined) as string | undefined
      }));
    } catch (error) {
      console.error('Error fetching performance ratings:', error);
      return [];
    }
  }

  // Get last updated timestamp for a month/year
  static async getLastUpdatedTimestamp(month: number, year: number): Promise<string | null> {
    try {
      const rows = await sql.query(
        `SELECT MAX(created_at) AS last_updated FROM ${TABLES.EMPLOYEE_MONTHLY_STATS}
         WHERE month = $1 AND year = $2`,
        [month, year]
      );

      const lastUpdated = rows[0]?.last_updated;
      return lastUpdated ? new Date(lastUpdated as string).toISOString() : null;
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
    console.log('💾 Starting Neon save for', employeeData.length, 'employees');

    try {
      // Prepare timesheet records
      console.log('📝 Preparing timesheet records...');
      const timesheetRows = employeeData.flatMap(emp =>
        emp.records.map(record => [
          emp.employeeName,
          month,
          year,
          record.date,
          record.day,
          record.inTime,
          record.arrivalTime,
          record.outTime,
          record.totalHours,
          record.overtimeHours,
          record.lateStatus,
          record.lunchBreakApplied,
          record.eveningBreakApplied,
          record.overtimeEligibility,
          record.notes,
          record.status
        ])
      );

      // Prepare employee stats
      console.log('📈 Preparing employee stats...');
      const statsRows = employeeData.map(emp => [
        emp.employeeName,
        month,
        year,
        emp.stats.totalWorkingDays + emp.stats.totalSundays + emp.stats.totalLeaveDays,
        emp.stats.totalWorkingDays,
        emp.stats.totalSundays,
        emp.stats.totalLeaveDays,
        emp.stats.lateDays,
        emp.stats.overtimeDays,
        emp.stats.eligibleOvertimeDays,
        emp.stats.totalEligibleOvertimeHours,
        emp.stats.totalOvertimeHours,
        emp.stats.lostOvertimeHours,
        emp.stats.latePercentage,
        emp.stats.attendanceRate,
        emp.stats.performanceScore,
        emp.stats.riskLevel,
        emp.stats.breakComplianceRate,
        emp.stats.avgDailyHours
      ]);

      // Replace existing month data and insert new rows in a single transaction
      console.log('🗑️ Replacing existing data for', month, '/', year);
      await sql.transaction([
        sql.query(`DELETE FROM ${TABLES.TIMESHEET_RECORDS} WHERE month = $1 AND year = $2`, [month, year]),
        sql.query(`DELETE FROM ${TABLES.EMPLOYEE_MONTHLY_STATS} WHERE month = $1 AND year = $2`, [month, year]),
        ...batchArray(timesheetRows).map(batch => buildInsert(TABLES.TIMESHEET_RECORDS, TIMESHEET_COLUMNS, batch)),
        ...batchArray(statsRows).map(batch => buildInsert(TABLES.EMPLOYEE_MONTHLY_STATS, STATS_COLUMNS, batch))
      ]);

      console.log(`✅ Successfully saved data to Neon for ${month}/${year} - ${employeeData.length} employees, ${timesheetRows.length} records`);
    } catch (error) {
      console.error('Error saving timesheet data to Neon:', error);
      throw error;
    }
  }

  // Delete existing data for a specific month/year
  static async deleteMonthData(month: number, year: number): Promise<void> {
    try {
      await sql.transaction([
        sql.query(`DELETE FROM ${TABLES.TIMESHEET_RECORDS} WHERE month = $1 AND year = $2`, [month, year]),
        sql.query(`DELETE FROM ${TABLES.EMPLOYEE_MONTHLY_STATS} WHERE month = $1 AND year = $2`, [month, year])
      ]);

      console.log(`Successfully deleted existing timesheet and stats data from Neon for ${month}/${year}`);
    } catch (error) {
      console.error('Error deleting month data from Neon:', error);
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
    const cacheKey = `month_data_${month}_${year}`;
    const cached = getCached<{ employeeData: EmployeeData[]; performanceRatings: PerformanceRating[]; lastUpdated: string | null; hasData: boolean }>(cacheKey);
    if (cached) {
      console.log(`⚡ Serving ${month}/${year} from cache`);
      return cached;
    }

    try {
      console.log(`🔍 Loading month data from Neon for ${month}/${year}`);

      // Run all 3 queries in parallel instead of sequentially
      const [performanceRatings, statsRecords, recordsData] = await Promise.all([
        this.getPerformanceRatings(month, year),
        sql.query(
          `SELECT * FROM ${TABLES.EMPLOYEE_MONTHLY_STATS} WHERE month = $1 AND year = $2 ORDER BY employee_name ASC`,
          [month, year]
        ),
        sql.query(
          `SELECT * FROM ${TABLES.TIMESHEET_RECORDS} WHERE month = $1 AND year = $2 ORDER BY employee_name ASC, date ASC, id ASC`,
          [month, year]
        )
      ]);

      console.log(`⭐ DatabaseService - Found ${performanceRatings.length} performance ratings for ${month}/${year}`);
      console.log(`🔍 Found ${statsRecords.length} employee stats records`);
      console.log(`🔍 Found ${recordsData.length} timesheet records`);

      if (statsRecords.length === 0) {
        return { employeeData: [], performanceRatings, lastUpdated: null, hasData: false };
      }

      // Reuse already-fetched stats records for timestamp (avoids extra query)
      const latestCreatedAt = statsRecords
        .map(row => row.created_at ? new Date(row.created_at as string).getTime() : 0)
        .reduce((max, t) => Math.max(max, t), 0);
      const lastUpdated = latestCreatedAt > 0 ? new Date(latestCreatedAt).toISOString() : null;

      // Group records by employee
      const recordsByEmployee = new Map<string, TimesheetRecord[]>();
      recordsData.forEach(row => {
        const employeeName = row.employee_name as string;
        if (!recordsByEmployee.has(employeeName)) {
          recordsByEmployee.set(employeeName, []);
        }
        recordsByEmployee.get(employeeName)!.push({
          date: row.date as string,
          day: row.day as string,
          inTime: row.in_time as string,
          arrivalTime: row.arrival_time as string,
          outTime: row.out_time as string,
          totalHours: num(row.total_hours),
          overtimeHours: num(row.overtime_hours),
          lateStatus: row.late_status as any,
          lunchBreakApplied: row.lunch_break_applied as any,
          eveningBreakApplied: row.evening_break_applied as any,
          overtimeEligibility: row.overtime_eligibility as any,
          notes: row.notes as string,
          status: row.status as any
        });
      });

      // Combine stats and records, and recalculate performance scores with ratings
      const employeeData: EmployeeData[] = statsRecords.map(fields => {
        const employeeName = fields.employee_name as string;
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
            totalWorkingDays: num(fields.total_working_days),
            totalSundays: num(fields.total_sundays),
            totalLeaveDays: num(fields.total_leave_days),
            lateDays: num(fields.late_days),
            overtimeDays: num(fields.overtime_days),
            eligibleOvertimeDays: num(fields.eligible_overtime_days),
            totalEligibleOvertimeHours: num(fields.total_eligible_overtime_hours),
            totalOvertimeHours: num(fields.total_overtime_hours),
            lostOvertimeHours: num(fields.lost_overtime_hours),
            latePercentage: num(fields.late_percentage),
            attendanceRate: num(fields.attendance_rate),
            performanceScore: recalculatedPerformanceScore,
            riskLevel: fields.risk_level as any,
            breakComplianceRate: num(fields.break_compliance_rate),
            avgDailyHours: num(fields.avg_daily_hours)
          }
        };
      });

      const result = { employeeData, performanceRatings, lastUpdated, hasData: true };
      setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error loading month data from Neon:', error);
      return { employeeData: [], performanceRatings: [], lastUpdated: null, hasData: false };
    }
  }

  // Calculate performance score including performance rating
  // `fields` is a row from employee_monthly_stats_et (snake_case columns)
  static calculatePerformanceScoreWithRating(fields: any, performanceRating: number | null): number {
    let score = 100;

    // Deduct for late arrivals (30% weight)
    score -= num(fields.late_percentage) * 0.3;

    // Deduct for break non-compliance (20% weight)
    score -= (100 - num(fields.break_compliance_rate)) * 0.2;

    // Deduct for absences (25% weight)
    const attendanceRate = num(fields.attendance_rate);
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
    const overtimeDays = num(fields.overtime_days);
    if (overtimeDays > 0) {
      const eligibleOvertimeDays = num(fields.eligible_overtime_days);
      const eligibilityRate = (eligibleOvertimeDays / overtimeDays) * 100;
      score += eligibilityRate * 0.05;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Check if data exists for a specific month/year
  static async checkDataExists(month: number, year: number): Promise<boolean> {
    try {
      console.log(`🔍 Checking if data exists in Neon for ${month}/${year}`);

      const rows = await sql.query(
        `SELECT 1 FROM ${TABLES.EMPLOYEE_MONTHLY_STATS} WHERE month = $1 AND year = $2 LIMIT 1`,
        [month, year]
      );

      const exists = rows.length > 0;
      console.log(`🔍 Data exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error('Error checking data existence in Neon:', error);
      return false;
    }
  }

  // API Methods for external data upload (not exposed as a separate endpoint)
  static async uploadDataViaAPI(payload: {
    month: number;
    year: number;
    timesheet_records: any[];
    employee_stats: any[];
    performance_ratings: any[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Upload via API not implemented - using direct methods');
      throw new Error('API upload not implemented - use direct upload methods');
    } catch (error) {
      console.error('Error uploading data via API:', error);
      throw error;
    }
  }

  static async deleteMonthDataViaAPI(month: number, year: number): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Deletion via API not implemented - using direct methods');
      throw new Error('API deletion not implemented - use direct methods');
    } catch (error) {
      console.error('Error deleting data via API:', error);
      throw error;
    }
  }
}
