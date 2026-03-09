import React, { useState, useEffect } from 'react';
import { BarChart3, FileText, Calendar, Clock, AlertTriangle, Users, ArrowLeft, Database, RefreshCw, CheckCircle2, Star, Upload, Download } from 'lucide-react';
// Database service handles all Airtable operations
import Dashboard from './components/Dashboard';
import TimesheetTable from './components/TimesheetTable';
import TeamDashboard from './components/TeamDashboard';
import MonthSelector from './components/MonthSelector';
import CSVUploadPage from './components/CSVUploadPage';
import TeamLoggerImportPanel from './components/TeamLoggerImportPanel';
import { DatabaseService, invalidateCache, type MonthYear, type PerformanceRating } from './services/databaseService';
import type { TimesheetRecord, ProcessedStats } from './types/timesheet';
import type { EmployeeData, TeamStats } from './types/teamDashboard';

function App() {
  const [timesheetData, setTimesheetData] = useState<TimesheetRecord[]>([]);
  const [stats, setStats] = useState<ProcessedStats | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'dashboard' | 'processing' | 'individual' | 'team-dashboard' | 'upload'>('dashboard');

  // Team dashboard state
  const [teamData, setTeamData] = useState<EmployeeData[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [isTeamMode, setIsTeamMode] = useState(false);

  // Database state
  const [availableMonths, setAvailableMonths] = useState<MonthYear[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthYear | null>(null);
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Performance ratings state
  const [performanceRatings, setPerformanceRatings] = useState<PerformanceRating[]>([]);

  // TeamLogger import state
  const [showTeamLoggerImport, setShowTeamLoggerImport] = useState(false);

  // Load available months on component mount
  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // Load data when month is selected
  useEffect(() => {
    if (selectedMonth) {
      loadMonthData(selectedMonth);
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    setIsLoadingMonths(true);
    try {
      const months = await DatabaseService.getAvailableMonths();
      setAvailableMonths(months);
      
      // Auto-select the most recent month if available
      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0]);
      }
    } catch (error) {
      console.error('Error loading available months:', error);
    } finally {
      setIsLoadingMonths(false);
      setIsInitialLoad(false);
    }
  };

  const loadMonthData = async (month: MonthYear) => {
    setIsProcessing(true);
    setCurrentStep('processing');
    
    try {
      const { employeeData, performanceRatings, hasData, lastUpdated: dbLastUpdated } = await DatabaseService.loadMonthData(month.month, month.year);
      
      if (!hasData) {
        setCurrentStep('dashboard');
        setTeamData([]);
        setTeamStats(null);
        setTimesheetData([]);
        setStats(null);
        setIsTeamMode(false);
        setPerformanceRatings([]);
        setLastUpdated(null);
        return;
      }

      setPerformanceRatings(performanceRatings);
      setLastUpdated(dbLastUpdated);

      if (employeeData.length > 1) {
        // Team data - recalculate team stats with performance ratings
        setIsTeamMode(true);
        setTeamData(employeeData);
        
        // Calculate team stats with performance ratings
        const teamStats = calculateTeamStats(employeeData, performanceRatings);
        setTeamStats(teamStats);
        setCurrentStep('team-dashboard');
      } else if (employeeData.length === 1) {
        // Individual data
        setIsTeamMode(false);
        const employee = employeeData[0];
        setEmployeeName(employee.employeeName);
        setTimesheetData(employee.records);
        setStats({
          totalDaysInMonth: employee.stats.totalWorkingDays + employee.stats.totalSundays + employee.stats.totalLeaveDays,
          totalWorkingDays: employee.stats.totalWorkingDays,
          totalSundays: employee.stats.totalSundays,
          totalLeaveDays: employee.stats.totalLeaveDays,
          lateDays: employee.stats.lateDays,
          overtimeDays: employee.stats.overtimeDays,
          eligibleOvertimeDays: employee.stats.eligibleOvertimeDays,
          totalEligibleOvertimeHours: employee.stats.totalEligibleOvertimeHours,
          totalOvertimeHours: employee.stats.totalOvertimeHours,
          lostOvertimeHours: employee.stats.lostOvertimeHours,
          latePercentage: employee.stats.latePercentage
        });
        setCurrentStep('individual');
      }
    } catch (error) {
      console.error('Error loading month data:', error);
      setCurrentStep('dashboard');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateTeamStats = (employeeData: EmployeeData[], performanceRatings: PerformanceRating[]): TeamStats => {
    const totalEmployees = employeeData.length;
    
    const avgAttendanceRate = employeeData.reduce((sum, emp) => sum + emp.stats.attendanceRate, 0) / totalEmployees;
    const avgLatePercentage = employeeData.reduce((sum, emp) => sum + emp.stats.latePercentage, 0) / totalEmployees;
    const totalOvertimeHours = employeeData.reduce((sum, emp) => sum + emp.stats.totalOvertimeHours, 0);
    const totalLostOvertimeHours = employeeData.reduce((sum, emp) => sum + emp.stats.lostOvertimeHours, 0);
    const highRiskEmployees = employeeData.filter(emp => emp.stats.riskLevel === 'high' || emp.stats.riskLevel === 'critical').length;
    
    const sortedByPerformance = [...employeeData].sort((a, b) => b.stats.performanceScore - a.stats.performanceScore);
    const topPerformers = sortedByPerformance.slice(0, 3).map(emp => emp.stats);
    const needsAttention = sortedByPerformance.slice(-3).map(emp => emp.stats);
    
    const totalWorkingDays = employeeData.reduce((sum, emp) => sum + emp.stats.totalWorkingDays, 0);
    const avgHoursPerDay = employeeData.reduce((sum, emp) => sum + emp.stats.avgDailyHours, 0) / totalEmployees;
    const avgBreakCompliance = employeeData.reduce((sum, emp) => sum + emp.stats.breakComplianceRate, 0) / totalEmployees;
    
    // Calculate average performance rating
    const employeesWithRatings = performanceRatings.filter(r => r.performance_star_rating !== null);
    const avgPerformanceRating = employeesWithRatings.length > 0 
      ? employeesWithRatings.reduce((sum, r) => sum + (r.performance_star_rating || 0), 0) / employeesWithRatings.length
      : null;
    
    return {
      totalEmployees,
      avgAttendanceRate,
      avgLatePercentage,
      totalOvertimeHours,
      totalLostOvertimeHours,
      highRiskEmployees,
      topPerformers,
      needsAttention,
      avgPerformanceRating,
      monthlyTrends: {
        totalWorkingDays,
        avgHoursPerDay,
        complianceRate: avgBreakCompliance
      }
    };
  };

  // Get performance rating for an employee
  const getEmployeeRating = (employeeName: string): number | null => {
    console.log(`🔍 App - Looking for rating for employee: "${employeeName}"`);
    console.log(`🔍 App - Available ratings:`, performanceRatings.map(r => ({ 
      name: `"${r.employee_name}"`, 
      rating: r.performance_star_rating,
      trimmed: `"${r.employee_name.trim()}"`
    })));
    
    const rating = performanceRatings.find(r => {
      // Try exact match first
      const exactMatch = r.employee_name === employeeName;
      // Try trimmed match
      const trimmedMatch = r.employee_name.trim() === employeeName.trim();
      // Try case-insensitive match
      const caseInsensitiveMatch = r.employee_name.trim().toLowerCase() === employeeName.trim().toLowerCase();
      
      const match = exactMatch || trimmedMatch || caseInsensitiveMatch;
      console.log(`🔍 App - Comparing "${r.employee_name}" with "${employeeName}":`, {
        exactMatch,
        trimmedMatch,
        caseInsensitiveMatch,
        finalMatch: match
      });
      return match;
    });
    
    const result = rating?.performance_star_rating || null;
    console.log(`🔍 App - Final rating for "${employeeName}": ${result}`);
    return result;
  };

  const handleEmployeeSelect = async (selectedEmployeeName: string) => {
    console.log(`🔍 Selecting employee: "${selectedEmployeeName}"`);
    console.log(`🔍 Available employees:`, teamData.map(emp => emp.employeeName));
    console.log(`🔍 Available employees with record counts:`, teamData.map(emp => ({ 
      name: emp.employeeName, 
      recordCount: emp.records.length,
      hasRecords: emp.records.length > 0
    })));
    
    const selectedEmployee = teamData.find(emp => emp.employeeName === selectedEmployeeName);
    console.log(`🔍 Found employee data:`, selectedEmployee ? {
      name: selectedEmployee.employeeName,
      recordCount: selectedEmployee.records.length,
      workingDays: selectedEmployee.stats.totalWorkingDays,
      hasRecords: selectedEmployee.records.length > 0,
      firstFewRecords: selectedEmployee.records.slice(0, 3).map(r => ({ date: r.date, day: r.day, inTime: r.inTime }))
    } : 'NOT FOUND');
    
    if (selectedEmployee) {
      if (selectedEmployee.records.length === 0) {
        console.warn(`⚠️ Selected employee "${selectedEmployeeName}" has NO timesheet records!`);
        console.warn(`⚠️ Stats show ${selectedEmployee.stats.totalWorkingDays + selectedEmployee.stats.totalSundays + selectedEmployee.stats.totalLeaveDays} total days but 0 records`);
        console.warn(`⚠️ This will result in an empty timesheet table`);
        
        // Try to reload data for this specific employee from Airtable
        if (selectedMonth) {
          console.warn(`⚠️ Attempting to reload data for ${selectedMonth.month}/${selectedMonth.year}...`);
          try {
            const { employeeData: reloadedData } = await DatabaseService.loadMonthData(selectedMonth.month, selectedMonth.year);
            const reloadedEmployee = reloadedData.find(emp => emp.employeeName.trim().toLowerCase() === selectedEmployeeName.trim().toLowerCase());
            if (reloadedEmployee && reloadedEmployee.records.length > 0) {
              selectedEmployee.records = reloadedEmployee.records;
              console.warn(`⚠️ Reloaded ${reloadedEmployee.records.length} records from Airtable`);
            }
          } catch (queryError) {
            console.warn('⚠️ Failed to reload employee records:', queryError);
          }
        }
      }
      
      setEmployeeName(selectedEmployee.employeeName);
      setTimesheetData(selectedEmployee.records);
      setStats({
        totalDaysInMonth: selectedEmployee.stats.totalWorkingDays + selectedEmployee.stats.totalSundays + selectedEmployee.stats.totalLeaveDays,
        totalWorkingDays: selectedEmployee.stats.totalWorkingDays,
        totalSundays: selectedEmployee.stats.totalSundays,
        totalLeaveDays: selectedEmployee.stats.totalLeaveDays,
        lateDays: selectedEmployee.stats.lateDays,
        overtimeDays: selectedEmployee.stats.overtimeDays,
        eligibleOvertimeDays: selectedEmployee.stats.eligibleOvertimeDays,
        totalEligibleOvertimeHours: selectedEmployee.stats.totalEligibleOvertimeHours,
        totalOvertimeHours: selectedEmployee.stats.totalOvertimeHours,
        lostOvertimeHours: selectedEmployee.stats.lostOvertimeHours,
        latePercentage: selectedEmployee.stats.latePercentage
      });
      setCurrentStep('individual');
    } else {
      console.warn(`⚠️ Employee "${selectedEmployeeName}" not found in team data`);
    }
  };

  const handleBackToTeam = () => {
    setCurrentStep('team-dashboard');
  };

  const handleBackToDashboard = () => {
    setCurrentStep('dashboard');
  };

  const handleUploadSuccess = (employeeData: EmployeeData[], month: number, year: number) => {
    // Clear cache so fresh data is used
    invalidateCache(month, year);
    // Update the current data with newly uploaded data
    setTeamData(employeeData);
    const newTeamStats = calculateTeamStats(employeeData, performanceRatings);
    setTeamStats(newTeamStats);
    
    // Update selected month
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    setSelectedMonth({
      month,
      year,
      label: `${monthNames[month - 1]} ${year}`
    });
    
    // Refresh available months
    loadAvailableMonths();
    
    // Set team mode and go to team dashboard
    setIsTeamMode(true);
    setCurrentStep('team-dashboard');
  };

  const handleTeamLoggerImportSuccess = (employeeData: EmployeeData[], month: number, year: number) => {
    // Clear cache so fresh data is used
    invalidateCache(month, year);
    // Update the current data with newly imported data
    setTeamData(employeeData);
    const newTeamStats = calculateTeamStats(employeeData, performanceRatings);
    setTeamStats(newTeamStats);
    
    // Update selected month
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    setSelectedMonth({
      month,
      year,
      label: `${monthNames[month - 1]} ${year}`
    });
    
    // Refresh available months
    loadAvailableMonths();
    
    // Set team mode and go to team dashboard
    setIsTeamMode(true);
    setCurrentStep('team-dashboard');
    
    // Close import panel
    setShowTeamLoggerImport(false);
  };

  const formatLastUpdated = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (currentStep === 'upload') {
    return (
      <CSVUploadPage
        onBack={() => setCurrentStep('dashboard')}
        onUploadSuccess={handleUploadSuccess}
      />
    );
  }

  if (showTeamLoggerImport) {
    return (
      <TeamLoggerImportPanel
        onClose={() => setShowTeamLoggerImport(false)}
        onImportSuccess={handleTeamLoggerImportSuccess}
      />
    );
  }

  if (currentStep === 'processing' || isInitialLoad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Data</h2>
          <p className="text-gray-600 max-w-md">
            Loading timesheet data from database...
          </p>
        </div>
      </div>
    );
  }

  if (currentStep === 'team-dashboard' && teamStats) {
    return (
      <TeamDashboard 
        employeeData={teamData}
        teamStats={teamStats}
        performanceRatings={performanceRatings}
        onEmployeeSelect={handleEmployeeSelect}
        selectedMonth={selectedMonth}
        lastUpdated={lastUpdated}
      />
    );
  }

  if (currentStep === 'individual' && stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Compact Header with All Elements in One Line */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              {/* Left Side - Navigation and Title */}
              <div className="flex items-center">
                {isTeamMode && (
                  <button
                    onClick={handleBackToTeam}
                    className="mr-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Team
                  </button>
                )}
                <button
                  onClick={handleBackToDashboard}
                  className="mr-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <BarChart3 className="h-6 w-6 text-blue-600 mr-3" />
                    Timesheet Analysis Report
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Employee: <span className="font-semibold text-gray-900">{employeeName}</span>
                  </p>
                </div>
              </div>
              
              {/* Right Side - All Controls in One Line */}
              <div className="flex items-center space-x-6">
                {/* Month Selector */}
                <div className="min-w-[200px]">
                  <MonthSelector
                    availableMonths={availableMonths}
                    selectedMonth={selectedMonth}
                    onMonthSelect={setSelectedMonth}
                    isLoading={isLoadingMonths}
                  />
                </div>
                
                {/* Last Updated */}
                {lastUpdated && (
                  <div className="text-right bg-gray-50 rounded-lg px-3 py-2 border">
                    <p className="text-xs text-gray-500 mb-1">Database Last Updated</p>
                    <p className="text-xs font-medium text-gray-700 flex items-center">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {formatLastUpdated(lastUpdated)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected Month Display */}
          {selectedMonth && (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-blue-800 font-medium">
                    Viewing data for: {selectedMonth.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <Dashboard stats={stats} />
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <TimesheetTable data={timesheetData} stats={stats} />
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard - Simplified without upload options
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Compact Header with All Elements in One Line */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            {/* Left Side - Title */}
            <div className="flex items-center">
              <img 
                src="/8a0b61_56b3f20c96644a46a80e712d4fdbb7ee~mv2.png" 
                alt="Growwstacks Logo" 
                className="h-10 w-auto mr-4"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Employee Timesheet Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Advanced attendance analysis system with comprehensive reporting
                </p>
              </div>
            </div>
            
            {/* Right Side - All Controls in One Line */}
            <div className="flex items-center space-x-6">
              {/* Upload Button */}
              <button
                onClick={() => setCurrentStep('upload')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Data
              </button>
              
              {/* TeamLogger Import Button */}
              <button
                onClick={() => setShowTeamLoggerImport(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Import from TeamLogger
              </button>
              
              {/* Month Selector */}
              <div className="min-w-[200px]">
                <MonthSelector
                  availableMonths={availableMonths}
                  selectedMonth={selectedMonth}
                  onMonthSelect={setSelectedMonth}
                  isLoading={isLoadingMonths}
                />
              </div>
              
              {/* Last Updated Info */}
              {lastUpdated && (
                <div className="text-right bg-gray-50 rounded-lg px-3 py-2 border">
                  <p className="text-xs text-gray-500 mb-1">Database Last Updated</p>
                  <p className="text-xs font-medium text-gray-700 flex items-center">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {formatLastUpdated(lastUpdated)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Data Display */}
          {selectedMonth && (teamData.length > 0 || (timesheetData.length > 0 && stats)) ? (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Calendar className="h-6 w-6 text-blue-600 mr-3" />
                  {selectedMonth.label} Report
                </h2>
                <div className="flex space-x-4">
                  {teamData.length > 1 && (
                    <button
                      onClick={() => setCurrentStep('team-dashboard')}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                    >
                      <Users className="h-5 w-5 mr-2" />
                      View Team Dashboard
                    </button>
                  )}
                  {timesheetData.length > 0 && stats && (
                    <button
                      onClick={() => setCurrentStep('individual')}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                    >
                      <BarChart3 className="h-5 w-5 mr-2" />
                      View Detailed Report
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Summary */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Employees</p>
                      <p className="text-2xl font-bold text-blue-900">{teamData.length}</p>
                    </div>
                  </div>
                </div>

                {teamStats && (
                  <>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600 mr-3" />
                        <div>
                          <p className="text-sm text-green-600 font-medium">Avg Attendance</p>
                          <p className="text-2xl font-bold text-green-900">{teamStats.avgAttendanceRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertTriangle className="h-8 w-8 text-orange-600 mr-3" />
                        <div>
                          <p className="text-sm text-orange-600 font-medium">High Risk</p>
                          <p className="text-2xl font-bold text-orange-900">{teamStats.highRiskEmployees}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <Star className="h-8 w-8 text-yellow-600 mr-3" />
                        <div>
                          <p className="text-sm text-yellow-600 font-medium">Avg Rating</p>
                          <p className="text-2xl font-bold text-yellow-900">
                            {teamStats.avgPerformanceRating ? teamStats.avgPerformanceRating.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : selectedMonth ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600 mb-6">
                No timesheet data found for {selectedMonth.label}. Data needs to be uploaded via API or database import.
              </p>
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload CSV File
                </button>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>💡 Quick Start:</strong> Upload a CSV file with timesheet records to get started with analyzing your team's attendance data.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome to Timesheet Dashboard</h3>
              <p className="text-gray-600 mb-6">
                {availableMonths.length === 0 
                  ? 'No data available yet. Import data from TeamLogger or upload CSV files to get started.'
                  : 'Select a month from the dropdown above to view reports.'
                }
              </p>
              
              {availableMonths.length === 0 && (
                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={() => setCurrentStep('upload')}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload CSV File
                  </button>
                  <button
                    onClick={() => setShowTeamLoggerImport(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Import from TeamLogger
                  </button>
                  <button
                    onClick={() => setShowTeamLoggerImport(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Import from TeamLogger
                  </button>
                </div>
              )}
            </div>
          )}

          {/* API Documentation Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Database className="h-6 w-6 mr-3 text-blue-600" />
              API Integration Guide
            </h2>
            
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Base URL</h3>
                <code className="text-sm bg-gray-200 px-2 py-1 rounded">
                  Airtable API (Base: {import.meta.env.VITE_AIRTABLE_BASE_ID})
                </code>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Available Endpoints:</h3>
                  <div className="space-y-2 text-sm">
                    <div className="bg-green-50 p-3 rounded">
                      <strong>POST /bulk-upload</strong><br/>
                      Upload all data types at once
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <strong>POST /upload-timesheet-records</strong><br/>
                      Upload timesheet records only
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <strong>POST /upload-employee-stats</strong><br/>
                      Upload employee statistics
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <strong>POST /upload-performance-ratings</strong><br/>
                      Upload performance star ratings
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <strong>DELETE /delete-month-data</strong><br/>
                      Delete data for specific month/year
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Example Payload Structure:</h3>
                  <div className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                    <pre>{`{
  "month": 6,
  "year": 2025,
  "timesheet_records": [...],
  "employee_stats": [...],
  "performance_ratings": [
    {
      "employee_name": "John Doe",
      "performance_star_rating": 4.5,
      "month": 6,
      "year": 2025
    }
  ]
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-blue-600" />
              System Features
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <Database className="h-5 w-5 text-blue-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Database Storage</h3>
                    <p className="text-gray-600 text-sm">Persistent storage with month-level data organization and automatic backup</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-green-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Month-Year Filtering</h3>
                    <p className="text-gray-600 text-sm">Easy navigation through historical data with intuitive month/year selection</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Users className="h-5 w-5 text-purple-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Team Analytics</h3>
                    <p className="text-gray-600 text-sm">Comprehensive team dashboard with individual employee performance cards</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-orange-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Smart Processing</h3>
                    <p className="text-gray-600 text-sm">Automatic data validation and intelligent overtime eligibility calculation</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <Database className="h-5 w-5 text-teal-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">API Integration</h3>
                    <p className="text-gray-600 text-sm">RESTful API endpoints for external system integration and automated data uploads</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <BarChart3 className="h-5 w-5 text-red-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Performance Ratings</h3>
                    <p className="text-gray-600 text-sm">Star-based performance rating system with visual indicators and N/A support</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Break Compliance</h3>
                    <p className="text-gray-600 text-sm">Automatic detection of lunch and evening breaks with overtime eligibility rules</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-indigo-600 mt-1 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Real-time Updates</h3>
                    <p className="text-gray-600 text-sm">Live data synchronization with timestamp tracking for the latest information</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;