import { neon } from '@neondatabase/serverless';

// Configure Neon (HTTP driver)
const databaseUrl = import.meta.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('VITE_DATABASE_URL is not set');
}

export const sql = neon(databaseUrl);

export const TABLES = {
  TIMESHEET_RECORDS: 'timesheet_records_et',
  EMPLOYEE_MONTHLY_STATS: 'employee_monthly_stats_et',
  EMPLOYEE_PERFORMANCE_RATINGS: 'employee_performance_ratings_et'
};

export default sql;
