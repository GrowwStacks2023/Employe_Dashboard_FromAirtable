export interface TeamLoggerTimesheetEntry {
  id: string;
  employeeGuid: string;
  employeeName: string;
  employeeCode: string | null;
  projectName: string;
  projectGuid: string;
  taskGuid: string;
  taskName: string;
  endTime: number; // epoch milliseconds
  startTime: number; // epoch milliseconds
  activityLevel: string;
  employeeEmail: string;
  isOffComputer: boolean;
  activityLevelSeconds: string;
  nonbillable: boolean;
  activeHours: number;
  idleHours: number;
  meetingMode: boolean;
  notes: string;
}

export interface TeamLoggerResponse {
  data: TeamLoggerTimesheetEntry[];
  success: boolean;
  message?: string;
}

export class TeamLoggerService {
  private static readonly API_BASE_URL = 'https://api2.teamlogger.com/api';
  private static readonly BEARER_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vaGlwZXJyLmNvbSIsInN1YiI6ImVkYzBkMjkwYTA3YzRiNDRiY2U1YWUwNjY3MGJmZDU3IiwiYXVkIjoic2VydmVyIn0.NshKyFGlF-KH66b7uaUdtj6RjjBQ1PqzdLz2xM2u8XI';

  static async fetchTimesheetData(
    startTime: number,
    endTime: number,
  ): Promise<TeamLoggerTimesheetEntry[]> {
    try {
      // Construct URL with proper parameter format as shown in your example
      const url = `${this.API_BASE_URL}/timesheet_data?startTime=${startTime}&endTime=${endTime}`;

      console.log('🔍 TeamLogger API Request Details:');
      console.log('URL:', url);
      console.log('Start Time:', new Date(startTime).toISOString());
      console.log('End Time:', new Date(endTime).toISOString());
      console.log('Start Time Epoch:', startTime);
      console.log('End Time Epoch:', endTime);
      console.log('Headers:', {
        'Authorization': `Bearer ${this.BEARER_TOKEN.substring(0, 20)}...`,
        'Content-Type': 'application/json',
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TeamLogger API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 TeamLogger API Raw Response:');
      console.log('Response structure:', {
        hasData: !!data.data,
        dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
        dataLength: data.data?.length || 0,
        responseKeys: Object.keys(data),
        sampleResponse: data.data?.slice(0, 2) || 'No data array found'
      });
      
      const entries = data.data || data || [];
      console.log(`📊 Received ${entries.length} timesheet entries from TeamLogger`);
      
      // Detailed analysis of entries
      if (entries.length > 0) {
        console.log('🔍 First 3 entries sample:', entries.slice(0, 3));
        console.log('🔍 Last 3 entries sample:', entries.slice(-3));
        
        // Check if entries have the expected structure
        const firstEntry = entries[0];
        console.log('🔍 First entry structure:', {
          hasAccountId: !!firstEntry.accountId,
          hasAccountName: !!firstEntry.accountName,
          hasStartTime: !!firstEntry.startTime,
          hasEndTime: !!firstEntry.endTime,
          hasDuration: !!firstEntry.duration,
          keys: Object.keys(firstEntry)
        });
      }
      
      // Analyze unique employees
      const uniqueEmployees = [...new Set(entries.map((entry: any) => entry.accountName))];
      console.log(`👥 Unique employees found: ${uniqueEmployees.length}`);
      console.log('Employee names:', uniqueEmployees);
      
      // Analyze entries per employee
      const entriesPerEmployee = entries.reduce((acc: any, entry: any) => {
        const name = entry.accountName;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 Entries per employee:', entriesPerEmployee);
      
      return entries;
    } catch (error) {
      console.error('Error fetching TeamLogger data:', error);
      throw error;
    }
  }

  static async fetchDailyData(date: Date): Promise<TeamLoggerTimesheetEntry[]> {
    // Get start and end of the day in milliseconds (epoch format)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('📅 Daily Data Request:');
    console.log('Date:', date.toDateString());
    console.log('Start of day:', startOfDay.toISOString(), '(', startOfDay.getTime(), ')');
    console.log('End of day:', endOfDay.toISOString(), '(', endOfDay.getTime(), ')');

    return this.fetchTimesheetData(
      startOfDay.getTime(),
      endOfDay.getTime()
    );
  }

  static async fetchMonthData(month: number, year: number): Promise<TeamLoggerTimesheetEntry[]> {
    // Get start and end of the month in milliseconds (epoch format)
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    console.log('📅 Monthly Data Request:');
    console.log('Month/Year:', month, '/', year);
    console.log('Start of month:', startOfMonth.toISOString(), '(', startOfMonth.getTime(), ')');
    console.log('End of month:', endOfMonth.toISOString(), '(', endOfMonth.getTime(), ')');

    return this.fetchTimesheetData(
      startOfMonth.getTime(),
      endOfMonth.getTime()
    );
  }

  // Convert TeamLogger data to our internal format
  static convertToTimesheetEvents(entries: TeamLoggerTimesheetEntry[]): any[] {
    console.log(`🔄 Converting ${entries.length} TeamLogger entries to timesheet events`);
    
    // Debug: Check the structure of the first few entries
    if (entries.length > 0) {
      console.log('🔍 First 3 TeamLogger entries structure:', entries.slice(0, 3));
      console.log('🔍 Available fields in first entry:', Object.keys(entries[0]));
      
      // Check if we have the expected fields
      const firstEntry = entries[0];
      console.log('🔍 Field validation:', {
        hasEmployeeName: !!firstEntry.employeeName,
        hasEmployeeGuid: !!firstEntry.employeeGuid,
        hasEmployeeCode: !!firstEntry.employeeCode,
        hasStartTime: !!firstEntry.startTime,
        hasEndTime: !!firstEntry.endTime,
        employeeNameValue: firstEntry.employeeName,
        employeeGuidValue: firstEntry.employeeGuid
      });
    }
    
    const events: any[] = [];
    const employeeStats = new Map<string, number>();

    console.log('🔍 Processing entries by employee:');
    entries.forEach(entry => {
      const startDate = new Date(entry.startTime);
      const endDate = new Date(entry.endTime);
      
      // Use the correct field names from TeamLogger API
      const employeeName = entry.employeeName || entry.employeeGuid || 'Unknown Employee';
      const employeeCode = entry.employeeCode || entry.employeeGuid || 'null';
      
      // Track entries per employee
      const count = employeeStats.get(employeeName) || 0;
      employeeStats.set(employeeName, count + 1);
      
      // Log first few entries for each employee
      if (count < 2) {
        console.log(`👤 ${employeeName} entry ${count + 1}:`, {
          employeeGuid: entry.employeeGuid,
          employeeName: entry.employeeName,
          employeeCode: entry.employeeCode,
          employeeName: employeeName,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          activeHours: entry.activeHours
        });
      }
      
      // Create IN event
      events.push({
        employeeCode: employeeCode,
        employeeName: employeeName,
        inOut: 'IN',
        dateString: this.formatDate(startDate),
        timeString: this.formatTime(startDate)
      });

      // Create OUT event
      events.push({
        employeeCode: employeeCode,
        employeeName: employeeName,
        inOut: 'OUT',
        dateString: this.formatDate(endDate),
        timeString: this.formatTime(endDate)
      });
    });

    // Log conversion statistics
    console.log('📊 Employee entry counts:', Object.fromEntries(employeeStats));
    console.log(`✅ Generated ${events.length} timesheet events (${events.length / 2} IN/OUT pairs)`);
    
    const uniqueEmployeesInEvents = [...new Set(events.map(e => e.employeeName))];
    console.log(`👥 Events created for ${uniqueEmployeesInEvents.length} employees:`, uniqueEmployeesInEvents);
    
    // Sort events by date and time
    const sortedEvents = events.sort((a, b) => {
      const dateA = this.parseDate(a.dateString);
      const dateB = this.parseDate(b.dateString);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      const timeA = this.parseTime(a.timeString);
      const timeB = this.parseTime(b.timeString);
      return timeA.getTime() - timeB.getTime();
    });
    
    console.log('🔍 Final sorted events sample (first 10):', sortedEvents.slice(0, 10));
    console.log('🔍 Final sorted events sample (last 10):', sortedEvents.slice(-10));
    
    return sortedEvents;
  }

  private static formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }

  private static formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private static parseDate(dateString: string): Date {
    const parts = dateString.split('-');
    const day = parseInt(parts[0]);
    const monthStr = parts[1];
    const year = 2000 + parseInt(parts[2]);
    
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    return new Date(year, monthMap[monthStr], day);
  }

  private static parseTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}