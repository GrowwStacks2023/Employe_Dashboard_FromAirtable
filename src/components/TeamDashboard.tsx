import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Award, 
  Clock, 
  Calendar,
  BarChart3,
  Eye,
  ArrowRight,
  Star,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Upload,
  Database,
  Download
} from 'lucide-react';
import StarRating from './StarRating';
import MonthSelector from './MonthSelector';
import CSVUploadPage from './CSVUploadPage';
import TeamLoggerImportPanel from './TeamLoggerImportPanel';
import { DatabaseService, type MonthYear } from '../services/databaseService';
import type { EmployeeData, TeamStats } from '../types/teamDashboard';
import type { PerformanceRating } from '../services/databaseService';

interface TeamDashboardProps {
  employeeData: EmployeeData[];
  teamStats: TeamStats;
  performanceRatings: PerformanceRating[];
  onEmployeeSelect: (employeeName: string) => void;
  selectedMonth: MonthYear | null;
  lastUpdated: string | null;
}

const TeamDashboard: React.FC<TeamDashboardProps> = ({ 
  employeeData, 
  teamStats, 
  performanceRatings,
  onEmployeeSelect,
  selectedMonth: initialSelectedMonth,
  lastUpdated: initialLastUpdated
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high-performers' | 'needs-attention' | 'high-risk'>('all');
  const [sortBy, setSortBy] = useState<'performance' | 'attendance' | 'overtime' | 'rating'>('performance');
  const [employeeNameFilter, setEmployeeNameFilter] = useState<string>('');
  const [projectManagerFilter, setProjectManagerFilter] = useState<string>('');
  const [showUploadPage, setShowUploadPage] = useState(false);
  const [showTeamLoggerImport, setShowTeamLoggerImport] = useState(false);
  
  // Local state for month selection and data
  const [availableMonths, setAvailableMonths] = useState<MonthYear[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthYear | null>(initialSelectedMonth);
  const [isLoadingMonths, setIsLoadingMonths] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialLastUpdated);
  const [currentTeamData, setCurrentTeamData] = useState<EmployeeData[]>(employeeData);
  const [currentTeamStats, setCurrentTeamStats] = useState<TeamStats>(teamStats);
  const [currentPerformanceRatings, setCurrentPerformanceRatings] = useState<PerformanceRating[]>(performanceRatings);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load available months on component mount
  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // Load data when month is selected
  useEffect(() => {
    if (selectedMonth && selectedMonth !== initialSelectedMonth) {
      loadMonthData(selectedMonth);
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    setIsLoadingMonths(true);
    try {
      const months = await DatabaseService.getAvailableMonths();
      setAvailableMonths(months);
    } catch (error) {
      console.error('Error loading available months:', error);
    } finally {
      setIsLoadingMonths(false);
    }
  };

  const loadMonthData = async (month: MonthYear) => {
    setIsLoadingData(true);
    
    try {
      const { employeeData: newEmployeeData, performanceRatings: newPerformanceRatings, hasData, lastUpdated: dbLastUpdated } = await DatabaseService.loadMonthData(month.month, month.year);
      
      if (!hasData) {
        setCurrentTeamData([]);
        setCurrentTeamStats({
          totalEmployees: 0,
          avgAttendanceRate: 0,
          avgLatePercentage: 0,
          totalOvertimeHours: 0,
          totalLostOvertimeHours: 0,
          highRiskEmployees: 0,
          topPerformers: [],
          needsAttention: [],
          avgPerformanceRating: null,
          monthlyTrends: {
            totalWorkingDays: 0,
            avgHoursPerDay: 0,
            complianceRate: 0
          }
        });
        setCurrentPerformanceRatings([]);
        setLastUpdated(null);
        return;
      }

      setCurrentPerformanceRatings(newPerformanceRatings);
      setLastUpdated(dbLastUpdated);
      setCurrentTeamData(newEmployeeData);

      // Calculate team stats with performance ratings
      const newTeamStats = calculateTeamStats(newEmployeeData, newPerformanceRatings);
      setCurrentTeamStats(newTeamStats);
    } catch (error) {
      console.error('Error loading month data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const calculateTeamStats = (employeeData: EmployeeData[], performanceRatings: PerformanceRating[]): TeamStats => {
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
        avgPerformanceRating: null,
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

  const decimalHoursToHM = (decimalHours: number): string => {
    if (decimalHours === 0) return "0:00";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
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

  const handleViewHighRiskEmployees = () => {
    setSelectedFilter('high-risk');
  };

  const handleUploadSuccess = (newEmployeeData: EmployeeData[], month: number, year: number) => {
    // Update the current data with newly uploaded data
    setCurrentTeamData(newEmployeeData);
    const newTeamStats = calculateTeamStats(newEmployeeData, currentPerformanceRatings);
    setCurrentTeamStats(newTeamStats);
    
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
    
    // Hide upload page
    setShowUploadPage(false);
  };

  const handleTeamLoggerImportSuccess = (newEmployeeData: EmployeeData[], month: number, year: number) => {
    // Update the current data with newly imported data
    setCurrentTeamData(newEmployeeData);
    const newTeamStats = calculateTeamStats(newEmployeeData, currentPerformanceRatings);
    setCurrentTeamStats(newTeamStats);
    
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
    
    // Hide import panel
    setShowTeamLoggerImport(false);
  };

  // Get performance rating for an employee
  const getEmployeeRating = (employeeName: string): number | null => {
    console.log(`🔍 TeamDashboard - Looking for rating for employee: "${employeeName}"`);
    console.log(`🔍 TeamDashboard - Available ratings:`, currentPerformanceRatings.map(r => ({ 
      name: `"${r.employee_name}"`, 
      rating: r.performance_star_rating,
      trimmed: `"${r.employee_name.trim()}"`
    })));
    
    const rating = currentPerformanceRatings.find(r => {
      // Try exact match first
      const exactMatch = r.employee_name === employeeName;
      // Try trimmed match
      const trimmedMatch = r.employee_name.trim() === employeeName.trim();
      // Try case-insensitive match
      const caseInsensitiveMatch = r.employee_name.trim().toLowerCase() === employeeName.trim().toLowerCase();
      
      const match = exactMatch || trimmedMatch || caseInsensitiveMatch;
      console.log(`🔍 TeamDashboard - Comparing "${r.employee_name}" with "${employeeName}":`, {
        exactMatch,
        trimmedMatch,
        caseInsensitiveMatch,
        finalMatch: match
      });
      return match;
    });
    
    const result = rating?.performance_star_rating || null;
    console.log(`🔍 TeamDashboard - Final rating for "${employeeName}": ${result}`);
    return result;
  };

  // Get project manager for an employee
  const getEmployeeProjectManager = (employeeName: string): string | null => {
    const rating = currentPerformanceRatings.find(r => 
      r.employee_name.trim().toLowerCase() === employeeName.trim().toLowerCase()
    );
    return rating?.project_manager || null;
  };

  // Get unique project managers for filter dropdown
  const getUniqueProjectManagers = (): string[] => {
    const managers = currentPerformanceRatings
      .map(r => r.project_manager)
      .filter(pm => pm && pm.trim() !== '')
      .map(pm => pm!.trim());
    return [...new Set(managers)].sort();
  };
  const filteredEmployees = currentTeamData.filter(emp => {
    // Filter by employee name first
    if (employeeNameFilter.trim() !== '') {
      const nameMatch = emp.employeeName.toLowerCase().includes(employeeNameFilter.toLowerCase().trim());
      if (!nameMatch) return false;
    }
    
    // Filter by project manager
    if (projectManagerFilter.trim() !== '') {
      const employeePM = getEmployeeProjectManager(emp.employeeName);
      if (!employeePM || employeePM.toLowerCase().trim() !== projectManagerFilter.toLowerCase().trim()) {
        return false;
      }
    }
    
    // Then apply other filters
    switch (selectedFilter) {
      case 'high-performers':
        return emp.stats.performanceScore >= 85;
      case 'needs-attention':
        return emp.stats.performanceScore < 70;
      case 'high-risk':
        return emp.stats.riskLevel === 'high' || emp.stats.riskLevel === 'critical';
      default:
        return true;
    }
  }).sort((a, b) => {
    switch (sortBy) {
      case 'attendance':
        return b.stats.attendanceRate - a.stats.attendanceRate;
      case 'overtime':
        return b.stats.totalOvertimeHours - a.stats.totalOvertimeHours;
      case 'rating':
        const ratingA = getEmployeeRating(a.employeeName) || 0;
        const ratingB = getEmployeeRating(b.employeeName) || 0;
        return ratingB - ratingA;
      default:
        return b.stats.performanceScore - a.stats.performanceScore;
    }
  });

  // Show upload page if requested
  if (showUploadPage) {
    return (
      <CSVUploadPage
        onBack={() => setShowUploadPage(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    );
  }

  // Show TeamLogger import panel if requested
  if (showTeamLoggerImport) {
    return (
      <TeamLoggerImportPanel
        onClose={() => setShowTeamLoggerImport(false)}
        onImportSuccess={handleTeamLoggerImportSuccess}
      />
    );
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Team Data</h2>
          <p className="text-gray-600 max-w-md">
            Loading team data for {selectedMonth?.label}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-6 py-8">
        {/* Compact Header with All Elements in One Line */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            {/* Left Side - Title */}
            <div className="flex items-center">
              <img 
                src="/8a0b61_56b3f20c96644a46a80e712d4fdbb7ee~mv2.png" 
                alt="Growwstacks Logo" 
                className="h-20 w-auto mr-6"
              />
              <div>
                <h1 className="text-2xl font-bold text-black-900">Performance & Attendance Growwstacks Team</h1>
      
              </div>
            </div>
            
            {/* Right Side - All Controls in One Line */}
            <div className="flex items-center space-x-6">
              {/* Upload Button */}
              <button
                onClick={() => setShowUploadPage(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-sm"
              >
                <Upload className="h-5 w-10 mr-1" />
                Upload Data
              </button>
              
              {/* TeamLogger Import Button */}
              <button
                onClick={() => setShowTeamLoggerImport(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-sm"
              >
                <Download className="h-5 w-10 mr-2" />
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

        {/* No Data Message */}
        {currentTeamData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Team Data Available</h3>
            <p className="text-gray-600 mb-6">
              {selectedMonth 
                ? `No team data found for ${selectedMonth.label}. Please select a different month or upload new data.`
                : 'Please select a month to view team data or upload new timesheet data.'
              }
            </p>
            <button
              onClick={() => setShowUploadPage(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center mx-auto"
            >
              <Upload className="h-5 w-5 mr-2" />
              Upload Timesheet Data
            </button>
            <button
              onClick={() => setShowTeamLoggerImport(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center mx-auto ml-4"
            >
              <Download className="h-5 w-5 mr-2" />
              Import from TeamLogger
            </button>
          </div>
        ) : (
          <>
            {/* Team Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Team Size</p>
                    <p className="text-3xl font-bold text-gray-900">{currentTeamStats.totalEmployees}</p>
                  </div>
                  <Users className="h-12 w-12 text-blue-500 opacity-80" />
                </div>
                <p className="text-sm text-gray-500 mt-2">Active employees</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Attendance</p>
                    <p className="text-3xl font-bold text-gray-900">{currentTeamStats.avgAttendanceRate.toFixed(1)}%</p>
                  </div>
                  <CheckCircle2 className="h-12 w-12 text-green-500 opacity-80" />
                </div>
                <p className="text-sm text-gray-500 mt-2">Team average</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Late Arrivals</p>
                    <p className="text-3xl font-bold text-gray-900">{currentTeamStats.avgLatePercentage.toFixed(1)}%</p>
                  </div>
                  <AlertTriangle className="h-12 w-12 text-orange-500 opacity-80" />
                </div>
                <p className="text-sm text-gray-500 mt-2">Average rate</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Overtime</p>
                    <p className="text-3xl font-bold text-gray-900">{decimalHoursToHM(currentTeamStats.totalOvertimeHours)}</p>
                  </div>
                  <Clock className="h-12 w-12 text-purple-500 opacity-80" />
                </div>
                <p className="text-sm text-gray-500 mt-2">This month</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {currentTeamStats.avgPerformanceRating ? currentTeamStats.avgPerformanceRating.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <Star className="h-12 w-12 text-yellow-500 opacity-80" />
                </div>
                <p className="text-sm text-gray-500 mt-2">Performance stars</p>
              </div>
            </div>

            {/* Alert Section */}
            {currentTeamStats.highRiskEmployees > 0 && (
              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-8 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">
                      🚨 Attention Required
                    </h3>
                    <p className="text-red-700 mb-4">
                      {currentTeamStats.highRiskEmployees} employees need immediate attention for attendance issues.
                      Lost overtime: {decimalHoursToHM(currentTeamStats.totalLostOvertimeHours)} hours due to break non-compliance.
                    </p>
                    <button
                      onClick={handleViewHighRiskEmployees}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      View High-Risk Employees
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers & Needs Attention */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Award className="h-6 w-6 text-yellow-500 mr-2" />
                  Top Performers
                </h3>
                <div className="space-y-4">
                  {currentTeamStats.topPerformers.map((emp, index) => {
                    const rating = getEmployeeRating(emp.employeeName);
                    return (
                      <div key={emp.employeeName} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full text-sm font-bold mr-3">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.employeeName}</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-600">
                                {emp.attendanceRate.toFixed(1)}% attendance • {emp.latePercentage.toFixed(1)}% late
                              </p>
                              {rating !== null && <StarRating rating={rating} size="sm" />}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{emp.performanceScore.toFixed(0)}</p>
                          <p className="text-xs text-gray-500">Score</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingDown className="h-6 w-6 text-red-500 mr-2" />
                  Needs Attention
                </h3>
                <div className="space-y-4">
                  {currentTeamStats.needsAttention.map((emp, index) => {
                    const rating = getEmployeeRating(emp.employeeName);
                    return (
                      <div key={emp.employeeName} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full text-sm font-bold mr-3">
                            !
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.employeeName}</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-600">
                                {emp.attendanceRate.toFixed(1)}% attendance • {emp.latePercentage.toFixed(1)}% late
                              </p>
                              {rating !== null && <StarRating rating={rating} size="sm" />}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">{emp.performanceScore.toFixed(0)}</p>
                          <p className="text-xs text-gray-500">Score</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filters and Controls */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="space-y-4">
                {/* Employee Name Filter */}
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700 min-w-[120px]">Filter by Name:</label>
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search employee name..."
                      value={employeeNameFilter}
                      onChange={(e) => setEmployeeNameFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {employeeNameFilter && (
                    <button
                      onClick={() => setEmployeeNameFilter('')}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Project Manager Filter */}
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700 min-w-[120px]">Filter by PM:</label>
                  <div className="flex-1 max-w-md">
                    <select
                      value={projectManagerFilter}
                      onChange={(e) => setProjectManagerFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Project Managers</option>
                      {getUniqueProjectManagers().map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>
                  {projectManagerFilter && (
                    <button
                      onClick={() => setProjectManagerFilter('')}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Other Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">Filter:</label>
                    <select
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value as any)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Employees ({filteredEmployees.length})</option>
                      <option value="high-performers">High Performers</option>
                      <option value="needs-attention">Needs Attention</option>
                      <option value="high-risk">High Risk</option>
                    </select>
                  </div>
                
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="performance">Performance Score</option>
                      <option value="attendance">Attendance Rate</option>
                      <option value="overtime">Overtime Hours</option>
                      <option value="rating">Star Rating</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Cards Grid */}
            {filteredEmployees.length === 0 && (employeeNameFilter || projectManagerFilter) ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Employees Found</h3>
                <p className="text-gray-600 mb-4">
                  No employees match the current filters
                  {employeeNameFilter && ` (Name: "${employeeNameFilter}")`}
                  {projectManagerFilter && ` (PM: "${projectManagerFilter}")`}.
                </p>
                <button
                  onClick={() => {
                    setEmployeeNameFilter('');
                    setProjectManagerFilter('');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEmployees.map((employee) => {
                  const rating = getEmployeeRating(employee.employeeName);
                  return (
                    <div
                      key={employee.employeeName}
                      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105"
                      onClick={() => onEmployeeSelect(employee.employeeName)}
                    >
                      {/* Card Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative overflow-hidden">
                        <div className="flex items-center justify-between relative z-10">
                          <div>
                            <h3 className="text-xl font-bold mb-1">{employee.employeeName}</h3>
                            <p className="text-blue-100 text-sm">Click to view details</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${getRiskColor(employee.stats.riskLevel)}`}></div>
                            <Eye className="h-5 w-5 opacity-80" />
                          </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-20">
                          <Users className="h-16 w-16" />
                        </div>
                      </div>

                      {/* Performance Rating */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Performance Rating</span>
                          <div className="flex items-center">
                            <StarRating rating={rating} size="md" showValue />
                          </div>
                        </div>
                        {getEmployeeProjectManager(employee.employeeName) && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Project Manager</span>
                            <span className="text-xs font-medium text-gray-700">
                              {getEmployeeProjectManager(employee.employeeName)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Performance Score */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Performance Score</span>
                          <span className={`text-2xl font-bold ${getPerformanceColor(employee.stats.performanceScore)}`}>
                            {employee.stats.performanceScore.toFixed(0)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full ${
                              employee.stats.performanceScore >= 85 ? 'bg-green-500' :
                              employee.stats.performanceScore >= 70 ? 'bg-blue-500' :
                              employee.stats.performanceScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${employee.stats.performanceScore}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Attendance Rate</span>
                          <span className="font-semibold text-gray-900">
                            {employee.stats.attendanceRate.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Late Arrivals</span>
                          <span className={`font-semibold ${
                            employee.stats.latePercentage > 30 ? 'text-red-600' :
                            employee.stats.latePercentage > 15 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {employee.stats.latePercentage.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Overtime</span>
                          <span className="font-semibold text-purple-600">
                            {decimalHoursToHM(employee.stats.totalOvertimeHours)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Break Compliance</span>
                          <span className={`font-semibold ${
                            employee.stats.breakComplianceRate >= 80 ? 'text-green-600' :
                            employee.stats.breakComplianceRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {employee.stats.breakComplianceRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Risk Level Badge */}
                      <div className="p-4 pt-0">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          employee.stats.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                          employee.stats.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                          employee.stats.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {employee.stats.riskLevel === 'critical' && '🚨 '}
                          {employee.stats.riskLevel === 'high' && '⚠️ '}
                          {employee.stats.riskLevel === 'medium' && '⚡ '}
                          {employee.stats.riskLevel === 'low' && '✅ '}
                          {employee.stats.riskLevel.charAt(0).toUpperCase() + employee.stats.riskLevel.slice(1)} Risk
                        </div>
                      </div>

                      {/* View Details Button */}
                      <div className="p-4 pt-0">
                        <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center">
                          View Full Report
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary Footer */}
            <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <BarChart3 className="h-6 w-6 text-blue-600 mr-3" />
                Organization Summary
              </h3>
              
              <div className="grid md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {currentTeamStats.monthlyTrends.avgHoursPerDay.toFixed(1)}h
                  </div>
                  <p className="text-gray-600">Average Daily Hours</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {currentTeamStats.monthlyTrends.complianceRate.toFixed(0)}%
                  </div>
                  <p className="text-gray-600">Break Compliance Rate</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {decimalHoursToHM(currentTeamStats.totalOvertimeHours - currentTeamStats.totalLostOvertimeHours)}
                  </div>
                  <p className="text-gray-600">Eligible Overtime</p>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">
                    {currentTeamStats.avgPerformanceRating ? currentTeamStats.avgPerformanceRating.toFixed(1) : 'N/A'}
                  </div>
                  <p className="text-gray-600">Average Star Rating</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-center">
                  <strong>Recommendation:</strong> Focus on improving break compliance to reduce lost overtime hours. 
                  Consider attendance coaching for employees with high late arrival rates and low performance ratings.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamDashboard;