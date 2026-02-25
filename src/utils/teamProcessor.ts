import { processTimesheetData } from './timesheetProcessor';
import type { RawTimesheetEvent, TimesheetRecord } from '../types/timesheet';
import type { EmployeeStats, TeamStats, EmployeeData } from '../types/teamDashboard';

export async function processTeamData(csvData: any[]): Promise<{
  employeeData: EmployeeData[];
  teamStats: TeamStats;
}> {
  console.log('🔄 Processing team data with', csvData.length, 'events');
  console.log('📊 Raw events sample:', csvData.slice(0, 5));
  
  // Debug: Check for undefined employee names
  const undefinedEmployees = csvData.filter(event => !event.employeeName || event.employeeName === 'undefined');
  if (undefinedEmployees.length > 0) {
    console.error('❌ Found events with undefined employee names:', undefinedEmployees.slice(0, 5));
    console.error('❌ Total undefined employee events:', undefinedEmployees.length);
  }
  
  // Group events by employee
  const eventsByEmployee = csvData.reduce((acc, event) => {
    const employeeName = event.employeeName || event.employeeCode || 'Unknown Employee';
    
    if (!employeeName || employeeName === 'undefined') {
      console.error('❌ Skipping event with invalid employee name:', event);
      return acc;
    }
    
    if (!acc[employeeName]) {
      acc[employeeName] = [];
    }
    acc[employeeName].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  console.log('👥 Events grouped by employee (total employees:', Object.keys(eventsByEmployee).length, '):');
  Object.entries(eventsByEmployee).forEach(([name, events]) => {
    console.log(`  ${name}: ${events.length} events`);
  });

  const employeeData: EmployeeData[] = [];

  // Process each employee's data
  for (const [employeeName, events] of Object.entries(eventsByEmployee)) {
    console.log(`🔄 Processing employee ${employeeData.length + 1}/${Object.keys(eventsByEmployee).length}: ${employeeName} with ${events.length} events`);
    try {
      const { processedData, calculatedStats } = await processTimesheetData(events);
      
      // Calculate attendance rate correctly using actual month days
      const totalDaysInMonth = calculatedStats.totalDaysInMonth;
      const totalSundays = calculatedStats.totalSundays;
      const totalAbsentDays = calculatedStats.totalLeaveDays; // These are actual absent days
      
      // Available working days = Total days - Sundays - Saturday holidays
      const saturdayHolidays = processedData.filter(r => r.notes === 'Saturday Holiday').length;
      const totalWorkingDaysAvailable = totalDaysInMonth - totalSundays - saturdayHolidays;
      
      // Attendance rate = (Days actually worked) / (Available working days - Absent days) * 100
      // This excludes absent days from the denominator
      const daysActuallyWorked = calculatedStats.totalWorkingDays;
      const availableWorkingDaysExcludingAbsents = totalWorkingDaysAvailable - totalAbsentDays;
      
      let attendanceRate = 0;
      if (availableWorkingDaysExcludingAbsents > 0) {
        attendanceRate = (daysActuallyWorked / availableWorkingDaysExcludingAbsents) * 100;
      } else if (daysActuallyWorked > 0) {
        // If they worked but had no available days (edge case), set to 100%
        attendanceRate = 100;
      }
      
      // Cap attendance at 100%
      attendanceRate = Math.min(100, attendanceRate);
      
      const employeeStats: EmployeeStats = {
        employeeName,
        ...calculatedStats,
        attendanceRate,
        performanceScore: calculatePerformanceScore(calculatedStats, processedData, null, attendanceRate), // No rating initially
        riskLevel: determineRiskLevel(calculatedStats, attendanceRate),
        breakComplianceRate: calculateBreakComplianceRate(processedData),
        avgDailyHours: calculateAvgDailyHours(processedData)
      };

      employeeData.push({
        employeeName,
        records: processedData,
        stats: employeeStats
      });
      
      console.log(`✅ Successfully processed ${employeeName}: ${processedData.length} records`);
    } catch (error) {
      console.error(`❌ Error processing data for ${employeeName}:`, error);
    }
  }

  console.log(`🎉 Final result: ${employeeData.length} employees processed`);
  employeeData.forEach(emp => {
    console.log(`  ${emp.employeeName}: ${emp.records.length} records`);
  });

  // Calculate team statistics
  const teamStats = calculateTeamStats(employeeData);

  return { employeeData, teamStats };
}

function calculatePerformanceScore(stats: any, records: TimesheetRecord[], performanceRating: number | null, attendanceRate: number): number {
  let score = 100;
  
  // Deduct for late arrivals (30% weight)
  score -= stats.latePercentage * 0.3;
  
  // Deduct for break non-compliance (20% weight) - excluding Saturdays and Sundays
  const breakCompliance = calculateBreakComplianceRate(records);
  score -= (100 - breakCompliance) * 0.2;
  
  // Deduct for absences (25% weight) - use the corrected attendance rate
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
  if (stats.eligibleOvertimeDays > 0) {
    const eligibilityRate = (stats.eligibleOvertimeDays / stats.overtimeDays) * 100;
    score += eligibilityRate * 0.05;
  }
  
  return Math.max(0, Math.min(100, score));
}

function determineRiskLevel(stats: any, attendanceRate: number): 'low' | 'medium' | 'high' | 'critical' {
  if (stats.latePercentage > 50 || attendanceRate < 70) return 'critical';
  if (stats.latePercentage > 30 || attendanceRate < 85) return 'high';
  if (stats.latePercentage > 15 || attendanceRate < 95) return 'medium';
  return 'low';
}

function calculateBreakComplianceRate(records: TimesheetRecord[]): number {
  // Only consider Monday-Friday for break compliance (exclude Saturdays and Sundays)
  const workingDays = records.filter(r => 
    r.status === 'Working Day' && 
    r.day !== 'Saturday' && 
    r.day !== 'Sunday'
  );
  
  if (workingDays.length === 0) return 100;
  
  const compliantDays = workingDays.filter(r => 
    r.lunchBreakApplied === 'Yes' && r.eveningBreakApplied === 'Yes'
  ).length;
  
  return (compliantDays / workingDays.length) * 100;
}

function calculateAvgDailyHours(records: TimesheetRecord[]): number {
  const workingDays = records.filter(r => r.status === 'Working Day' && r.totalHours > 0);
  if (workingDays.length === 0) return 0;
  
  const totalHours = workingDays.reduce((sum, r) => sum + r.totalHours, 0);
  return totalHours / workingDays.length;
}

function calculateTeamStats(employeeData: EmployeeData[]): TeamStats {
  const totalEmployees = employeeData.length;
  
  if (totalEmployees === 0) {
    return {
      totalEmployees: 0,
      avgAttendanceRate: 0,
      avgLatePercentage: 0,
      totalOvertimeHours: 0,
      totalLostOvertimeHours: 0,
      highRiskEmployees: 0,
      topPerformers: [],
      needsAttention: [],
      monthlyTrends: {
        totalWorkingDays: 0,
        avgHoursPerDay: 0,
        complianceRate: 0
      }
    };
  }
  
  const avgAttendanceRate = employeeData.reduce((sum, emp) => sum + emp.stats.attendanceRate, 0) / totalEmployees;
  const avgLatePercentage = employeeData.reduce((sum, emp) => sum + emp.stats.latePercentage, 0) / totalEmployees;
  const totalOvertimeHours = employeeData.reduce((sum, emp) => sum + emp.stats.totalOvertimeHours, 0);
  const totalLostOvertimeHours = employeeData.reduce((sum, emp) => sum + emp.stats.lostOvertimeHours, 0);
  const highRiskEmployees = employeeData.filter(emp => emp.stats.riskLevel === 'high' || emp.stats.riskLevel === 'critical').length;
  
  // Sort by performance score
  const sortedByPerformance = [...employeeData].sort((a, b) => b.stats.performanceScore - a.stats.performanceScore);
  const topPerformers = sortedByPerformance.slice(0, 3).map(emp => emp.stats);
  const needsAttention = sortedByPerformance.slice(-3).map(emp => emp.stats);
  
  const totalWorkingDays = employeeData.reduce((sum, emp) => sum + emp.stats.totalWorkingDays, 0);
  const avgHoursPerDay = employeeData.reduce((sum, emp) => sum + emp.stats.avgDailyHours, 0) / totalEmployees;
  const avgBreakCompliance = employeeData.reduce((sum, emp) => sum + emp.stats.breakComplianceRate, 0) / totalEmployees;
  
  return {
    totalEmployees,
    avgAttendanceRate,
    avgLatePercentage,
    totalOvertimeHours,
    totalLostOvertimeHours,
    highRiskEmployees,
    topPerformers,
    needsAttention,
    monthlyTrends: {
      totalWorkingDays,
      avgHoursPerDay,
      complianceRate: avgBreakCompliance
    }
  };
}