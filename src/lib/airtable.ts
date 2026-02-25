import Airtable from 'airtable';

// Configure Airtable
Airtable.configure({
  apiKey: import.meta.env.VITE_AIRTABLE_API_KEY
});

const base = Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID);

export const TABLES = {
  TIMESHEET_RECORDS: 'tbleU7rToktKr9MGB',
  EMPLOYEE_MONTHLY_STATS: 'tblfoIASNYJn2R4PU',
  EMPLOYEE_PERFORMANCE_RATINGS: 'tblljMQuAlByl1rU8'
};

export { base };
export default base;
