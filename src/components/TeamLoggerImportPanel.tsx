import React, { useState } from 'react';
import { Database, Calendar, Download, AlertTriangle, CheckCircle2, Users, Clock, X } from 'lucide-react';
import { TeamLoggerService } from '../services/teamLoggerService';
import { processTeamData } from '../utils/teamProcessor';
import { DatabaseService } from '../services/databaseService';
import type { EmployeeData } from '../types/teamDashboard';

interface TeamLoggerImportPanelProps {
  onClose: () => void;
  onImportSuccess: (employeeData: EmployeeData[], month: number, year: number) => void;
}

const TeamLoggerImportPanel: React.FC<TeamLoggerImportPanelProps> = ({ onClose, onImportSuccess }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [importType, setImportType] = useState<'daily' | 'monthly'>('daily');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'fetching' | 'processing' | 'saving' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [importedData, setImportedData] = useState<EmployeeData[]>([]);
  const [existingDataFound, setExistingDataFound] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setImportStatus('fetching');
    setStatusMessage('Fetching data from TeamLogger API...');

    try {
      const date = new Date(selectedDate);
      let teamLoggerData;
      let targetMonth: number;
      let targetYear: number;

      if (importType === 'daily') {
        teamLoggerData = await TeamLoggerService.fetchDailyData(date);
        targetMonth = date.getMonth() + 1;
        targetYear = date.getFullYear();
        setStatusMessage(`Fetched ${teamLoggerData.length} timesheet entries for ${date.toDateString()}`);
      } else {
        targetMonth = date.getMonth() + 1;
        targetYear = date.getFullYear();
        teamLoggerData = await TeamLoggerService.fetchMonthData(targetMonth, targetYear);
        setStatusMessage(`Fetched ${teamLoggerData.length} timesheet entries for ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
      }

      if (teamLoggerData.length === 0) {
        throw new Error('No timesheet data found for the selected period');
      }

      // Check if data already exists
      const dataExists = await DatabaseService.checkDataExists(targetMonth, targetYear);
      setExistingDataFound(dataExists);

      setImportStatus('processing');
      setStatusMessage('Converting TeamLogger data to timesheet format...');

      // Convert TeamLogger data to our internal format
      const timesheetEvents = TeamLoggerService.convertToTimesheetEvents(teamLoggerData);
      
      // Process the data using our existing team processor
      const { employeeData } = await processTeamData(timesheetEvents);

      if (employeeData.length === 0) {
        throw new Error('No valid employee data could be processed from TeamLogger response');
      }

      setImportedData(employeeData);
      setImportStatus('success');
      setStatusMessage(`Successfully processed data for ${employeeData.length} employees`);

    } catch (error) {
      console.error('TeamLogger import error:', error);
      setImportStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to import data from TeamLogger');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (importedData.length === 0) return;

    setIsImporting(true);
    setImportStatus('saving');
    
    try {
      const date = new Date(selectedDate);
      const targetMonth = date.getMonth() + 1;
      const targetYear = date.getFullYear();

      if (existingDataFound) {
        setStatusMessage(`Deleting existing data for ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}...`);
        await DatabaseService.deleteMonthData(targetMonth, targetYear);
      }
      
      setStatusMessage('Saving TeamLogger data to database...');
      await DatabaseService.saveTimesheetData(importedData, targetMonth, targetYear);
      setStatusMessage('Data successfully saved to database!');
      
      // Call success callback to update parent component
      setTimeout(() => {
        onImportSuccess(importedData, targetMonth, targetYear);
      }, 1500);
    } catch (error) {
      console.error('Error saving TeamLogger data:', error);
      setImportStatus('error');
      setStatusMessage('Failed to save data to database');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setImportStatus('idle');
    setStatusMessage('');
    setImportedData([]);
    setExistingDataFound(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const selectedDateObj = new Date(selectedDate);
  const monthLabel = monthNames[selectedDateObj.getMonth()];
  const yearLabel = selectedDateObj.getFullYear();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/8a0b61_56b3f20c96644a46a80e712d4fdbb7ee~mv2.png" 
                alt="Growwstacks Logo" 
                className="h-10 w-auto mr-3"
              />
              <div>
                <h2 className="text-2xl font-bold">TeamLogger Import</h2>
                <p className="text-purple-100">Import timesheet data directly from TeamLogger API</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Import Configuration */}
          {importStatus === 'idle' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import Type
                  </label>
                  <select
                    value={importType}
                    onChange={(e) => setImportType(e.target.value as 'daily' | 'monthly')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="daily">Daily Import</option>
                    <option value="monthly">Monthly Import</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {importType === 'daily' ? 'Select Date' : 'Select Month'}
                  </label>
                  <input
                    type={importType === 'daily' ? 'date' : 'month'}
                    value={importType === 'daily' ? selectedDate : selectedDate.slice(0, 7)}
                    onChange={(e) => {
                      if (importType === 'daily') {
                        setSelectedDate(e.target.value);
                      } else {
                        setSelectedDate(e.target.value + '-01');
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Database className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Import Summary</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      {importType === 'daily' 
                        ? `Import timesheet data for ${selectedDateObj.toDateString()}`
                        : `Import all timesheet data for ${monthLabel} ${yearLabel}`
                      }
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      Data will be fetched directly from TeamLogger API and processed automatically.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center"
              >
                <Download className="h-5 w-5 mr-2" />
                {isImporting ? 'Importing...' : `Import from TeamLogger`}
              </button>
            </div>
          )}

          {/* Import Progress */}
          {(importStatus === 'fetching' || importStatus === 'processing' || importStatus === 'saving') && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-6"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {importStatus === 'fetching' && 'Fetching Data'}
                {importStatus === 'processing' && 'Processing Data'}
                {importStatus === 'saving' && 'Saving to Database'}
              </h3>
              <p className="text-gray-600">{statusMessage}</p>
            </div>
          )}

          {/* Import Success */}
          {importStatus === 'success' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Import Successful!</h3>
                    <p className="text-green-700 mb-4">{statusMessage}</p>
                    
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Import Summary:</h4>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Target Period:</span>
                          <span className="font-medium text-gray-900 ml-2">
                            {importType === 'daily' 
                              ? selectedDateObj.toDateString()
                              : `${monthLabel} ${yearLabel}`
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Employees:</span>
                          <span className="font-medium text-gray-900 ml-2">{importedData.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Records:</span>
                          <span className="font-medium text-gray-900 ml-2">
                            {importedData.reduce((sum, emp) => sum + emp.records.length, 0)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Debug Information */}
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-2">Employee List:</h5>
                        <div className="text-sm text-gray-600">
                          <div className="grid grid-cols-2 gap-2">
                            {importedData.map((emp, index) => (
                              <div key={emp.employeeName} className="flex justify-between">
                                <span className="font-medium">{emp.employeeName}</span>
                                <span className="text-gray-500">({emp.records.length} records)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {existingDataFound && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-orange-800 mb-1">Data Replacement Warning</h4>
                            <p className="text-sm text-orange-700">
                              Existing data for {importType === 'daily' ? selectedDateObj.toDateString() : `${monthLabel} ${yearLabel}`} will be completely 
                              replaced with the new TeamLogger data when you save to database.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-4">
                      <button
                        onClick={handleSaveToDatabase}
                        disabled={isImporting}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        {isImporting ? 'Saving...' : existingDataFound ? 'Replace & Save to Database' : 'Save to Database'}
                      </button>
                      <button
                        onClick={resetImport}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        Import Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Preview */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="h-5 w-5 text-purple-600 mr-2" />
                  Employee Data Preview
                </h3>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {importedData.slice(0, 6).map((employee) => (
                    <div key={employee.employeeName} className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold text-gray-900 mb-2">{employee.employeeName}</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Working Days: {employee.stats.totalWorkingDays}
                        </p>
                        <p className="flex items-center">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Attendance: {employee.stats.attendanceRate.toFixed(1)}%
                        </p>
                        <p className="flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Late Days: {employee.stats.lateDays}
                        </p>
                        <p className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Overtime: {employee.stats.totalOvertimeHours.toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {importedData.length > 6 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-purple-800 font-semibold">+{importedData.length - 6} more</p>
                        <p className="text-purple-600 text-sm">employees</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Import Error */}
          {importStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-start">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Import Failed</h3>
                  <p className="text-red-700 mb-4">{statusMessage}</p>
                  <div className="space-y-2 text-sm text-red-600 mb-4">
                    <p><strong>Possible causes:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>TeamLogger API is temporarily unavailable</li>
                      <li>Invalid authentication token</li>
                      <li>No timesheet data available for the selected period</li>
                      <li>Network connectivity issues</li>
                    </ul>
                  </div>
                  <button
                    onClick={resetImport}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Information */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">TeamLogger API Integration</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p><strong>API Endpoint:</strong> api2.teamlogger.com</p>
                <p><strong>Authentication:</strong> Bearer Token</p>
                <p><strong>Data Format:</strong> Raw timesheet entries</p>
              </div>
              <div>
                <p><strong>Processing:</strong> Automatic conversion to IN/OUT events</p>
                <p><strong>Validation:</strong> Break detection & overtime calculation</p>
                <p><strong>Storage:</strong> Direct database integration</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLoggerImportPanel;