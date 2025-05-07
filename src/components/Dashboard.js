import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { debounce } from 'lodash';
import ExcelJS from 'exceljs';
import DataTable from './DataTable.js';
import '../styles/dashboard.css';

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// Function to calculate est_units based on wt and uom from daily_summary_2024
const calculateEstUnits = async (wt, product) => {
  if (!wt || !product) return 0;

  try {
    const parsedWt = parseFloat(wt);
    if (isNaN(parsedWt) || parsedWt <= 0) return 0;

    // Fetch uom from daily_summary_2024 based on product
    const { data, error } = await supabase
      .from('daily_summary_2024')
      .select('uom')
      .eq('product', product)
      .single();

    if (error || !data || !data.uom) {
      console.error('Error fetching uom for product:', product, error?.message);
      return 0; // Return 0 if product not found or uom is invalid
    }

    const parsedUom = parseFloat(data.uom);
    if (isNaN(parsedUom) || parsedUom <= 0) return 0;

    return Math.round(parsedWt / parsedUom);
  } catch (error) {
    console.error('Error calculating est_units:', error.message);
    return 0; // Return 0 on any error, mimicking IFERROR
  }
};

// AuditLogPopup component
const AuditLogPopup = ({ onClose, userTier }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const rowsPerPage = 10;

  const fetchAuditLogs = useCallback(async () => {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filterType) {
        query = query.eq('action_type', filterType);
      }
      if (filterUser) {
        query = query.ilike('user_email', `%${filterUser}%`);
      }

      const start = (currentPage - 1) * rowsPerPage;
      query = query.range(start, start + rowsPerPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      setAuditLogs(data || []);
      setTotalRows(count || 0);
    } catch (err) {
      alert(`Failed to fetch audit logs: ${err.message}`);
    }
  }, [currentPage, filterType, filterUser]);

  useEffect(() => {
    if ([0, 1].includes(userTier)) {
      fetchAuditLogs();
    }
  }, [fetchAuditLogs, userTier]);

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="upload-popup-backdrop">
      <div className="upload-popup-container">
        <div className="upload-popup-header">
          <h3>Audit Log</h3>
          <button onClick={onClose} className="upload-close-button">×</button>
        </div>
        <div className="upload-popup-content">
          <div className="sheet-selection-section">
            <div className="sheet-selection-form">
              <label htmlFor="filter-type">Filter by Action Type:</label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                className="sheet-select"
              >
                <option value="">All Actions</option>
                <option value="SIGN_IN">Sign-in</option>
                <option value="SUBMISSION">Submission</option>
                <option value="EDIT">Edit</option>
                <option value="DELETE_ROW">Delete Row</option>
                <option value="DUPLICATE_ROW">Duplicate Row</option>
              </select>
              <label htmlFor="filter-user">Filter by User Email:</label>
              <input
                id="filter-user"
                type="text"
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
                placeholder="Search by email..."
              />
            </div>
          </div>
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User Email</th>
                  <th>Action Type</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="no-data-message">No audit logs found</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.user_email}</td>
                      <td>{log.action_type}</td>
                      <td>
                        {log.action_type === 'SIGN_IN' && 'User signed in'}
                        {log.action_type === 'SUBMISSION' &&
                          `Uploaded file: ${log.details.file_name}, Rows: ${log.details.row_count}`}
                        {log.action_type === 'EDIT' &&
                          `Edited row ID: ${log.details.row_id}, Fields: ${Object.keys(log.details.changes).join(', ')}`}
                        {log.action_type === 'DELETE_ROW' &&
                          `Deleted row ID: ${log.details.row_id}`}
                        {log.action_type === 'DUPLICATE_ROW' &&
                          `Duplicated row ID: ${log.details.original_row_id} to new row ID: ${log.details.new_row_id}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="preview-pagination">
            <button onClick={() => goToPage(1)} disabled={currentPage === 1}>First</button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// UploadPopup component
const UploadPopup = ({ fileName, sheetNames, workbook, onCancel, onSubmit, userTier }) => {
  const [selectedSheet, setSelectedSheet] = useState(sheetNames[0] || 'Formulations 2025');
  const [headers, setHeaders] = useState([]);
  const [mappedHeaders, setMappedHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [step, setStep] = useState('sheetSelection');
  const [headerError, setHeaderError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [lockData, setLockData] = useState(false);
  const rowsPerPage = 10;

  const headerMapping = {
    'Plan Year': 'plan_year',
    'Pack Year': 'pack_year',
    'Week Start Date': 'week_start_date',
    'Week': 'week',
    'Product': 'product',
    'Category': 'category',
    'Type': 'type',
    'UOM': 'uom',
    'Strain': 'strain',
    'Production Plan': 'production_plan',
    'Distillate Oil Used': 'distillate_oil_used',
    'Batch Status': 'batch_status',
    'Reason': 'reason',
    'Original Oil Batch': 'original_oil_batch',
    'Formulation Batch #': 'formulation_batch_no',
    'Wt.': 'wt',
    'Est. Units': 'est_units',
    'Finished Goods Barcode': 'finished_goods_barcode',
    'Sample Date': 'sample_date',
    'Staging Status': 'staging_status',
    'Document #': 'document_no',
    'Staging Notes': 'staging_notes',
    'Packaging Status': 'packaging_status',
    'Total Units Packaged (includes samples)': 'total_units_package',
    '3rd party Sample Units': 'third_party_sample_units',
    'Packaging Final Units': 'packaging_final_units',
    'Packaged Date': 'packaged_date',
    'Packaged Week': 'packaged_week',
    'Sample Submission Date': 'sample_submission_date',
    'Est. HUB Landing': 'est_hub_landing',
    'Lab': 'lab'
  };

  const requiredColumns = Object.values(headerMapping);

  const handleSheetSelect = async () => {
    try {
      const worksheet = workbook.getWorksheet(selectedSheet);
      if (!worksheet) {
        throw new Error(`Worksheet "${selectedSheet}" not found.`);
      }

      const excelHeaders = worksheet.getRow(1).values.slice(1).map(h => h ? h.toString().trim() : '');
      const initialMappedHeaders = excelHeaders.map((header, index) => {
        const cleanHeader = header.toLowerCase();
        const foundKey = Object.keys(headerMapping).find(
          key => key.toLowerCase() === cleanHeader
        );
        return {
          original: header,
          mapped: foundKey ? headerMapping[foundKey] : null,
          index
        };
      });

      setHeaders(excelHeaders);
      setMappedHeaders(initialMappedHeaders);
      setStep('headerMapping');
    } catch (err) {
      alert(`Failed to process sheet: ${err.message}`);
    }
  };

  const handleHeaderChange = (index, value) => {
    setMappedHeaders(prev => prev.map(h => 
      h.index === index ? { ...h, mapped: value || null } : h
    ));
    setHeaderError('');
    setSubmitError('');
    setSubmitSuccess('');
  };

  const validateHeaders = () => {
    const mappedCols = mappedHeaders.filter(h => h.mapped).map(h => h.mapped);
    if (mappedCols.length === 0) {
      setHeaderError('At least one column must be mapped.');
      return false;
    }
    const duplicates = mappedCols.filter((col, i, arr) => col && arr.indexOf(col) !== i);
    if (duplicates.length > 0) {
      setHeaderError(`Duplicate column mappings: ${duplicates.join(', ')}`);
      return false;
    }
    const invalidCols = mappedCols.filter(col => !requiredColumns.includes(col));
    if (invalidCols.length > 0) {
      setHeaderError(`Invalid column mappings: ${invalidCols.join(', ')}`);
      return false;
    }
    return true;
  };

  const handleHeaderConfirm = async () => {
    if (!validateHeaders()) return;

    try {
      const worksheet = workbook.getWorksheet(selectedSheet);
      const rows = [];
      const currentYear = new Date().getFullYear();
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const supabaseColumn = mappedHeaders[colNumber - 1]?.mapped;
          if (supabaseColumn && requiredColumns.includes(supabaseColumn)) {
            let value = cell.value;
            if (value && typeof value === 'object') {
              if ('result' in value) {
                value = value.result;
              } else if ('richText' in value) {
                value = value.richText.map(rt => rt.text).join('');
              } else {
                value = value.toString();
              }
            }
            if (['week_start_date', 'sample_date', 'packaged_date', 'sample_submission_date', 'est_hub_landing'].includes(supabaseColumn)) {
              if (typeof value === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
                value = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
              } else if (value && typeof value === 'string') {
                const date = new Date(value);
                value = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
              }
            }
            rowData[supabaseColumn] = (value === '' || value === null || value === undefined || value === 0) ? null : value;
          }
        });
        rowData.created_at = new Date().toISOString();
        rowData.updated_at = new Date().toISOString();
        rowData.updated_by = localStorage.getItem('username');
        rowData.plan_year = currentYear;
        if (rowData.packaged_date) {
          const packDate = new Date(rowData.packaged_date);
          rowData.pack_year = isNaN(packDate.getTime()) ? null : packDate.getFullYear();
        }
        rows.push(rowData);
      });

      if (rows.length === 0) {
        throw new Error('No data rows found in the Excel file.');
      }

      // Calculate est_units for each row
      const rowsWithEstUnits = await Promise.all(rows.map(async (row) => {
        const estUnits = await calculateEstUnits(row.wt, row.product);
        return { ...row, est_units: estUnits };
      }));

      setPreviewData(rowsWithEstUnits);
      setStep('preview');
      setCurrentPage(1);
    } catch (err) {
      alert(`Failed to process data: ${err.message}`);
    }
  };

  const totalRows = previewData.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = previewData.slice(startIndex, startIndex + rowsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSubmit = () => {
    onSubmit(previewData, mappedHeaders.filter(h => h.mapped).map(h => h.mapped), setSubmitError, setSubmitSuccess, lockData);
  };

  return (
    <div className="upload-popup-backdrop">
      <div className="upload-popup-container">
        <div className="upload-popup-header">
          <h3>Upload Excel Data</h3>
          <button onClick={onCancel} className="upload-close-button">×</button>
        </div>
        <div className="upload-popup-content">
          {step === 'sheetSelection' && (
            <div className="sheet-selection-section">
              <p><strong>File:</strong> {fileName}</p>
              <p><strong>Sheets ({sheetNames.length}):</strong> {sheetNames.join(', ')}</p>
              <div className="sheet-selection-form">
                <label htmlFor="sheet-select">Select Sheet:</label>
                <select
                  id="sheet-select"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="sheet-select"
                >
                  {sheetNames.map((sheet) => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
              </div>
              <div className="sheet-selection-buttons">
                <button onClick={onCancel} className="upload-cancel-button">Cancel</button>
                <button onClick={handleSheetSelect} className="upload-proceed-button">Proceed</button>
              </div>
            </div>
          )}
          {step === 'headerMapping' && (
            <div className="header-mapping-section">
              <h4>Map Excel Headers</h4>
              <p>Match Excel headers to database columns. Unmapped headers will be ignored.</p>
              {headerError && <p className="header-error">{headerError}</p>}
              <div className="header-mapping-grid">
                {headers.map((header, index) => (
                  <div key={index} className="header-mapping-row">
                    <span className={mappedHeaders[index].mapped ? 'header-valid' : 'header-unmapped'}>
                      {header || 'Empty'}
                    </span>
                    <select
                      value={mappedHeaders[index].mapped || ''}
                      onChange={(e) => handleHeaderChange(index, e.target.value)}
                      className="header-select"
                    >
                      <option value="">Ignore</option>
                      {requiredColumns.map((col) => (
                        <option key={col} value={col}>{Object.keys(headerMapping).find(key => headerMapping[key] === col)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="header-mapping-buttons">
                <button onClick={() => setStep('sheetSelection')} className="upload-cancel-button">Back</button>
                <button onClick={handleHeaderConfirm} className="upload-proceed-button">Preview Data</button>
              </div>
            </div>
          )}
          {step === 'preview' && (
            <div className="preview-section">
              <p><strong>Rows:</strong> {totalRows}</p>
              {submitError && <p className="submit-error">{submitError}</p>}
              {submitSuccess && <p className="submit-success">{submitSuccess}</p>}
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {mappedHeaders.filter(h => h.mapped).map((h, index) => (
                        <th key={index}>{Object.keys(headerMapping).find(key => headerMapping[key] === h.mapped)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {mappedHeaders.filter(h => h.mapped).map((h, colIndex) => (
                          <td key={colIndex}>{row[h.mapped] != null ? String(row[h.mapped]) : 'NULL'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="preview-pagination">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1}>First</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
              </div>
              {userTier === 0 && (
                <div className="lock-data-option" style={{ margin: '10px 0' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={lockData}
                      onChange={(e) => setLockData(e.target.checked)}
                    />
                    Lock uploaded data
                  </label>
                </div>
              )}
              <div className="preview-buttons">
                <button onClick={() => setStep('headerMapping')} className="upload-cancel-button">Edit Headers</button>
                <button onClick={handleSubmit} className="upload-submit-button">Submit</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confirmation reducer for managing three-step save flow
const confirmationReducer = (state, action) => {
  switch (action.type) {
    case 'START_CONFIRMATION':
      return {
        step: 1,
        rowId: action.payload.rowId,
        colKey: action.payload.colKey,
        value: action.payload.value,
        estUnits: action.payload.estUnits,
        scrollPosition: action.payload.scrollPosition,
        cellRect: action.payload.cellRect,
      };
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'RESET':
      return { step: 0, rowId: null, colKey: null, value: null, estUnits: null, scrollPosition: null, cellRect: null };
    default:
      return state;
  }
};

// Dashboard component
const Dashboard = ({ onLogout }) => {
  const [tableData, setTableData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [pageInput, setPageInput] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditPopup, setShowAuditPopup] = useState(false);
  const [userTier, setUserTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [uploadData, setUploadData] = useState({ fileName: '', sheetNames: [], workbook: null });
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [confirmationState, dispatchConfirmation] = useReducer(confirmationReducer, {
    step: 0,
    rowId: null,
    colKey: null,
    value: null,
    estUnits: null,
    scrollPosition: null,
    cellRect: null,
  });
  const [graceTimers, setGraceTimers] = useState({});
  const tableScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Effect to manage grace period countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setGraceTimers((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cellKey) => {
          updated[cellKey] = Math.max(0, updated[cellKey] - 1);
          if (updated[cellKey] === 0) {
            const [rowId, colKey] = cellKey.split(':');
            lockCell(rowId, colKey);
            delete updated[cellKey];
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Function to lock a single cell after grace period
  const lockCell = async (rowId, colKey) => {
    try {
      const { data: rowData, error: fetchError } = await supabase
        .from('fnp_tracker')
        .select('id, locked_cells, locked, colors')
        .eq('id', rowId)
        .single();

      if (fetchError || !rowData) {
        throw new Error(`Row with ID ${rowId} does not exist`);
      }

      let lockedCells = rowData.locked_cells || {};
      if (typeof lockedCells === 'string') {
        lockedCells = JSON.parse(lockedCells);
      }

      let validColors = rowData.colors || {};
      if (typeof validColors === 'string') {
        validColors = JSON.parse(validColors);
      }

      const cellKey = `${rowId}:${colKey}`;
      lockedCells[cellKey] = { locked: true, timestamp: new Date().toISOString() };

      // Check if all columns are locked
      const columns = [
        'plan_year', 'pack_year', 'week_start_date', 'week', 'product', 'category', 'type', 'uom', 'strain',
        'production_plan', 'distillate_oil_used', 'batch_status', 'reason', 'original_oil_batch',
        'formulation_batch_no', 'wt', 'est_units', 'finished_goods_barcode', 'sample_date', 'staging_status',
        'document_no', 'staging_notes', 'packaging_status', 'total_units_package', 'third_party_sample_units',
        'packaging_final_units', 'packaged_date', 'packaged_week', 'sample_submission_date', 'est_hub_landing', 'lab'
      ];
      const allLocked = columns.every(col => 
        lockedCells[`${rowId}:${col}`]?.locked || rowData[col] == null
      );

      const updates = {
        locked_cells: lockedCells,
        locked: allLocked,
        lock_timestamp: allLocked ? new Date().toISOString() : rowData.lock_timestamp,
        updated_by: localStorage.getItem('username'),
        updated_at: new Date().toISOString(),
        colors: validColors, // Preserve existing colors
      };

      const { error: updateError } = await supabase
        .from('fnp_tracker')
        .update(updates)
        .eq('id', rowId);

      if (updateError) {
        throw new Error(`Failed to lock cell: ${updateError.message}`);
      }

      setTableData((prev) =>
        prev.map((row) =>
          String(row.id) === String(rowId)
            ? { ...row, ...updates }
            : row
        )
      );
    } catch (error) {
      console.error('Error locking cell:', error);
      alert(`Failed to lock cell: ${error.message}`);
    }
  };

  const fetchUserSession = useCallback(async () => {
    try {
      setLoading(true);
      let email = localStorage.getItem('username');
      let tier = parseInt(localStorage.getItem('userTier'), 10);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Session invalid or user not authenticated.');
      }

      const isTierValid = Number.isInteger(tier) && [0, 1, 2, 3].includes(tier);
      if (!email || email !== user.email || !isTierValid) {
        const { data: userData, error: tierError } = await supabase
          .from('users')
          .select('tier')
          .eq('email', user.email)
          .single();

        if (tierError || !userData) {
          throw new Error(tierError?.message || 'User tier not found');
        }

        tier = userData.tier;
        if (![0, 1, 2, 3].includes(tier)) {
          throw new Error('Invalid user tier');
        }

        localStorage.setItem('username', user.email);
        localStorage.setItem('userTier', tier);
      }

      setUserTier(tier);
      setIsAuthenticated(true);
    } catch (err) {
      setError('Failed to validate user session. Please log in again.');
      setUserTier(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserSession();
  }, [fetchUserSession]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUserTier(null);
        setTableData([]);
        setTotalRows(0);
        setCurrentPage(1);
        setPageInput(1);
        setSearchQuery('');
        setShowAuditPopup(false);
        setShowUploadPopup(false);
        setUploadData({ fileName: '', sheetNames: [], workbook: null });
        onLogout();
      } else if (event === 'SIGNED_IN' && session) {
        setIsAuthenticated(true);
        localStorage.setItem('username', session.user.email);
        fetchUserSession();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [onLogout, fetchUserSession]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      localStorage.removeItem('username');
      localStorage.removeItem('userTier');

      setIsAuthenticated(false);
      setUserTier(null);
      setTableData([]);
      setTotalRows(0);
      setCurrentPage(1);
      setPageInput(1);
      setSearchQuery('');
      setShowAuditPopup(false);
      setShowUploadPopup(false);
      setUploadData({ fileName: '', sheetNames: [], workbook: null });

      onLogout();
    } catch (error) {
      alert('Failed to log out. Please try again.');
    }
  };

  const restoreScrollPosition = useMemo(
    () => debounce(({ scrollTop, scrollLeft }) => {
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollTop = scrollTop;
        tableScrollRef.current.scrollLeft = scrollLeft;
      }
    }, 100),
    []
  );

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      alert('Please upload an Excel (.xlsx) file.');
      return;
    }

    try {
      setLoading(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file);
      const sheetNames = workbook.worksheets.map(ws => ws.name);
      if (sheetNames.length === 0) {
        throw new Error('No worksheets found in the Excel file.');
      }

      setUploadData({
        fileName: file.name,
        sheetNames,
        workbook,
      });
      setShowUploadPopup(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      alert(`Failed to process file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCancel = () => {
    setShowUploadPopup(false);
    setUploadData({ fileName: '', sheetNames: [], workbook: null });
  };

  const handleUploadSubmit = async (rows, mappedColumns, setSubmitError, setSubmitSuccess, lockData) => {
    try {
      setLoading(true);
      const username = localStorage.getItem('username');
      if (!username) {
        throw new Error('No username found in localStorage');
      }

      const formattedRows = await Promise.all(rows.map(async row => {
        const lockedCells = lockData ? mappedColumns.reduce((acc, col) => {
          if (row[col] != null && row[col] !== '') {
            acc[`${row.id}:${col}`] = { locked: true, timestamp: new Date().toISOString() };
          }
          return acc;
        }, {}) : {};

        // Calculate est_units based on wt and product
        const estUnits = await calculateEstUnits(row.wt, row.product);

        const formattedRow = {
          ...row,
          est_units: estUnits,
          colors: row.packaged_date ? { week_start_date: '#e6ccff' } : {},
          locked_cells: lockedCells,
          is_duplicate: false,
          updated_by: username,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        return formattedRow;
      }));

      const { data, error: insertError } = await supabase
        .from('fnp_tracker')
        .insert(formattedRows)
        .select();

      if (insertError) {
        throw new Error(`Failed to insert data: ${insertError.message}`);
      }

      const auditLog = {
        user_email: username,
        action_type: 'SUBMISSION',
        details: {
          file_name: uploadData.fileName,
          row_count: formattedRows.length,
        },
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditLog);

      if (auditError) {
        console.error('Failed to log submission to audit_logs:', auditError);
      }

      setTableData(prev => {
        const nonDuplicateRows = prev.filter(row => !row.is_duplicate);
        let currentRowNumber = nonDuplicateRows.length > 0 ? Math.max(...nonDuplicateRows.map(r => r.rowNumber || 0)) : 0;
        const newData = [
          ...prev,
          ...data.map(row => {
            const isDuplicate = row.is_duplicate === true;
            return {
              ...row,
              rowNumber: isDuplicate ? null : ++currentRowNumber,
              locked_cells: typeof row.locked_cells === 'string' ? JSON.parse(row.locked_cells || '{}') : (row.locked_cells || {}),
              is_duplicate: isDuplicate,
            };
          }),
        ];
        return newData;
      });
      setTotalRows(prev => prev + data.length);

      setSubmitSuccess(`Successfully uploaded ${formattedRows.length} rows.`);
      setTimeout(() => {
        setShowUploadPopup(false);
        setUploadData({ fileName: '', sheetNames: [], workbook: null });
      }, 2000);
    } catch (err) {
      setSubmitError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('fnp_tracker')
        .select('*, is_duplicate, locked_cells, locked, lock_timestamp', { count: 'exact' })
        .order('created_at', { ascending: true });

      if (searchQuery) {
        query = query.or(
          `product.ilike.%${searchQuery}%,batch_status.ilike.%${searchQuery}%,staging_status.ilike.%${searchQuery}%,packaging_status.ilike.%${searchQuery}%`
        );
      }

      const start = (currentPage - 1) * rowsPerPage;
      query = query.range(start, start + rowsPerPage - 1);

      const { data, count, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch data: ${error.message}`);
      }

      let currentRowNumber = start;
      const formattedData = (data || []).map(row => {
        const isDuplicate = row.is_duplicate === true;
        return {
          ...row,
          rowNumber: isDuplicate ? null : ++currentRowNumber,
          locked_cells: typeof row.locked_cells === 'string' ? JSON.parse(row.locked_cells || '{}') : (row.locked_cells || {}),
          is_duplicate: isDuplicate,
        };
      });

      // Initialize grace timers for cells within grace period
      const newGraceTimers = {};
      formattedData.forEach((row) => {
        Object.keys(row.locked_cells).forEach((cellKey) => {
          const { locked, timestamp } = row.locked_cells[cellKey];
          if (locked && timestamp) {
            const timeElapsed = Date.now() - new Date(timestamp).getTime();
            const GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes
            if (timeElapsed < GRACE_PERIOD) {
              newGraceTimers[cellKey] = Math.floor((GRACE_PERIOD - timeElapsed) / 1000);
            }
          }
        });
      });
      setGraceTimers((prev) => ({ ...prev, ...newGraceTimers }));

      setTableData(formattedData);
      setTotalRows(count || 0);
      restoreScrollPosition({ scrollTop: tableScrollRef.current?.scrollTop || 0, scrollLeft: tableScrollRef.current?.scrollLeft || 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, searchQuery, restoreScrollPosition]);

  useEffect(() => {
    if (userTier !== null) {
      fetchTableData();
    }
  }, [fetchTableData, userTier]);

  const handleCellEdit = async (rowId, colKey, value, scrollPosition, cellRect) => {
    if (userTier > 1) return;

    let estUnits = null;
    if (colKey === 'wt') {
      const row = tableData.find(r => String(r.id) === String(rowId));
      if (row && row.product) {
        estUnits = await calculateEstUnits(value, row.product);
      }
    }

    dispatchConfirmation({
      type: 'START_CONFIRMATION',
      payload: { rowId, colKey, value, estUnits, scrollPosition, cellRect },
    });
  };

  const handleConfirmation = async (confirm) => {
    if (!confirm) {
      dispatchConfirmation({ type: 'RESET' });
      return;
    }

    if (confirmationState.step < 3) {
      dispatchConfirmation({ type: 'NEXT_STEP' });
      return;
    }

    // Final confirmation: update Supabase
    try {
      setLoading(true);
      const { rowId, colKey, value, estUnits, scrollPosition } = confirmationState;
      const username = localStorage.getItem('username');
      if (!username) {
        throw new Error('No username found in localStorage');
      }

      const { data: rowData, error: fetchError } = await supabase
        .from('fnp_tracker')
        .select('id, colors, locked_cells, pack_year, packaged_date, locked, product, production_plan, wt')
        .eq('id', rowId)
        .single();

      if (fetchError || !rowData) {
        throw new Error(`Row with ID ${rowId} does not exist`);
      }

      let validColors = rowData.colors || {};
      if (typeof validColors === 'string') {
        validColors = JSON.parse(validColors);
      }

      let lockedCells = rowData.locked_cells || {};
      if (typeof lockedCells === 'string') {
        lockedCells = JSON.parse(lockedCells);
      }

      const lockTimestamp = new Date().toISOString();
      const cellKey = `${rowId}:${colKey}`;
      const updates = {
        [colKey]: value || null,
        updated_by: username,
        updated_at: new Date().toISOString(),
        locked_cells: {
          ...lockedCells,
          [cellKey]: { locked: true, timestamp: lockTimestamp },
        },
      };

      if (colKey === 'packaged_date') {
        updates.pack_year = value ? new Date(value).getFullYear() : null;
        if (value) {
          validColors.week_start_date = '#e6ccff';
        } else {
          delete validColors.week_start_date;
        }
        updates.colors = validColors;
      }

      if (colKey === 'wt' && estUnits !== null) {
        updates.est_units = estUnits;
        updates.locked_cells[`${rowId}:est_units`] = { locked: true, timestamp: lockTimestamp };
      }

      // Check if all columns are locked
      const columns = [
        'plan_year', 'pack_year', 'week_start_date', 'week', 'product', 'category', 'type', 'uom', 'strain',
        'production_plan', 'distillate_oil_used', 'batch_status', 'reason', 'original_oil_batch',
        'formulation_batch_no', 'wt', 'est_units', 'finished_goods_barcode', 'sample_date', 'staging_status',
        'document_no', 'staging_notes', 'packaging_status', 'total_units_package', 'third_party_sample_units',
        'packaging_final_units', 'packaged_date', 'packaged_week', 'sample_submission_date', 'est_hub_landing', 'lab'
      ];
      const allLocked = columns.every(col => 
        updates.locked_cells[`${rowId}:${col}`]?.locked || rowData[col] == null
      );

      updates.locked = allLocked;
      updates.lock_timestamp = allLocked ? new Date().toISOString() : rowData.lock_timestamp;

      const { error: updateError } = await supabase
        .from('fnp_tracker')
        .update(updates)
        .eq('id', rowId);

      if (updateError) {
        throw new Error(`Failed to update cell: ${updateError.message}`);
      }

      const auditLog = {
        user_email: username,
        action_type: 'EDIT',
        details: {
          row_id: rowId,
          changes: {
            [colKey]: {
              old: rowData[colKey] || null,
              new: value || null,
            },
            ...(colKey === 'wt' && estUnits !== null ? {
              est_units: {
                old: rowData.est_units || null,
                new: estUnits,
              },
            } : {}),
          },
        },
      };

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditLog);

      if (auditError) {
        console.error('Failed to log edit to audit_logs:', auditError);
      }

      setTableData((prev) =>
        prev.map((row) =>
          String(row.id) === String(rowId)
            ? {
                ...row,
                [colKey]: value || null,
                est_units: colKey === 'wt' ? estUnits : row.est_units,
                colors: updates.colors || row.colors,
                pack_year: updates.pack_year !== undefined ? updates.pack_year : row.pack_year,
                locked_cells: updates.locked_cells,
                locked: updates.locked,
                lock_timestamp: updates.lock_timestamp,
              }
            : row
        )
      );

      // Start 5-minute grace period timer for edited cell and est_units (if applicable)
      setGraceTimers((prev) => ({
        ...prev,
        [cellKey]: 300, // 5 minutes in seconds
        ...(colKey === 'wt' && estUnits !== null ? { [`${rowId}:est_units`]: 300 } : {}),
      }));

      // Restore scroll position
      restoreScrollPosition(scrollPosition);

      dispatchConfirmation({ type: 'RESET' });
    } catch (error) {
      alert(`Error updating cell: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = async (cellsToUpdate) => {
    try {
      setLoading(true);
      const username = localStorage.getItem('username');
      if (!username) {
        throw new Error('No username found in localStorage');
      }

      const groupedByRow = cellsToUpdate.reduce((acc, cell) => {
        if (!acc[cell.rowId]) {
          acc[cell.rowId] = [];
        }
        acc[cell.rowId].push(cell);
        return acc;
      }, {});

      for (const rowId of Object.keys(groupedByRow)) {
        const cells = groupedByRow[rowId];
        const { data: rowData, error: fetchError } = await supabase
          .from('fnp_tracker')
          .select('id, colors')
          .eq('id', rowId)
          .single();

        if (fetchError || !rowData) {
          throw new Error(`Row with ID ${rowId} does not exist`);
        }

        let validColors = rowData.colors || {};
        if (typeof validColors === 'string') {
          try {
            validColors = JSON.parse(validColors);
          } catch (e) {
            validColors = {};
          }
        }

        const oldColors = { ...validColors };
        cells.forEach(cell => {
          if (cell.color === 'transparent' || cell.color === '#ffffff') {
            delete validColors[cell.colKey];
          } else {
            validColors[cell.colKey] = cell.color;
          }
        });

        const { error: updateError } = await supabase
          .from('fnp_tracker')
          .update({
            colors: validColors,
            updated_by: username,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rowId);

        if (updateError) {
          throw new Error(`Failed to update colors: ${updateError.message}`);
        }

        const auditLog = {
          user_email: username,
          action_type: 'COLOR_CHANGE',
          details: {
            row_id: rowId,
            changes: {
              colors: {
                old: oldColors,
                new: validColors,
              },
            },
          },
        };

        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert(auditLog);

        if (auditError) {
          console.error('Failed to log color change to audit_logs:', auditError);
        }

        setTableData(prev =>
          prev.map(row =>
            String(row.id) === String(rowId)
              ? {
                  ...row,
                  colors: validColors,
                  locked_cells: typeof row.locked_cells === 'string' ? JSON.parse(row.locked_cells || '{}') : (row.locked_cells || {}),
                  is_duplicate: row.is_duplicate === true ? true : false,
                }
              : row
          )
        );
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setPageInput(page);
    }
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    setPageInput(value);
    if (value && !isNaN(value) && Number(value) >= 1 && Number(value) <= totalPages) {
      goToPage(Number(value));
    }
  };

  const handleRowsPerPageChange = (e) => {
    const value = Number(e.target.value);
    setRowsPerPage(value);
    setCurrentPage(1);
    setPageInput(1);
  };

  const renderPagination = () => (
    <div className="pagination-controls">
      <button onClick={() => goToPage(1)} disabled={currentPage === 1}>First</button>
      <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
      <span>
        Page{' '}
        <input
          type="number"
          value={pageInput}
          onChange={handlePageInputChange}
          min="1"
          max={totalPages}
          style={{ width: '60px' }}
        />{' '}
        of {totalPages}
      </span>
      <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
      <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
      <select value={rowsPerPage} onChange={handleRowsPerPageChange}>
        <option value={50}>50 rows</option>
        <option value={100}>100 rows</option>
        <option value={200}>200 rows</option>
      </select>
    </div>
  );

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !isAuthenticated) {
    return (
      <div className="error">
        {error || 'You have been logged out. Please log in again.'}
        <button onClick={handleLogout} className="logout-button">Log Out</button>
      </div>
    );
  }

  if (userTier === null) {
    return <div className="error">No user tier assigned. Please contact support.</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="logo-container">
          <img src="/assets/curaleaf.png" alt="Curaleaf Logo" className="curaleaf-logo" />
          <h2>Curaleaf F&P Tracker</h2>
        </div>
        <div className="dashboard-controls">
          <input
            type="text"
            placeholder="Search by product, batch status, etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {userTier === 0 && (
            <>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <button onClick={() => fileInputRef.current?.click()} className="upload-button">
                Upload Excel
              </button>
            </>
          )}
          {[0, 1].includes(userTier) && (
            <button onClick={() => setShowAuditPopup(true)} className="audit-button">
              View Audit Log
            </button>
          )}
          <button onClick={handleLogout} className="logout-button">Log Out</button>
        </div>
      </div>
      <DataTable
        tableData={tableData}
        renderPagination={renderPagination}
        onColorChange={handleColorChange}
        onCellEdit={handleCellEdit}
        userTier={userTier}
        tableScrollRef={tableScrollRef}
        setTableData={setTableData}
        graceTimers={graceTimers}
      />
      {showUploadPopup && (
        <UploadPopup
          fileName={uploadData.fileName}
          sheetNames={uploadData.sheetNames}
          workbook={uploadData.workbook}
          onCancel={handleUploadCancel}
          onSubmit={handleUploadSubmit}
          userTier={userTier}
        />
      )}
      {showAuditPopup && (
        <AuditLogPopup
          onClose={() => setShowAuditPopup(false)}
          userTier={userTier}
        />
      )}
      {confirmationState.step === 1 && (
        <div
          className="confirmation-dialog"
          style={{
            position: 'fixed',
            top: confirmationState.cellRect.top + confirmationState.cellRect.height,
            left: confirmationState.cellRect.left,
            zIndex: 1000,
          }}
        >
          <div className="confirmation-content">
            <h3>Save Draft?</h3>
            <p>Do you want to save this change as a draft?</p>
            {confirmationState.colKey === 'wt' && confirmationState.estUnits !== null && (
              <p>Estimated Units will be set to: {confirmationState.estUnits}</p>
            )}
            <div className="confirmation-buttons">
              <button onClick={() => handleConfirmation(true)}>Yes</button>
              <button onClick={() => handleConfirmation(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {confirmationState.step === 2 && (
        <div
          className="confirmation-dialog"
          style={{
            position: 'fixed',
            top: confirmationState.cellRect.top + confirmationState.cellRect.height,
            left: confirmationState.cellRect.left,
            zIndex: 1000,
          }}
        >
          <div className="confirmation-content">
            <h3>Are you sure?</h3>
            <p>You'll have 5 minutes to undo this change.</p>
            {confirmationState.colKey === 'wt' && confirmationState.estUnits !== null && (
              <p>Estimated Units will be set to: {confirmationState.estUnits}</p>
            )}
            <div className="confirmation-buttons">
              <button onClick={() => handleConfirmation(true)}>Yes</button>
              <button onClick={() => handleConfirmation(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {confirmationState.step === 3 && (
        <div
          className="confirmation-dialog"
          style={{
            position: 'fixed',
            top: confirmationState.cellRect.top + confirmationState.cellRect.height,
            left: confirmationState.cellRect.left,
            zIndex: 1000,
          }}
        >
          <div className="confirmation-content">
            <h3>Commit Change</h3>
            <p>This will finalize the change. Proceed?</p>
            {confirmationState.colKey === 'wt' && confirmationState.estUnits !== null && (
              <p>Estimated Units will be set to: {confirmationState.estUnits}</p>
            )}
            <div className="confirmation-buttons">
              <button onClick={() => handleConfirmation(true)}>Commit</button>
              <button onClick={() => handleConfirmation(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;