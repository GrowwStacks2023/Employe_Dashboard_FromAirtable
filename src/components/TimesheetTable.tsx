import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Home, UserX } from 'lucide-react';
import type { TimesheetRecord, ProcessedStats } from '../types/timesheet';

interface TimesheetTableProps {
  data: TimesheetRecord[];
  stats: ProcessedStats | null;
}

const TimesheetTable: React.FC<TimesheetTableProps> = ({ data, stats }) => {
  const decimalHoursToHM = (decimalHours: number): string => {
    if (decimalHours === 0) return "0:00";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getRowClassName = (record: TimesheetRecord) => {
    if (record.status === 'Sunday') return 'bg-blue-50';
    if (record.notes === 'Absent') return 'bg-red-50';
    if (record.notes?.includes('Saturday Holiday')) return 'bg-purple-50';
    if (record.notes?.includes('Saturday Half Day')) return 'bg-yellow-50';
    if (record.day === 'Saturday' || record.day === 'Sunday') return 'bg-green-50';
    return 'hover:bg-gray-50';
  };

  const workingDays = data.filter(r => r.status === 'Working Day');
  const absentDays = data.filter(r => r.notes === 'Absent');
  const issuesCount = workingDays.filter(r => 
    r.lateStatus === 'Late' || 
    r.lunchBreakApplied === 'No' || 
    r.eveningBreakApplied === 'No'
  ).length;

  return (
    <div>
      {/* Table Header */}
      <div className="bg-gray-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 mr-3" />
            <h2 className="text-xl font-bold">Daily Timesheet Records</h2>
          </div>
          <div className="text-sm opacity-90">
            {data.length} total days • {workingDays.length} working days • {absentDays.length} absent days
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Day</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">In Time</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 bg-blue-50">
                Arrival Time
                <div className="text-xs font-normal text-blue-600 mt-1">
                  (9 AM - 12 PM)
                </div>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Out Time</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Total Hours</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Overtime</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Attendance</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Lunch Break</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Evening Break</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">OT Eligibility</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((record, index) => (
              <tr key={index} className={`transition-colors ${getRowClassName(record)}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {record.date}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center">
                    {record.status === 'Sunday' && <Home className="h-4 w-4 mr-1 text-blue-600" />}
                    {record.notes === 'Absent' && <UserX className="h-4 w-4 mr-1 text-red-600" />}
                    {record.day}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {record.inTime}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-blue-50">
                  <div className="flex items-center">
                    {record.arrivalTime !== '-' ? (
                      <span className="font-medium text-blue-800">{record.arrivalTime}</span>
                    ) : (
                      <span className="text-gray-400 italic">No arrival</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {record.outTime}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {record.totalHours > 0 ? `${record.totalHours.toFixed(2)}h` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.overtimeHours > 0 ? (
                    <span className="font-medium text-orange-600">
                      {decimalHoursToHM(record.overtimeHours)}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.lateStatus === 'Late' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Late
                    </span>
                  ) : record.lateStatus === 'On Time' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      On Time
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.lunchBreakApplied === 'Yes' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Yes
                    </span>
                  ) : record.lunchBreakApplied === 'No' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      No
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.eveningBreakApplied === 'Yes' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Yes
                    </span>
                  ) : record.eveningBreakApplied === 'No' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      No
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.overtimeEligibility === 'Eligible for Overtime' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Eligible
                    </span>
                  ) : record.overtimeEligibility === 'Overtime Not Eligible (Break Not Applied)' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Not Eligible
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {record.notes && record.notes !== '-' ? (
                    <span className={
                      record.notes.includes('Late') ? 'text-red-600 font-medium' : 
                      record.notes === 'Absent' ? 'text-red-600 font-medium' :
                      record.notes.includes('Sunday') ? 'text-blue-600 font-medium' :
                      record.notes.includes('Saturday Holiday') ? 'text-purple-600 font-medium' :
                      record.notes.includes('Saturday Half Day') ? 'text-yellow-600 font-medium' :
                      ''
                    }>
                      {record.notes}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Arrival Time Explanation */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-6">
        <div className="flex items-start">
          <Clock className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Arrival Time vs In Time Explanation</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p><strong>📥 In Time:</strong> First work session start (any time of day)</p>
                <p><strong>🕘 Arrival Time:</strong> Official arrival (first IN between 9 AM - 12 PM)</p>
                <p><strong>⏰ Late Detection:</strong> Based only on Arrival Time</p>
              </div>
              <div>
                <p><strong>📊 Total Hours:</strong> All working time throughout the day</p>
                <p><strong>🎯 Purpose:</strong> Separate attendance discipline from productivity</p>
                <p><strong>❌ No Arrival:</strong> No IN event between 9 AM - 12 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Absence Alert */}
      {absentDays.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-6 mt-6">
          <div className="flex items-start">
            <UserX className="h-6 w-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Absence Alert
              </h3>
              <p className="text-red-700 mb-4">
                Found {absentDays.length} days marked as absent (no login detected).
              </p>
              
              <div className="text-sm">
                <h4 className="font-medium text-red-800 mb-2">Absent Days:</h4>
                <ul className="space-y-1 text-red-700">
                  {absentDays.slice(0, 10).map((r, i) => (
                    <li key={i}>• {r.date} ({r.day})</li>
                  ))}
                  {absentDays.length > 10 && (
                    <li className="italic">... and {absentDays.length - 10} more days</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Summary */}
      {issuesCount > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mt-6">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-orange-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-orange-800 mb-2">
                Compliance Issues Detected
              </h3>
              <p className="text-orange-700 mb-4">
                Found {issuesCount} working days with attendance or break compliance issues that require attention.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-orange-800 mb-2">Late Arrivals:</h4>
                  <ul className="space-y-1 text-orange-700">
                    {workingDays
                      .filter(r => r.lateStatus === 'Late')
                      .slice(0, 5)
                      .map((r, i) => (
                        <li key={i}>• {r.date} ({r.day}) - Arrival: {r.arrivalTime}</li>
                      ))}
                    {workingDays.filter(r => r.lateStatus === 'Late').length > 5 && (
                      <li className="italic">... and {workingDays.filter(r => r.lateStatus === 'Late').length - 5} more</li>
                    )}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-orange-800 mb-2">Break Compliance Issues:</h4>
                  <ul className="space-y-1 text-orange-700">
                    {workingDays
                      .filter(r => r.lunchBreakApplied === 'No' || r.eveningBreakApplied === 'No')
                      .slice(0, 5)
                      .map((r, i) => (
                        <li key={i}>
                          • {r.date} - Missing {r.lunchBreakApplied === 'No' ? 'lunch' : ''}{r.lunchBreakApplied === 'No' && r.eveningBreakApplied === 'No' ? ' & ' : ''}{r.eveningBreakApplied === 'No' ? 'evening' : ''} break
                        </li>
                      ))}
                  </ul>
                  <p><strong>🏠 Saturday/Sunday:</strong> No break compliance required for OT</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saturday Break Policy Info */}
      <div className="bg-green-50 border-l-4 border-green-400 p-6 mt-6">
        <div className="flex items-start">
          <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">Weekend Break Policy</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-green-700">
              <div>
                <p><strong>🏠 Saturdays & Sundays:</strong> No break compliance required</p>
                <p><strong>✅ Overtime Eligibility:</strong> Automatic for weekend work</p>
              </div>
              <div>
                <p><strong>📅 Monday-Friday:</strong> Both lunch & evening breaks required</p>
                <p><strong>⚠️ Break Compliance:</strong> Required for weekday overtime eligibility</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Month Summary */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-6">
        <div className="flex items-start">
          <Clock className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Month Summary</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-blue-700">
              <div>
                <p><strong>Total Days in Month:</strong> {stats?.totalDaysInMonth || 30}</p>
                <p><strong>Working Days Attended:</strong> {stats?.totalWorkingDays || 0}</p>
                <p><strong>Absent Days:</strong> {stats?.totalLeaveDays || 0}</p>
                <p><strong>All Sundays:</strong> {stats?.totalSundays || 0} (company holiday)</p>
              </div>
              <div>
                <p><strong>Attendance Rate:</strong> {stats ? (((stats.totalWorkingDays) / (stats.totalDaysInMonth - stats.totalSundays)) * 100).toFixed(1) : '0'}% (excluding Sundays)</p>
                <p><strong>Total Overtime:</strong> {stats ? decimalHoursToHM(stats.totalOvertimeHours) : '0:00'}</p>
                <p><strong>Eligible Overtime:</strong> {stats ? decimalHoursToHM(stats.totalEligibleOvertimeHours) : '0:00'}</p>
                <p><strong>Lost Overtime:</strong> {stats ? decimalHoursToHM(stats.lostOvertimeHours) : '0:00'}</p>
              </div>
            </div>
            {stats && stats.latePercentage > 20 && (
              <p className="mt-4 text-red-700 font-medium">
                ⚠️ Action Required: Address late arrival pattern - current rate significantly exceeds acceptable levels.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetTable;