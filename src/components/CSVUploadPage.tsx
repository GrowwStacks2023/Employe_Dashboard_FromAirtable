import React, { useState } from 'react';
import { Upload, FileText, ArrowLeft, Database, CheckCircle2, AlertTriangle, Users, Calendar, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { processTeamData } from '../utils/teamProcessor';
import { DatabaseService } from '../services/databaseService';
import type { EmployeeData } from '../types/teamDashboard';

interface CSVUploadPageProps {
  onBack: () => void;
  onUploadSuccess: (employeeData: EmployeeData[], month: number, year: number) => void;
}

const CSVUploadPage: React.FC<CSVUploadPageProps> = ({ onBack, onUploadSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadedData, setUploadedData] = useState<EmployeeData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [existingDataFound, setExistingDataFound] = useState<boolean>(false);
  const [detectedMonth, setDetectedMonth] = useState<{ month: number; year: number } | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 11 }, (_, i) => 2020 + i); // 2020-2030

  // Check if data exists for selected month/year
  const checkExistingData = async (month: number, year: number) => {
    try {
      const exists = await DatabaseService.checkDataExists(month, year);
      setExistingDataFound(exists);
    } catch (error) {
      console.error('Error checking existing data:', error);
      setExistingDataFound(false);
    }
  };

  // Handle month/year change
  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    checkExistingData(month, selectedYear);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    checkExistingData(selectedMonth, year);
  };

  // Initialize check on component mount
  React.useEffect(() => {
    checkExistingData(selectedMonth, selectedYear);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus('processing');
    setUploadMessage('Processing CSV file...');

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            if (results.errors.length > 0) {
              throw new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
            }

            setUploadMessage('Processing timesheet data...');
            
            // Process the team data
            const { employeeData } = await processTeamData(results.data);
            
            if (employeeData.length === 0) {
              throw new Error('No valid employee data found in the CSV file');
            }

            // Try to detect month/year from the data
            const firstRecord = employeeData[0]?.records[0];
            if (firstRecord) {
              const dateParts = firstRecord.date.split('-');
              if (dateParts.length >= 3) {
                const monthMap: Record<string, number> = {
                  'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
                  'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
                };
                const month = monthMap[dateParts[1]] || 6;
                const year = dateParts[2].length === 2 ? 2000 + parseInt(dateParts[2]) : parseInt(dateParts[2]);
                
                setDetectedMonth({ month, year });
                
                // Auto-update the selected month/year to match detected data
                setSelectedMonth(month);
                setSelectedYear(year);
                await checkExistingData(month, year);
              }
            }

            setUploadedData(employeeData);
            setUploadStatus('success');
            setUploadMessage(`Successfully processed data for ${employeeData.length} employees`);
          } catch (error) {
            console.error('Error processing data:', error);
            setUploadStatus('error');
            setUploadMessage(error instanceof Error ? error.message : 'Failed to process CSV data');
          } finally {
            setIsProcessing(false);
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          setUploadStatus('error');
          setUploadMessage('Failed to parse CSV file');
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('File upload error:', error);
      setUploadStatus('error');
      setUploadMessage('Failed to upload file');
      setIsProcessing(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!uploadedData.length) return;

    setIsProcessing(true);
    
    try {
      if (existingDataFound) {
        setUploadMessage(`Deleting existing data for ${monthNames[selectedMonth - 1]} ${selectedYear}...`);
        await DatabaseService.deleteMonthData(selectedMonth, selectedYear);
      }
      
      setUploadMessage('Saving new data to database...');
      await DatabaseService.saveTimesheetData(uploadedData, selectedMonth, selectedYear);
      setUploadMessage('Data successfully saved to database!');
      
      // Call success callback to update parent component
      setTimeout(() => {
        onUploadSuccess(uploadedData, selectedMonth, selectedYear);
      }, 1500);
    } catch (error) {
      console.error('Error saving to database:', error);
      setUploadStatus('error');
      setUploadMessage('Failed to save data to database');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadMessage('');
    setUploadedData([]);
    setDetectedMonth(null);
    // Reset file input
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="mr-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              <img 
                src="/8a0b61_56b3f20c96644a46a80e712d4fdbb7ee~mv2.png" 
                alt="Growwstacks Logo" 
                className="h-12 w-auto mr-4"
              />
              Upload Timesheet Data
            </h1>
            <p className="text-xl text-gray-600 mt-2">
              Upload CSV files to import employee timesheet data
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Month/Year Selection */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Calendar className="h-6 w-6 text-blue-600 mr-3" />
              Select Target Month & Year
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {monthNames.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Existing Data Warning */}
            {existingDataFound && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Existing Data Found</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Data already exists for {monthNames[selectedMonth - 1]} {selectedYear}. 
                      Uploading new data will <strong>replace all existing data</strong> for this month.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Detected Month Info */}
            {detectedMonth && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Auto-Detected from CSV</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Detected data for {monthNames[detectedMonth.month - 1]} {detectedMonth.year}. 
                      Month and year have been automatically updated to match your data.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-3" />
              CSV File Upload
            </h2>

            {uploadStatus === 'idle' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Timesheet CSV</h3>
                <p className="text-gray-600 mb-6">
                  Select a CSV file containing employee timesheet data to process and analyze
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors inline-flex items-center"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Choose CSV File
                </label>
              </div>
            )}

            {uploadStatus === 'processing' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Data</h3>
                <p className="text-gray-600">{uploadMessage}</p>
              </div>
            )}

            {uploadStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Upload Successful!</h3>
                    <p className="text-green-700 mb-4">{uploadMessage}</p>
                    
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Upload Summary:</h4>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Target Month:</span>
                          <span className="font-medium text-gray-900 ml-2">
                            {monthNames[selectedMonth - 1]} {selectedYear}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Employees:</span>
                          <span className="font-medium text-gray-900 ml-2">{uploadedData.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Records:</span>
                          <span className="font-medium text-gray-900 ml-2">
                            {uploadedData.reduce((sum, emp) => sum + emp.records.length, 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {existingDataFound && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start">
                          <Trash2 className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-red-800 mb-1">Data Replacement Warning</h4>
                            <p className="text-sm text-red-700">
                              Existing data for {monthNames[selectedMonth - 1]} {selectedYear} will be completely 
                              replaced with the new data when you save to database.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-4">
                      <button
                        onClick={handleSaveToDatabase}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        {isProcessing ? 'Saving...' : existingDataFound ? 'Replace & Save to Database' : 'Save to Database'}
                      </button>
                      <button
                        onClick={resetUpload}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        Upload Another File
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-red-600 mr-3 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Upload Failed</h3>
                    <p className="text-red-700 mb-4">{uploadMessage}</p>
                    <button
                      onClick={resetUpload}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {uploadedData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Users className="h-6 w-6 text-blue-600 mr-3" />
                Data Preview
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uploadedData.slice(0, 6).map((employee) => (
                  <div key={employee.employeeName} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{employee.employeeName}</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Working Days: {employee.stats.totalWorkingDays}</p>
                      <p>Attendance: {employee.stats.attendanceRate.toFixed(1)}%</p>
                      <p>Late Days: {employee.stats.lateDays}</p>
                      <p>Overtime Hours: {employee.stats.totalOvertimeHours.toFixed(1)}h</p>
                    </div>
                  </div>
                ))}
                
                {uploadedData.length > 6 && (
                  <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-blue-800 font-semibold">+{uploadedData.length - 6} more</p>
                      <p className="text-blue-600 text-sm">employees</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">CSV Format Requirements</h2>
            
            <div className="space-y-4 text-gray-700">
              <p>Your CSV file should contain the following columns:</p>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm">
                  employeeCode, employeeName, inOut, dateString, timeString
                </code>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Example Data:</h3>
                  <ul className="space-y-1 text-sm">
                    <li><strong>employeeCode:</strong> EMP001 (can be null)</li>
                    <li><strong>employeeName:</strong> John Doe</li>
                    <li><strong>inOut:</strong> IN or OUT</li>
                    <li><strong>dateString:</strong> 1-Jun-25</li>
                    <li><strong>timeString:</strong> 9:30</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Features:</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Automatic month/year detection</li>
                    <li>• Existing data replacement</li>
                    <li>• Late detection & break analysis</li>
                    <li>• Overtime calculation</li>
                    <li>• Holiday handling</li>
                    <li>• Performance scoring</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-yellow-800 mb-2">Important Notes:</h3>
                <ul className="space-y-1 text-sm text-yellow-700">
                  <li>• The system will automatically detect the month/year from your CSV data</li>
                  <li>• All existing data for the selected month will be completely replaced</li>
                  <li>• Make sure your CSV data is for the correct month before uploading</li>
                  <li>• The upload process cannot be undone - ensure your data is correct</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVUploadPage;