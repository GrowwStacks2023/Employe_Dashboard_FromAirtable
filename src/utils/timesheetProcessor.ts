import type { RawTimesheetEvent, TimesheetRecord, ProcessedStats, WorkSession } from '../types/timesheet';

interface ValidationReport {
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  dateRange: { start: string; end: string };
  arrivalTimeValidations: Array<{
    date: string;
    originalFirstEvent: string;
    validArrivalTime: string;
    reason: string;
  }>;
  breakValidations: Array<{
    date: string;
    lunchBreakDetected: boolean;
    eveningBreakDetected: boolean;
    breakPeriods: Array<{ start: string; end: string; duration: number }>;
  }>;
  overtimeValidations: Array<{
    date: string;
    totalHours: number;
    overtimeHours: number;
    eligibility: string;
    reason: string;
  }>;
  holidayValidations: Array<{
    date: string;
    day: string;
    holidayType: string;
    reason: string;
  }>;
}

export async function processTimesheetData(csvData: any[]): Promise<{
  processedData: TimesheetRecord[];
  calculatedStats: ProcessedStats;
  validationReport: ValidationReport;
}> {
  // Convert CSV data to typed events
  const events: RawTimesheetEvent[] = csvData
    .filter(row => row.employeeName && row.inOut && row.dateString && row.timeString)
    .map(row => ({
      employeeCode: row.employeeCode || 'null',
      employeeName: row.employeeName,
      inOut: row.inOut,
      dateString: row.dateString,
      timeString: row.timeString
    }));

  // Initialize validation report
  const validationReport: ValidationReport = {
    totalEvents: events.length,
    validEvents: 0,
    invalidEvents: 0,
    dateRange: { start: '', end: '' },
    arrivalTimeValidations: [],
    breakValidations: [],
    overtimeValidations: [],
    holidayValidations: []
  };

  // Process work sessions with validation
  const workSessions = processWorkSessionsWithValidation(events, validationReport);
  
  // Generate full month data with proper date sequencing and holiday handling
  const fullMonthData = generateFullMonthDataWithHolidays(workSessions, validationReport);
  
  // Calculate statistics with validation
  const stats = calculateStatsWithValidation(fullMonthData, validationReport);
  
  return {
    processedData: fullMonthData,
    calculatedStats: stats,
    validationReport
  };
}

function processWorkSessionsWithValidation(events: RawTimesheetEvent[], validationReport: ValidationReport): WorkSession[] {
  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const date = normalizeDate(event.dateString);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, RawTimesheetEvent[]>);

  // Set date range for validation
  const dates = Object.keys(eventsByDate).sort((a, b) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);
    return dateA.getTime() - dateB.getTime();
  });
  
  if (dates.length > 0) {
    validationReport.dateRange = { start: dates[0], end: dates[dates.length - 1] };
  }

  const workSessions: WorkSession[] = [];

  for (const [dateStr, dateEvents] of Object.entries(eventsByDate)) {
    // Sort events by time
    const sortedEvents = dateEvents.sort((a, b) => {
      const timeA = parseTime(a.timeString);
      const timeB = parseTime(b.timeString);
      return timeA.getTime() - timeB.getTime();
    });

    // Find official arrival time (first IN event between 9 AM - 12 PM) for late detection
    const officialArrivalEvent = findOfficialArrivalTime(sortedEvents, dateStr, validationReport);
    
    // Calculate ALL working sessions throughout the day (including early morning, midnight, etc.)
    const { sessions, breaks, totalWorked } = calculateAllWorkingSessions(sortedEvents, dateStr, validationReport);
    
    if (sessions.length === 0 && !officialArrivalEvent) {
      // No work sessions found, skip this date
      continue;
    }

    const day = getDayOfWeek(dateStr);

    workSessions.push({
      date: dateStr,
      day,
      sessions,
      totalWorked,
      breaks,
      officialArrivalTime: officialArrivalEvent ? parseTime(officialArrivalEvent.timeString) : null
    });

    validationReport.validEvents += sortedEvents.length;
  }

  validationReport.invalidEvents = validationReport.totalEvents - validationReport.validEvents;
  return workSessions;
}

function findOfficialArrivalTime(events: RawTimesheetEvent[], dateStr: string, validationReport: ValidationReport): RawTimesheetEvent | null {
  const inEvents = events.filter(event => event.inOut === 'IN');
  
  if (inEvents.length === 0) return null;

  const firstEvent = inEvents[0];
  
  // Find first IN event between 9 AM - 12 PM for official arrival time
  for (const event of inEvents) {
    const eventTime = parseTime(event.timeString);
    const hour = eventTime.getHours();
    
    if (hour >= 9 && hour < 12) {
      // Valid official arrival time found
      validationReport.arrivalTimeValidations.push({
        date: dateStr,
        originalFirstEvent: formatTime(parseTime(firstEvent.timeString)),
        validArrivalTime: formatTime(eventTime),
        reason: 'Official arrival time found between 9 AM - 12 PM'
      });
      return event;
    }
  }

  // No official arrival time found in 9 AM - 12 PM window
  validationReport.arrivalTimeValidations.push({
    date: dateStr,
    originalFirstEvent: formatTime(parseTime(firstEvent.timeString)),
    validArrivalTime: 'No arrival in 9 AM - 12 PM window',
    reason: 'No IN event between 9 AM - 12 PM, cannot determine late status'
  });
  
  return null; // No official arrival time
}

function calculateAllWorkingSessions(events: RawTimesheetEvent[], dateStr: string, validationReport: ValidationReport): {
  sessions: Array<{ inTime: Date; outTime: Date; duration: number }>;
  breaks: Array<{ start: Date; end: Date; duration: number }>;
  totalWorked: number;
} {
  const sessions: Array<{ inTime: Date; outTime: Date; duration: number }> = [];
  const breaks: Array<{ start: Date; end: Date; duration: number }> = [];

  let currentInTime: Date | null = null;
  
  // Process ALL events throughout the day to calculate total working hours
  for (const event of events) {
    const eventTime = parseTime(event.timeString);
    
    if (event.inOut === 'IN') {
      if (currentInTime && currentInTime.getTime() !== eventTime.getTime()) {
        // If we have a previous IN without an OUT, consider it a very short session
        const duration = 0.01; // 1 minute minimum
        sessions.push({
          inTime: currentInTime,
          outTime: currentInTime,
          duration
        });
      }
      currentInTime = eventTime;
    } else if (event.inOut === 'OUT' && currentInTime) {
      const duration = (eventTime.getTime() - currentInTime.getTime()) / (1000 * 60 * 60); // hours
      if (duration > 0) {
        sessions.push({
          inTime: currentInTime,
          outTime: eventTime,
          duration
        });
      }
      currentInTime = null;
    }
  }

  // Calculate breaks between sessions
  for (let i = 0; i < sessions.length - 1; i++) {
    const currentOut = sessions[i].outTime;
    const nextIn = sessions[i + 1].inTime;
    const breakDuration = (nextIn.getTime() - currentOut.getTime()) / (1000 * 60 * 60);
    
    if (breakDuration > 0) {
      breaks.push({
        start: currentOut,
        end: nextIn,
        duration: breakDuration
      });
    }
  }

  const totalWorked = sessions.reduce((sum, session) => sum + session.duration, 0);

  // Validate break detection
  detectBreaksWithValidation(breaks, dateStr, validationReport);

  return { sessions, breaks, totalWorked };
}

function detectBreaksWithValidation(breaks: Array<{ start: Date; end: Date; duration: number }>, dateStr: string, validationReport: ValidationReport): {
  lunchBreak: boolean;
  eveningBreak: boolean;
} {
  let lunchBreak = false;
  let eveningBreak = false;
  
  const breakPeriods: Array<{ start: string; end: string; duration: number }> = [];
  
  for (const breakPeriod of breaks) {
    const startHour = breakPeriod.start.getHours();
    const startMinute = breakPeriod.start.getMinutes();
    const endHour = breakPeriod.end.getHours();
    const endMinute = breakPeriod.end.getMinutes();
    const durationMinutes = breakPeriod.duration * 60;
    
    breakPeriods.push({
      start: formatTime(breakPeriod.start),
      end: formatTime(breakPeriod.end),
      duration: durationMinutes
    });
    
    // Lunch break: between 1:40 PM (13:40) and 2:20 PM (14:20), minimum 30 minutes
    if (durationMinutes >= 30) {
      // Check if break starts within lunch window
      if ((startHour === 13 && startMinute >= 40) || 
          (startHour === 14 && startMinute <= 20) ||
          // Also check if break overlaps with lunch window
          (startHour <= 13 && endHour >= 14)) {
        lunchBreak = true;
      }
    }
    
    // Evening break: between 5:00 PM (17:00) and 5:20 PM (17:20), minimum 15 minutes
    if (durationMinutes >= 15) {
      // Check if break starts within evening window
      if ((startHour === 17 && startMinute >= 0 && startMinute <= 20) ||
          // Also check for breaks that start around 4:59 PM and end around 5:34 PM
          (startHour === 16 && startMinute >= 59) ||
          (startHour === 17 && startMinute <= 34 && endHour === 17 && endMinute >= 15)) {
        eveningBreak = true;
      }
    }
  }
  
  validationReport.breakValidations.push({
    date: dateStr,
    lunchBreakDetected: lunchBreak,
    eveningBreakDetected: eveningBreak,
    breakPeriods
  });
  
  return { lunchBreak, eveningBreak };
}

function getHolidayType(day: string, dayOfMonth: number): 'Sunday' | 'Saturday Holiday' | 'Saturday Half Day' | null {
  if (day === 'Sunday') {
    return 'Sunday';
  }
  
  if (day === 'Saturday') {
    // Calculate which Saturday of the month this is
    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    
    // 2nd and 4th Saturdays are holidays
    if (weekOfMonth === 2 || weekOfMonth === 4) {
      return 'Saturday Holiday';
    }
    // 1st and 3rd Saturdays are half days (9 AM - 1 PM)
    else if (weekOfMonth === 1 || weekOfMonth === 3) {
      return 'Saturday Half Day';
    }
  }
  
  return null;
}

function generateFullMonthDataWithHolidays(workSessions: WorkSession[], validationReport: ValidationReport): TimesheetRecord[] {
  const fullMonthData: TimesheetRecord[] = [];
  
  // Determine the month and year from the work sessions
  let monthYear = 'Jun-25'; // Default
  let year = 2025;
  let month = 5; // June (0-indexed)
  
  if (workSessions.length > 0) {
    const firstDate = workSessions[0].date;
    const parts = firstDate.split('-');
    if (parts.length >= 2) {
      monthYear = `${parts[1]}-${parts[2]}`;
      year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      month = monthMap[parts[1]] || 5;
    }
  }
  
  // Get the actual number of days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${day.toString().padStart(2, '0')}-${monthYear}`;
    const dayOfWeek = getDayOfWeek(dateStr);
    const holidayType = getHolidayType(dayOfWeek, day);
    
    // Log holiday validation
    if (holidayType) {
      validationReport.holidayValidations.push({
        date: dateStr,
        day: dayOfWeek,
        holidayType,
        reason: holidayType === 'Sunday' ? 'All Sundays are off' :
                holidayType === 'Saturday Holiday' ? `${Math.ceil(day / 7)} Saturday - Holiday (2nd & 4th Saturdays off)` :
                `${Math.ceil(day / 7)} Saturday - Half Day (1st & 3rd Saturdays 9 AM - 1 PM)`
      });
    }
    
    const workSession = workSessions.find(ws => {
      // Match by day number, handling different date formats
      const wsDay = parseInt(ws.date.split('-')[0]);
      return wsDay === day;
    });
    
    if (workSession) {
      const record = processWorkSessionToRecordWithValidation(workSession, validationReport, holidayType);
      fullMonthData.push(record);
    } else {
      // No data for this day - determine status based on holiday type
      let status: 'Working Day' | 'On Leave' | 'Sunday' = 'Working Day';
      let notes = 'Absent';
      
      if (holidayType === 'Sunday') {
        status = 'Sunday';
        notes = 'Sunday';
      } else if (holidayType === 'Saturday Holiday') {
        status = 'Sunday'; // Treat Saturday holidays like Sundays for status
        notes = 'Saturday Holiday';
      } else if (holidayType === 'Saturday Half Day') {
        status = 'Working Day';
        notes = 'Saturday Half Day - No Login';
      } else {
        // Regular working day with no login = Absent
        status = 'Working Day';
        notes = 'Absent';
      }
      
      fullMonthData.push({
        date: dateStr,
        day: dayOfWeek,
        inTime: '-',
        arrivalTime: '-', // No arrival time for absent days
        outTime: '-',
        totalHours: 0,
        overtimeHours: 0,
        lateStatus: '-',
        lunchBreakApplied: '-',
        eveningBreakApplied: '-',
        overtimeEligibility: '-',
        notes,
        status
      });
    }
  }
  
  return fullMonthData;
}

function processWorkSessionToRecordWithValidation(
  workSession: WorkSession & { officialArrivalTime?: Date | null }, 
  validationReport: ValidationReport, 
  holidayType: 'Sunday' | 'Saturday Holiday' | 'Saturday Half Day' | null
): TimesheetRecord {
  const firstSession = workSession.sessions[0];
  const lastSession = workSession.sessions[workSession.sessions.length - 1];
  
  // In Time: First session start time (could be any time of day)
  const inTime = firstSession ? formatTime(firstSession.inTime) : '-';
  
  // Arrival Time: Official arrival time (first IN between 9 AM - 12 PM)
  const arrivalTime = workSession.officialArrivalTime ? formatTime(workSession.officialArrivalTime) : '-';
  
  // Out Time: Last session end time
  const outTime = lastSession ? formatTime(lastSession.outTime) : '-';
  
  // Calculate late status using ONLY the official arrival time (9 AM - 12 PM window)
  const lateStatus = calculateLateStatusWithValidation(workSession.day, workSession.officialArrivalTime, holidayType);
  
  // Detect breaks (already validated in previous step)
  const breakValidation = validationReport.breakValidations.find(bv => bv.date === workSession.date);
  const lunchBreak = breakValidation?.lunchBreakDetected || false;
  const eveningBreak = breakValidation?.eveningBreakDetected || false;
  
  // Calculate overtime using TOTAL working hours (including all sessions)
  let overtimeHours = 0;
  let expectedHours = 8; // Default full day
  
  if (holidayType === 'Saturday Half Day') {
    expectedHours = 4; // Half day is 4 hours (9 AM - 1 PM)
  }
  
  overtimeHours = Math.max(0, workSession.totalWorked - expectedHours);
  
  // Determine overtime eligibility with validation
  const overtimeEligibility = determineOvertimeEligibilityWithValidation(lunchBreak, eveningBreak, overtimeHours, holidayType);
  
  // Add overtime validation
  validationReport.overtimeValidations.push({
    date: workSession.date,
    totalHours: workSession.totalWorked,
    overtimeHours,
    eligibility: overtimeEligibility,
    reason: overtimeHours === 0 ? 'No overtime worked' : 
            holidayType === 'Saturday Half Day' ? 'Saturday half day - no break requirement' :
            holidayType === 'Saturday Holiday' ? 'Saturday holiday - no break requirement' :
            holidayType === 'Sunday' ? 'Sunday work - no break requirement' :
            (lunchBreak && eveningBreak) ? 'Both breaks applied - eligible' : 
            'Missing break(s) - not eligible'
  });
  
  // Generate notes
  let notes = '';
  if (lateStatus === 'Late') {
    notes = 'Late Coming';
  }
  if (holidayType === 'Sunday' && workSession.totalWorked > 0) {
    notes = notes ? notes + ' - Sunday Work' : 'Sunday Work';
  }
  if (holidayType === 'Saturday Holiday' && workSession.totalWorked > 0) {
    notes = notes ? notes + ' - Holiday Work' : 'Holiday Work';
  }
  
  // Determine status
  let status: 'Working Day' | 'On Leave' | 'Sunday' = 'Working Day';
  if (holidayType === 'Sunday') {
    status = 'Sunday';
  }
  
  return {
    date: workSession.date,
    day: workSession.day,
    inTime,
    arrivalTime, // New column showing official arrival time
    outTime,
    totalHours: workSession.totalWorked,
    overtimeHours,
    lateStatus,
    lunchBreakApplied: lunchBreak ? 'Yes' : 'No',
    eveningBreakApplied: eveningBreak ? 'Yes' : 'No',
    overtimeEligibility,
    notes,
    status
  };
}

function calculateLateStatusWithValidation(
  day: string, 
  officialArrivalTime?: Date | null, 
  holidayType?: 'Sunday' | 'Saturday Holiday' | 'Saturday Half Day' | null
): 'Late' | 'On Time' | '-' {
  if (!officialArrivalTime) return '-'; // No official arrival time found in 9 AM - 12 PM window
  
  const hour = officialArrivalTime.getHours();
  const minute = officialArrivalTime.getMinutes();
  const totalMinutes = hour * 60 + minute;
  
  if (day === 'Saturday') {
    if (holidayType === 'Saturday Half Day') {
      // 1st and 3rd Saturdays: late if after 9:15 AM
      return totalMinutes > (9 * 60 + 15) ? 'Late' : 'On Time';
    } else if (holidayType === 'Saturday Holiday') {
      // 2nd and 4th Saturdays: working on holiday, no late rule
      return 'On Time';
    } else {
      // Fallback: late if after 9:15 AM
      return totalMinutes > (9 * 60 + 15) ? 'Late' : 'On Time';
    }
  } else if (day === 'Sunday') {
    // Working on Sunday, no specific late rule
    return 'On Time';
  } else {
    // Monday-Friday: late if after 11:15 AM
    return totalMinutes > (11 * 60 + 15) ? 'Late' : 'On Time';
  }
}

function determineOvertimeEligibilityWithValidation(
  lunchBreak: boolean, 
  eveningBreak: boolean, 
  overtimeHours: number,
  holidayType?: 'Sunday' | 'Saturday Holiday' | 'Saturday Half Day' | null
): 'Eligible for Overtime' | 'Overtime Not Eligible (Break Not Applied)' | '-' {
  if (overtimeHours === 0) return '-';
  
  // Special rules for Saturdays and Sundays - no break requirement
  if (holidayType === 'Sunday' || holidayType === 'Saturday Holiday' || holidayType === 'Saturday Half Day') {
    // Working on weekends/holidays - no break compliance required
    return 'Eligible for Overtime';
  }
  
  // Regular weekdays (Monday-Friday) - break compliance required
  if (lunchBreak && eveningBreak) {
    return 'Eligible for Overtime';
  } else {
    return 'Overtime Not Eligible (Break Not Applied)';
  }
}

function calculateStatsWithValidation(data: TimesheetRecord[], validationReport: ValidationReport): ProcessedStats {
  const workingDays = data.filter(r => r.status === 'Working Day');
  const sundays = data.filter(r => r.status === 'Sunday' || r.notes === 'Sunday');
  const absentDays = data.filter(r => r.notes === 'Absent');
  
  const lateDays = workingDays.filter(r => r.lateStatus === 'Late').length;
  const overtimeDays = data.filter(r => r.overtimeHours > 0).length; // Include all days with OT
  const eligibleOvertimeDays = data.filter(r => 
    r.overtimeEligibility === 'Eligible for Overtime' && r.overtimeHours > 0
  ).length;
  
  const totalOvertimeHours = data.reduce((sum, r) => sum + r.overtimeHours, 0);
  const totalEligibleOvertimeHours = data
    .filter(r => r.overtimeEligibility === 'Eligible for Overtime')
    .reduce((sum, r) => sum + r.overtimeHours, 0);
  const lostOvertimeHours = totalOvertimeHours - totalEligibleOvertimeHours;
  
  return {
    totalDaysInMonth: data.length,
    totalWorkingDays: workingDays.length,
    totalSundays: sundays.length,
    totalLeaveDays: absentDays.length, // Absent days are now tracked separately
    lateDays,
    overtimeDays,
    eligibleOvertimeDays,
    totalEligibleOvertimeHours,
    totalOvertimeHours,
    lostOvertimeHours,
    latePercentage: workingDays.length > 0 ? (lateDays / workingDays.length) * 100 : 0
  };
}

// Helper functions
function normalizeDate(dateString: string): string {
  // Convert various date formats to consistent format
  // Handle "01 Jun 2025", "01-Jun-25", etc.
  const parts = dateString.replace(/[-\s]/g, ' ').split(' ');
  const day = parts[0].padStart(2, '0');
  const month = parts[1];
  const year = parts[2].length === 2 ? parts[2] : parts[2].slice(-2);
  
  return `${day}-${month}-${year}`;
}

function parseDate(dateString: string): Date {
  const parts = dateString.replace(/[-\s]/g, ' ').split(' ');
  const day = parseInt(parts[0]);
  const monthStr = parts[1];
  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
  
  const monthMap: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  return new Date(year, monthMap[monthStr], day);
}

function parseTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getDayOfWeek(dateString: string): string {
  // Parse date string like "01 Jun 2025" or "01-Jun-25"
  const parts = dateString.replace(/[-\s]/g, ' ').split(' ');
  const day = parseInt(parts[0]);
  const monthStr = parts[1];
  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
  
  const monthMap: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const date = new Date(year, monthMap[monthStr], day);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}