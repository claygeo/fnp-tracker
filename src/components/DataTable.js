import React, { useState, useEffect, useRef, memo } from 'react';
import { createClient } from '@supabase/supabase-js';
import ColorRulesPopup from './ColorRulesPopup.js';
import '../styles/dashboard.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// EditOverlay component for fixed-position inline editor
const EditOverlay = ({ rowId, colKey, value, field, onSave, onCancel, cellRect, columnWidth }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [validationError, setValidationError] = useState(null);
  const inputRef = useRef(null);

  // Validate input based on field type
  const validateInput = (val) => {
    if (field.type === 'date' && val) {
      const date = new Date(val);
      if (isNaN(date.getTime())) return 'Invalid date format. Use YYYY-MM-DD.';
      if (date.getFullYear() < 2000 || date.getFullYear() > 2100) return 'Date must be between 2000 and 2100.';
    }
    if (field.type === 'select' && val && !field.options.includes(val)) {
      return 'Please select a valid option.';
    }
    if (field.type === 'number' && val && isNaN(parseFloat(val))) {
      return 'Please enter a valid number.';
    }
    return null;
  };

  // Handle input changes with validation
  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setValidationError(validateInput(newValue));
  };

  // Handle save
  const handleSave = () => {
    if (validationError) return;
    onSave(rowId, colKey, inputValue);
  };

  // Autosize input based on content
  useEffect(() => {
    if (inputRef.current && field.type !== 'select' && field.type !== 'textarea') {
      const input = inputRef.current;
      const tempSpan = document.createElement('span');
      tempSpan.style.fontSize = '14px';
      tempSpan.style.fontFamily = 'inherit';
      tempSpan.style.padding = '0';
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.textContent = inputValue || input.placeholder;
      document.body.appendChild(tempSpan);
      const width = tempSpan.offsetWidth + 20; // Add padding
      input.style.width = `${Math.min(width, columnWidth)}px`;
      document.body.removeChild(tempSpan);
    }
  }, [inputValue, columnWidth, field.type]);

  // Position overlay exactly over the cell
  const overlayStyle = {
    position: 'fixed',
    top: cellRect.top,
    left: cellRect.left,
    width: `clamp(150px, ${columnWidth}px, ${columnWidth}px)`,
    zIndex: 100,
  };

  // Render read-only for est_units
  if (colKey === 'est_units') {
    return (
      <div className="edit-overlay" style={overlayStyle}>
        <input
          type="text"
          value={inputValue}
          className="edit-input read-only"
          readOnly
          title="Estimated Units are auto-calculated"
        />
        <div className="edit-buttons">
          <button onClick={onCancel} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-overlay" style={overlayStyle}>
      {field.type === 'select' ? (
        <select
          value={inputValue}
          onChange={handleChange}
          autoFocus
          className="edit-input"
          ref={inputRef}
        >
          <option value="">Select</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={inputValue}
          onChange={handleChange}
          autoFocus
          rows={3}
          className="edit-input"
          ref={inputRef}
          style={{ maxWidth: `${columnWidth}px` }}
        />
      ) : (
        <input
          type={field.type}
          value={inputValue}
          onChange={handleChange}
          autoFocus
          className="edit-input"
          ref={inputRef}
        />
      )}
      <div className="edit-buttons">
        <button onClick={handleSave} disabled={!!validationError} className="save-btn">
          Save
        </button>
        <button onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
      </div>
      {validationError && <span className="validation-error">{validationError}</span>}
    </div>
  );
};

const DataTable = memo(({ tableData, renderPagination, onColorChange, onCellEdit, userTier, tableScrollRef, setTableData, graceTimers }) => {
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState({ visible: false, x: 0, y: 0, rowId: null });
  const [showColorRulesPopup, setShowColorRulesPopup] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const tableRef = useRef(null);
  const columnMenuRef = useRef(null);
  const rowMenuRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const [visibleColumns, setVisibleColumns] = useState({
    plan_year: true,
    pack_year: true,
    week_start_date: true,
    week: true,
    product: true,
    category: true,
    type: true,
    uom: true,
    strain: true,
    production_plan: true,
    distillate_oil_used: true,
    batch_status: true,
    reason: true,
    original_oil_batch: true,
    formulation_batch_no: true,
    wt: true,
    est_units: true,
    finished_goods_barcode: true,
    sample_date: true,
    staging_status: true,
    document_no: true,
    staging_notes: true,
    packaging_status: true,
    total_units_package: true,
    third_party_sample_units: true,
    packaging_final_units: true,
    packaged_date: true,
    packaged_week: true,
    sample_submission_date: true,
    est_hub_landing: true,
    lab: true,
  });
  const [spacers, setSpacers] = useState([]);

  const zoomPresets = [
    { label: '50%', value: 0.5 },
    { label: '80%', value: 0.8 },
    { label: '100%', value: 1.0 },
    { label: '120%', value: 1.2 },
    { label: '150%', value: 1.5 },
  ];

  const columns = [
    { key: 'plan_year', label: 'Plan Year', canToggle: true, width: 150, tooltip: 'The year the production plan was created' },
    { key: 'pack_year', label: 'Pack Year', canToggle: true, width: 150, tooltip: 'The year the product was packaged' },
    { key: 'week_start_date', label: 'Week Start Date', width: 180, tooltip: 'Start date of the production week' },
    { key: 'week', label: 'Week', width: 100, tooltip: 'Week number in the year' },
    { key: 'product', label: 'Product', width: 200, tooltip: 'Name of the product' },
    { key: 'category', label: 'Category', width: 150, tooltip: 'Product category (e.g., Flower, Cartridge)' },
    { key: 'type', label: 'Type', width: 150, tooltip: 'Product type (e.g., Indica, Sativa, Hybrid)' },
    { key: 'uom', label: 'UOM', width: 100, tooltip: 'Unit of measure (e.g., g, mL, mg)' },
    { key: 'strain', label: 'Strain', width: 150, tooltip: 'Cannabis strain used in the product' },
    { key: 'production_plan', label: 'Production Plan', width: 180, tooltip: 'Assigned production plan number' },
    { key: 'distillate_oil_used', label: 'Distillate Oil Used', width: 180, tooltip: 'Amount of distillate oil used in production' },
    { key: 'batch_status', label: 'Batch Status', width: 180, tooltip: 'Current status of the batch (e.g., Formulation Approved)' },
    { key: 'reason', label: 'Reason', width: 200, tooltip: 'Reason for the batch status' },
    { key: 'original_oil_batch', label: 'Original Oil Batch', width: 200, tooltip: 'Batch number of the original oil used' },
    { key: 'formulation_batch_no', label: 'Formulation Batch #', width: 180, tooltip: 'Formulation batch number' },
    { key: 'wt', label: 'Wt.', width: 100, tooltip: 'Weight of the product' },
    { key: 'est_units', label: 'Est. Units', width: 100, tooltip: 'Estimated number of units (auto-calculated)' },
    { key: 'finished_goods_barcode', label: 'Finished Goods Barcode', width: 200, tooltip: 'Barcode for finished goods' },
    { key: 'sample_date', label: 'Sample Date', width: 150, tooltip: 'Date the sample was taken' },
    { key: 'staging_status', label: 'Staging Status', width: 180, tooltip: 'Current staging status' },
    { key: 'document_no', label: 'Document #', width: 150, tooltip: 'Document number for tracking' },
    { key: 'staging_notes', label: 'Staging Notes', width: 200, tooltip: 'Notes related to staging' },
    { key: 'packaging_status', label: 'Packaging Status', width: 180, tooltip: 'Current packaging status' },
    { key: 'total_units_package', label: 'Total Units Package', width: 180, tooltip: 'Total units in the package' },
    { key: 'third_party_sample_units', label: '3rd Party Sample Units', width: 180, tooltip: 'Units sent for third-party sampling' },
    { key: 'packaging_final_units', label: 'Packaging Final Units', width: 180, tooltip: 'Final packaged units' },
    { key: 'packaged_date', label: 'Packaged Date', width: 150, tooltip: 'Date the product was packaged' },
    { key: 'packaged_week', label: 'Packaged Week', width: 150, tooltip: 'Week the product was packaged' },
    { key: 'sample_submission_date', label: 'Sample Submission Date', width: 180, tooltip: 'Date the sample was submitted' },
    { key: 'est_hub_landing', label: 'Est. HUB Landing', width: 150, tooltip: 'Estimated HUB landing date' },
    { key: 'lab', label: 'Lab', width: 150, tooltip: 'Lab responsible for testing' },
  ];

  const fields = [
    { key: 'sample_date', label: 'Sample Date', type: 'date', tab: 'Dates' },
    {
      key: 'staging_status',
      label: 'Staging Status',
      type: 'select',
      options: [
        'STAGED', 'Component Shortage', 'Staging Complete', 'Staging In Process',
        'Staging Needed', 'Staging Priority'
      ],
      tab: 'Staging'
    },
    { key: 'staging_notes', label: 'Staging Notes', type: 'textarea', tab: 'Staging' },
    { key: 'packaged_date', label: 'Packaged Date', type: 'date', tab: 'Dates' },
    { key: 'sample_submission_date', label: 'Sample Submission Date', type: 'date', tab: 'Dates' },
    { key: 'product', label: 'Product', type: 'text', tab: 'Production' },
    { key: 'category', label: 'Category', type: 'text', tab: 'Production' },
    { key: 'type', label: 'Type', type: 'text', tab: 'Production' },
    { key: 'uom', label: 'UOM', type: 'text', tab: 'Production' },
    { key: 'strain', label: 'Strain', type: 'text', tab: 'Production' },
    { key: 'production_plan', label: 'Production Plan', type: 'number', tab: 'Production' },
    { key: 'distillate_oil_used', label: 'Distillate Oil Used', type: 'number', tab: 'Production' },
    {
      key: 'batch_status',
      label: 'Batch Status',
      type: 'select',
      options: [
        'Formulation Approved', 'Formulation Cancelled', 'Formulation Complete',
        'Formulation Delayed', 'Formulation Pending', 'Formulation Pending Prelim',
        'Formulation Scheduled'
      ],
      tab: 'Production'
    },
    { key: 'reason', label: 'Reason', type: 'textarea', tab: 'Production' },
    { key: 'original_oil_batch', label: 'Original Oil Batch', type: 'textarea', tab: 'Production' },
    { key: 'formulation_batch_no', label: 'Formulation Batch #', type: 'text', tab: 'Production' },
    { key: 'wt', label: 'Wt.', type: 'number', tab: 'Production' },
    { key: 'est_units', label: 'Est. Units', type: 'number', tab: 'Production' },
    { key: 'finished_goods_barcode', label: 'Finished Goods Barcode', type: 'textarea', tab: 'Production' },
    { key: 'document_no', label: 'Document #', type: 'number', tab: 'Staging' },
    {
      key: 'packaging_status',
      label: 'Packaging Status',
      type: 'select',
      options: [
        'Converted', 'In-Process', 'Labels Printed', 'On Hold/Components',
        'Packaged', 'Packaged - pending sampling', 'Printing Needed',
        'Quarantine', 'Sampling completed'
      ],
      tab: 'Packaging'
    },
    { key: 'total_units_package', label: 'Total Units Package', type: 'number', tab: 'Packaging' },
    { key: 'third_party_sample_units', label: '3rd Party Sample Units', type: 'number', tab: 'Packaging' },
    { key: 'packaging_final_units', label: 'Packaging Final Units', type: 'number', tab: 'Packaging' },
    { key: 'packaged_week', label: 'Packaged Week', type: 'number', tab: 'Dates' },
    { key: 'lab', label: 'Lab', type: 'textarea', tab: 'Lab' },
    { key: 'plan_year', label: 'Plan Year', type: 'number', tab: 'Production' },
    { key: 'pack_year', label: 'Pack Year', type: 'number', tab: 'Production' },
    { key: 'week', label: 'Week', type: 'number', tab: 'Production' },
    { key: 'est_hub_landing', label: 'Est. HUB Landing', type: 'date', tab: 'Dates' },
  ];

  const colorRules = {
    packaging_status: {
      'Printing Needed': { color: '#b3e5fc', description: 'Pastel Blue: Indicates packaging status is "Printing Needed"' },
      'Labels Printed': { color: '#ff00ff', description: 'Neon Purple: Indicates packaging status is "Labels Printed"' },
      'Converted': { color: '#ff6600', description: 'Neon Orange: Indicates packaging status is "Converted"' },
      'In-Process': { color: '#e6f0fa', description: 'Pastel Light Blue: Indicates packaging status is "In-Process"' },
      'Sampling completed': { color: '#ccffcc', description: 'Pastel Green: Indicates packaging status is "Sampling completed"; applies to entire row for non-colored cells' },
      'Packaged - pending sampling': { color: '#ffccff', description: 'Pastel Pink: Indicates packaging status is "Packaged - pending sampling"' },
    },
    week: {
      even: { color: '#ff00ff', description: 'Neon Magenta: Applied to Week column for even-numbered weeks' },
      odd: { color: '#00ff00', description: 'Neon Green: Applied to Week column for odd-numbered weeks' },
    },
    week_start_date: {
      'Has Packaged Date': { color: '#e6ccff', description: 'Pastel Purple: Applied to Week Start Date column when Packaged Date is set' },
    },
    staging_status: {
      'Staging Priority': { color: '#ffd1a3', description: 'Pastel Orange: Indicates staging status is "Staging Priority"' },
      'Staging Complete': { color: '#99ff99', description: 'Pastel Green: Indicates staging status is "Staging Complete"' },
      'Staging Needed': { color: '#ff9999', description: 'Pastel Red: Indicates staging status is "Staging Needed"' },
    },
    batch_status: {
      'Formulation Delayed': { color: '#99e6ff', description: 'Pastel Teal: Indicates batch status is "Formulation Delayed"' },
      'Formulation Cancelled': { color: '#ffcccc', description: 'Pastel Red: Indicates batch status is "Formulation Cancelled"; applies to entire row except week column' },
      'Formulation Pending': { color: '#ffffcc', description: 'Pastel Yellow: Indicates batch status is "Formulation Pending"' },
      'Formulation Approved': { color: '#00ffff', description: 'Neon Cyan: Indicates batch status is "Formulation Approved"' },
    },
    row_level: [
      { color: '#ffcccc', description: 'Pastel Red: Entire row except week column when Batch Status is "Formulation Cancelled", overriding all other rules' },
      { color: '#ccffcc', description: 'Pastel Green: Entire row when Packaging Status is "Sampling completed", for cells not explicitly colored' },
    ],
  };

  const toggleColumnVisibility = (colKey) => {
    if (userTier <= 1 || (userTier <= 3 && ['plan_year', 'pack_year'].includes(colKey))) {
      setVisibleColumns((prev) => ({
        ...prev,
        [colKey]: !prev[colKey],
      }));
    }
  };

  const handleToggleColumnMenu = () => {
    if (userTier <= 3) {
      setShowColumnMenu((prev) => !prev);
    }
  };

  const handleRowRightClick = (event, rowId) => {
    if (userTier > 2) return;
    event.preventDefault();
    setRowMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowId,
    });
  };

  const handleAddSpacerAbove = async () => {
    if (userTier > 2) return;
    if (rowMenu.rowId && !spacers.some((spacer) => spacer.rowId === rowMenu.rowId && spacer.position === 'above')) {
      const newSpacer = { rowId: rowMenu.rowId, position: 'above' };
      try {
        const username = localStorage.getItem('username');
        if (!username) {
          throw new Error('No username found in localStorage');
        }
        const { error } = await supabase
          .from('spacers')
          .insert([{ row_id: rowMenu.rowId, position: 'above', username }]);
        if (error) throw error;
        setSpacers((prev) => [...prev, newSpacer]);
      } catch (error) {
        console.error('Error adding spacer above:', error);
        alert('Failed to add spacer above: ' + error.message);
      }
    }
    setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
  };

  const handleAddSpacerBelow = async () => {
    if (userTier > 2) return;
    if (rowMenu.rowId && !spacers.some((spacer) => spacer.rowId === rowMenu.rowId && spacer.position === 'below')) {
      const newSpacer = { rowId: rowMenu.rowId, position: 'below' };
      try {
        const username = localStorage.getItem('username');
        if (!username) {
          throw new Error('No username found in localStorage');
        }
        const { error } = await supabase
          .from('spacers')
          .insert([{ row_id: rowMenu.rowId, position: 'below', username }]);
        if (error) throw error;
        setSpacers((prev) => [...prev, newSpacer]);
      } catch (error) {
        console.error('Error adding spacer below:', error);
        alert('Failed to add spacer below: ' + error.message);
      }
    }
    setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
  };

  const handleRemoveSpacer = async () => {
    if (userTier > 2) return;
    if (rowMenu.rowId) {
      try {
        const { error } = await supabase
          .from('spacers')
          .delete()
          .eq('row_id', rowMenu.rowId);
        if (error) throw error;
        setSpacers((prev) => prev.filter((spacer) => spacer.rowId !== rowMenu.rowId));
      } catch (error) {
        console.error('Error removing spacer:', error);
        alert('Failed to remove spacer');
      }
    }
    setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
  };

  const handleDeleteRow = async () => {
    if (userTier > 1) return;
    if (rowMenu.rowId) {
      try {
        const { data: duplicates, error: fetchDuplicatesError } = await supabase
          .from('duplicated_products')
          .select('id')
          .eq('original_product_id', rowMenu.rowId);
        if (fetchDuplicatesError) throw fetchDuplicatesError;

        if (duplicates && duplicates.length > 0) {
          const { error: deleteDuplicatesError } = await supabase
            .from('duplicated_products')
            .delete()
            .eq('original_product_id', rowMenu.rowId);
          if (deleteDuplicatesError) throw deleteDuplicatesError;
        }

        const { data: duplicateEntry, error: fetchDuplicateEntryError } = await supabase
          .from('duplicated_products')
          .select('id')
          .eq('id', rowMenu.rowId);
        if (fetchDuplicateEntryError) throw fetchDuplicateEntryError;

        if (duplicateEntry && duplicateEntry.length > 0) {
          const { error: deleteDuplicateEntryError } = await supabase
            .from('duplicated_products')
            .delete()
            .eq('id', rowMenu.rowId);
          if (deleteDuplicateEntryError) throw deleteDuplicateEntryError;
        }

        const { error } = await supabase
          .from('fnp_tracker')
          .delete()
          .eq('id', rowMenu.rowId);
        if (error) throw error;

        setTableData((prev) => {
          const newData = prev.filter((row) => String(row.id) !== String(rowMenu.rowId));
          return newData;
        });

        const auditLog = {
          user_email: localStorage.getItem('username'),
          action_type: 'DELETE_ROW',
          details: {
            row_id: rowMenu.rowId,
          },
        };
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert(auditLog);
        if (auditError) {
          console.error('Failed to log delete action to audit_logs:', auditError);
        }
      } catch (error) {
        console.error('Error deleting row:', error);
        alert('Failed to delete row: ' + error.message);
      }
    }
    setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
  };

  const handleDuplicateRow = async () => {
    if (!rowMenu.rowId) return;
    try {
      const rowIndex = tableData.findIndex((r) => String(r.id) === String(rowMenu.rowId));
      if (rowIndex === -1) throw new Error('Row not found');

      const originalRow = tableData[rowIndex];
      const { data: fetchedRow, error: fetchError } = await supabase
        .from('fnp_tracker')
        .select('*')
        .eq('id', rowMenu.rowId)
        .single();
      if (fetchError || !fetchedRow) throw new Error(`Row with ID ${rowMenu.rowId} does not exist`);

      const newRow = {
        ...fetchedRow,
        id: undefined, // Let Supabase generate new ID
        production_plan: null, // Clear production_plan
        is_duplicate: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: localStorage.getItem('username'),
        locked_cells: {}, // Clear locks for duplicate
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('fnp_tracker')
        .insert(newRow)
        .select()
        .single();
      if (insertError) throw new Error(`Failed to duplicate row: ${insertError.message}`);

      const auditLog = {
        user_email: localStorage.getItem('username'),
        action_type: 'DUPLICATE_ROW',
        details: {
          original_row_id: rowMenu.rowId,
          new_row_id: insertedRow.id,
        },
      };
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditLog);
      if (auditError) {
        console.error('Failed to log duplicate action to audit_logs:', auditError);
      }

      // Insert the new row immediately below the original in tableData
      setTableData((prev) => {
        const newData = [...prev];
        newData.splice(rowIndex + 1, 0, {
          ...insertedRow,
          rowNumber: null, // Duplicates have no row number
          is_duplicate: true,
        });
        return newData;
      });
    } catch (error) {
      console.error('Error duplicating row:', error);
      alert(`Failed to duplicate row: ${error.message}`);
    } finally {
      setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
    }
  };

  useEffect(() => {
    const fetchSpacers = async () => {
      try {
        const { data, error } = await supabase
          .from('spacers')
          .select('row_id, position');
        if (error) throw error;
        const formattedSpacers = data.map(item => ({
          rowId: item.row_id,
          position: item.position,
        }));
        setSpacers(formattedSpacers);
      } catch (error) {
        console.error('Error fetching spacers:', error);
        alert('Failed to load spacers');
      }
    };

    fetchSpacers();
  }, []);

  const predefinedColors = [
    '#ffcccc', '#ccffcc', '#ccccff', '#ffffcc', '#ffccff', '#e6f0fa', '#ff6600', '#ff00ff',
    '#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff', '#99e6ff', '#ffcc99', '#cc99ff',
    '#ff6666', '#66ff66', '#6666ff', '#ffff66', '#ff66ff', '#66ccff', '#ff9966', '#9966ff',
    '#00ffff', '#f0f0f0', '#d3d3d3', '#a9a9a9',
  ];

  const handleMouseDown = (rowId, colKey, event) => {
    if (userTier > 1 || editingCell) return;
    event.preventDefault();
    if (!rowId || !colKey) return;
    if (!event.shiftKey) {
      setSelectedCells(new Set());
    }
    setIsSelecting(true);
    setStartCell({ rowId, colKey });
    const newSelected = new Set(selectedCells);
    newSelected.add(`${rowId}:${colKey}`);
    setSelectedCells(newSelected);
  };

  const handleMouseOver = (rowId, colKey) => {
    if (userTier > 1 || editingCell) return;
    if (!isSelecting || !startCell || !rowId || !colKey) return;

    const newSelected = new Set();
    const startRowIndex = tableData.findIndex((row) => String(row.id) === String(startCell.rowId));
    const endRowIndex = tableData.findIndex((row) => String(row.id) === String(rowId));
    const startColIndex = columns.findIndex((col) => col.key === startCell.colKey);
    const endColIndex = columns.findIndex((col) => col.key === colKey);

    const rowStart = Math.min(startRowIndex, endRowIndex);
    const rowEnd = Math.max(startRowIndex, endRowIndex);
    const colStart = Math.min(startColIndex, endColIndex);
    const colEnd = Math.max(startColIndex, endColIndex);

    for (let i = rowStart; i <= rowEnd; i++) {
      for (let j = colStart; j <= colEnd; j++) {
        const currentRowId = tableData[i]?.id;
        const currentColKey = columns[j]?.key;
        if (!currentRowId || !currentColKey) continue;
        if (!columns[j].canToggle || visibleColumns[currentColKey]) {
          newSelected.add(`${currentRowId}:${currentColKey}`);
        }
      }
    }

    setSelectedCells(newSelected);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartCell(null);
  };

  const handleRightClick = (event) => {
    if (userTier > 1 || editingCell) return;
    event.preventDefault();
    if (selectedCells.size === 0) return;
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleColorSelect = async (color) => {
    if (userTier > 1) return;
    if (!color || selectedCells.size === 0) {
      setContextMenu({ visible: false, x: 0, y: 0 });
      return;
    }

    const cellsToUpdate = Array.from(selectedCells)
      .map((cell) => {
        const [rowId, colKey] = cell.split(':');
        if (!rowId || !colKey) return null;
        return { rowId, colKey, color };
      })
      .filter(Boolean);

    try {
      await onColorChange(cellsToUpdate);
      setSelectedCells(new Set());
    } catch (error) {
      alert(`Failed to apply color: ${error.message}`);
    } finally {
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };

  const handleZoomChange = (event) => {
    const newZoom = parseFloat(event.target.value);
    setZoomLevel(newZoom);
  };

  const handleToggleColorRulesPopup = () => {
    setShowColorRulesPopup((prev) => !prev);
  };

  const handleCellDoubleClick = (rowId, colKey, value) => {
    if (userTier > 1 || editingCell) return;

    const row = tableData.find((r) => String(r.id) === String(rowId));
    if (!row) return;

    const field = fields.find((f) => f.key === colKey);
    if (!field) return;

    let lockedCells = row.locked_cells || {};
    if (typeof lockedCells === 'string') {
      try {
        lockedCells = JSON.parse(lockedCells);
      } catch (e) {
        lockedCells = {};
      }
    }

    const cellKey = `${rowId}:${colKey}`;
    const isLocked = lockedCells[cellKey]?.locked && !graceTimers[cellKey];
    const isEditable = colKey !== 'est_units' && (row.is_duplicate === true || !isLocked);

    if (!isEditable) {
      alert(colKey === 'est_units' ? 'Estimated Units are auto-calculated and cannot be edited.' : 'This cell is locked and cannot be edited.');
      return;
    }

    const cellElement = tableRef.current.querySelector(`td[data-row-id="${rowId}"][data-col-key="${colKey}"]`);
    if (!cellElement) return;

    const cellRect = cellElement.getBoundingClientRect();
    const column = columns.find((c) => c.key === colKey);
    const columnWidth = column ? column.width * zoomLevel : 150;

    setEditingCell({
      rowId,
      colKey,
      value,
      field,
      cellRect,
      columnWidth,
    });
  };

  const handleCellEditSave = (rowId, colKey, value) => {
    const scrollPosition = {
      scrollTop: tableScrollRef.current ? tableScrollRef.current.scrollTop : 0,
      scrollLeft: tableScrollRef.current ? tableScrollRef.current.scrollLeft : 0,
    };
    const cellElement = tableRef.current.querySelector(`td[data-row-id="${rowId}"][data-col-key="${colKey}"]`);
    const cellRect = cellElement ? cellElement.getBoundingClientRect() : { top: 0, left: 0, height: 0 };
    onCellEdit(rowId, colKey, value, scrollPosition, cellRect);
    setEditingCell(null);
  };

  const handleCellEditCancel = () => {
    setEditingCell(null);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editingCell && !event.target.closest('.edit-overlay')) {
        setEditingCell(null);
      }

      if (event.button === 0) {
        const target = event.target;
        const isClickInsideTable = tableRef.current && tableRef.current.contains(target);
        const isClickOnSelectedCell = target.closest('td') && selectedCells.has(`${target.closest('td').dataset.rowId}:${target.closest('td').dataset.colKey}`);
        const isClickInsideColumnMenu = columnMenuRef.current && columnMenuRef.current.contains(target);
        const isClickInsideRowMenu = rowMenuRef.current && rowMenuRef.current.contains(target);

        if (!isClickInsideTable || !isClickOnSelectedCell) {
          setContextMenu({ visible: false, x: 0, y: 0 });
          setSelectedCells(new Set());
        }
        if (!isClickInsideColumnMenu && showColumnMenu) {
          setShowColumnMenu(false);
        }
        if (!isClickInsideRowMenu && rowMenu.visible) {
          setRowMenu({ visible: false, x: 0, y: 0, rowId: null });
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCells, showColumnMenu, rowMenu, editingCell]);

  useEffect(() => {
    const syncColumnWidths = () => {
      if (!tableRef.current) return;

      const headerCells = tableRef.current.querySelectorAll('thead th');
      const bodyCells = tableRef.current.querySelector('tbody tr:first-child td');

      if (!headerCells.length || !bodyCells) return;

      const baseFontSize = 14;
      const basePaddingX = 8;
      const basePaddingY = 12;
      const baseHeight = 40;
      const baseRowNumWidth = 40;
      const borderWidth = 1;

      const fontSize = baseFontSize * zoomLevel;
      const paddingX = basePaddingX * zoomLevel;
      const paddingY = basePaddingY * zoomLevel;
      const height = baseHeight * zoomLevel;
      const rowNumWidth = baseRowNumWidth * zoomLevel;

      let totalWidthPx = rowNumWidth;
      const visibleCols = columns.filter(col => !col.canToggle || visibleColumns[col.key]);
      const numBorders = visibleCols.length + 1;
      const widthsPx = [];

      columns.forEach((col) => {
        if (!col.canToggle || visibleColumns[col.key]) {
          const scaledWidthPx = (col.width || 150) * zoomLevel;
          totalWidthPx += scaledWidthPx;
          widthsPx.push(scaledWidthPx);
        }
      });

      totalWidthPx += numBorders * borderWidth;

      tableRef.current.style.minWidth = `${totalWidthPx}px`;
      tableRef.current.style.fontSize = `${fontSize}px`;

      let headerIndex = 0;
      columns.forEach((col) => {
        if (!col.canToggle || visibleColumns[col.key]) {
          const headerCell = headerCells[headerIndex + 1];
          const bodyCell = bodyCells[headerIndex + 1];
          if (headerCell && bodyCell) {
            const widthPx = widthsPx[headerIndex];
            headerCell.style.width = `${widthPx}px`;
            headerCell.style.minWidth = `${widthPx}px`;
            headerCell.style.padding = `${paddingY}px ${paddingX}px`;
            headerCell.style.height = `${height}px`;
            bodyCell.style.width = `${widthPx}px`;
            bodyCell.style.minWidth = `${widthPx}px`;
            bodyCell.style.padding = `${paddingY}px ${paddingX}px`;
            bodyCell.style.height = `${height}px`;
          }
          headerIndex++;
        }
      });

      const headerRowNum = headerCells[0];
      const bodyRowNumCells = tableRef.current.querySelectorAll('td.row-number-column');
      if (headerRowNum) {
        headerRowNum.style.width = `${rowNumWidth}px`;
        headerRowNum.style.minWidth = `${rowNumWidth}px`;
        headerRowNum.style.padding = `${paddingY}px ${paddingX}px`;
        headerRowNum.style.height = `${height}px`;
      }
      bodyRowNumCells.forEach(cell => {
        cell.style.width = `${rowNumWidth}px`;
        cell.style.minWidth = `${rowNumWidth}px`;
        cell.style.padding = `${paddingY}px ${paddingX}px`;
        cell.style.height = `${height}px`;
      });
    };

    const debounce = (func, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      };
    };

    const debouncedSyncColumnWidths = debounce(syncColumnWidths, 100);

    if (tableData.length > 0) {
      debouncedSyncColumnWidths();
      window.addEventListener('resize', debouncedSyncColumnWidths);
      return () => window.removeEventListener('resize', debouncedSyncColumnWidths);
    }
  }, [visibleColumns, zoomLevel, tableData]);

  const getRowStatusClass = (batchStatus) => {
    if (!batchStatus) return '';
    switch (batchStatus.toLowerCase()) {
      case 'formulation cancelled':
        return 'status-cancelled';
      case 'formulation approved':
      case 'formulation complete':
        return 'status-approved';
      case 'formulation pending':
      case 'formulation pending prelim':
        return 'status-pending';
      default:
        return '';
    }
  };

  const getCellBackgroundColor = (row, colKey) => {
    let validColors = row.colors || {};
    if (typeof validColors === 'string') {
      try {
        validColors = JSON.parse(validColors);
      } catch (e) {
        validColors = {};
      }
    }

    // Apply row-level rules first
    if (row.batch_status === 'Formulation Cancelled' && colKey !== 'week') {
      return colorRules.batch_status['Formulation Cancelled'].color;
    }

    // Check for explicitly set colors (e.g., from manual color changes)
    if (validColors[colKey]) {
      return validColors[colKey];
    }

    // Apply column-specific rules
    const isSamplingCompleted = row.packaging_status === 'Sampling completed';
    const specialColumns = ['week', 'staging_status', 'packaging_status', 'batch_status'];
    if (isSamplingCompleted && !specialColumns.includes(colKey)) {
      return colorRules.packaging_status['Sampling completed'].color;
    }

    if (colKey === 'packaging_status' && row.packaging_status) {
      return colorRules.packaging_status[row.packaging_status]?.color || 'transparent';
    }
    if (colKey === 'week' && row.week) {
      const weekNumber = parseInt(row.week, 10);
      return isNaN(weekNumber) ? 'transparent' : (weekNumber % 2 === 0 ? colorRules.week.even.color : colorRules.week.odd.color);
    }
    if (colKey === 'week_start_date' && row.packaged_date) {
      return colorRules.week_start_date['Has Packaged Date'].color;
    }
    if (colKey === 'staging_status' && row.staging_status) {
      return colorRules.staging_status[row.staging_status]?.color || 'transparent';
    }
    if (colKey === 'batch_status' && row.batch_status) {
      return colorRules.batch_status[row.batch_status]?.color || 'transparent';
    }

    return 'transparent';
  };

  const renderCellContent = (row, colKey) => {
    const cellKey = `${row.id}:${colKey}`;
    let lockedCells = row.locked_cells || {};
    if (typeof lockedCells === 'string') {
      try {
        lockedCells = JSON.parse(lockedCells);
      } catch (e) {
        lockedCells = {};
      }
    }

    const isLocked = lockedCells[cellKey]?.locked || false;
    const countdown = graceTimers[cellKey] || 0;
    const tooltipContent = countdown > 0 ? `Editable for ${formatCountdown(countdown)}` : 'Locked';

    return (
      <div className="cell-content">
        <span>{row[colKey] || ''}</span>
        {countdown > 0 && (
          <span className="countdown-badge">{formatCountdown(countdown)}</span>
        )}
        {isLocked && (
          <div className="locked-tooltip">
            <span>{tooltipContent}</span>
          </div>
        )}
      </div>
    );
  };

  const formatCountdown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="table-container" onMouseUp={handleMouseUp}>
      <div className="table-controls">
        <div className="zoom-control">
          <label htmlFor="zoom-select">Zoom: </label>
          <select
            id="zoom-select"
            value={zoomLevel}
            onChange={handleZoomChange}
            className="zoom-select"
          >
            {zoomPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div className="column-toggle">
          <button
            className="manage-columns-btn"
            onClick={handleToggleColumnMenu}
            disabled={userTier > 3}
          >
            Manage Columns
          </button>
          {showColumnMenu && (
            <div className="column-menu" ref={columnMenuRef}>
              {columns
                .filter((col) => col.canToggle && (userTier <= 1 || (userTier <= 3 && ['plan_year', 'pack_year'].includes(col.key))))
                .map((col) => (
                  <div key={col.key} className="column-menu-item">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key] || false}
                      onChange={() => toggleColumnVisibility(col.key)}
                    />
                    <span>{col.label}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
        <div className="color-rules-toggle">
          <button
            className="color-rules-btn"
            onClick={handleToggleColorRulesPopup}
          >
            Color Rules
          </button>
        </div>
      </div>

      {tableData.length === 0 ? (
        <div className="no-data-message">
          No data available. Upload a file or check your filters.
        </div>
      ) : (
        <>
          <div className="table-scroll-wrapper" ref={tableScrollRef}>
            <table onContextMenu={handleRightClick} ref={tableRef} className="data-table">
              <thead>
                <tr>
                  <th className="row-number-column" style={{ width: '40px', minWidth: '40px' }}>#</th>
                  {columns.map((col) => {
                    const shouldRender = !col.canToggle || visibleColumns[col.key];
                    return shouldRender ? (
                      <th key={col.key} title={col.tooltip}>
                        <div className="header-content">
                          {col.label}
                          {col.canToggle && (userTier <= 1 || (userTier <= 3 && ['plan_year', 'pack_year'].includes(col.key))) && (
                            <button
                              className="toggle-column-btn"
                              onClick={() => toggleColumnVisibility(col.key)}
                            >
                              {visibleColumns[col.key] ? '−' : '+'}
                            </button>
                          )}
                        </div>
                      </th>
                    ) : null;
                  })}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => {
                  if (!row || !row.id) return null;
                  const isDuplicate = row.is_duplicate === true;
                  const statusClass = getRowStatusClass(row.batch_status);
                  const rowClassName = `${isDuplicate ? 'duplicate-row' : ''} ${statusClass}`.trim();
                  const rowElements = [];

                  if (spacers.some((spacer) => spacer.rowId === row.id && spacer.position === 'above')) {
                    rowElements.push(
                      <tr key={`spacer-above-${row.id}`} className="spacer-row">
                        <td className="spacer-label" colSpan={columns.filter(col => !col.canToggle || visibleColumns[col.key]).length + 1}>
                          Week Break
                        </td>
                      </tr>
                    );
                  }

                  rowElements.push(
                    <tr
                      id={`row-${row.id}`}
                      key={row.id}
                      className={rowClassName}
                    >
                      <td
                        className="row-number-column"
                        style={{ width: '40px', minWidth: '40px' }}
                        onContextMenu={(e) => handleRowRightClick(e, row.id)}
                      >
                        {isDuplicate && <span className="hazard-symbol">⚠️</span>}
                        {isDuplicate ? '' : row.rowNumber || ''}
                      </td>
                      {columns.map((col) => {
                        if (!col.canToggle || visibleColumns[col.key]) {
                          const cellKey = `${row.id}:${col.key}`;
                          const isLocked = row.locked_cells?.[cellKey]?.locked && !graceTimers[cellKey];
                          return (
                            <td
                              key={cellKey}
                              data-row-id={row.id}
                              data-col-key={col.key}
                              className={`${isLocked ? 'locked-cell' : ''} ${col.key === 'est_units' ? 'read-only-cell' : ''}`}
                              style={{
                                backgroundColor: selectedCells.has(cellKey)
                                  ? '#add8e6'
                                  : getCellBackgroundColor(row, col.key),
                                opacity: col.key === 'est_units' ? 0.7 : 1,
                              }}
                              onMouseDown={(e) => handleMouseDown(row.id, col.key, e)}
                              onMouseOver={() => handleMouseOver(row.id, col.key)}
                              onDoubleClick={() => handleCellDoubleClick(row.id, col.key, row[col.key])}
                              aria-label={isLocked ? 'Locked cell' : col.key === 'est_units' ? 'Auto-calculated field' : undefined}
                              title={col.key === 'est_units' ? 'Auto-calculated field' : undefined}
                            >
                              {renderCellContent(row, col.key)}
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );

                  if (spacers.some((spacer) => spacer.rowId === row.id && spacer.position === 'below')) {
                    rowElements.push(
                      <tr key={`spacer-below-${row.id}`} className="spacer-row">
                        <td className="spacer-label" colSpan={columns.filter(col => !col.canToggle || visibleColumns[col.key]).length + 1}>
                          Week Break
                        </td>
                      </tr>
                    );
                  }

                  return rowElements;
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination-wrapper">
            {renderPagination()}
          </div>
        </>
      )}
      {contextMenu.visible && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="context-menu-title">Apply Color</div>
          <div className="color-options">
            {predefinedColors.map((color) => (
              <div
                key={color}
                className="color-swatch"
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
        </div>
      )}
      {rowMenu.visible && (
        <div
          className="row-menu"
          style={{ top: rowMenu.y, left: rowMenu.x }}
          ref={rowMenuRef}
        >
          {userTier <= 2 && (
            <>
              {userTier <= 1 && (
                <div className="row-menu-item" onClick={handleDeleteRow}>Delete Row</div>
              )}
              <div className="row-menu-item" onClick={handleDuplicateRow}>Duplicate Row</div>
              <div className="row-menu-item" onClick={handleAddSpacerAbove}>Add Spacer Above</div>
              <div className="row-menu-item" onClick={handleAddSpacerBelow}>Add Spacer Below</div>
              {(spacers.some((spacer) => spacer.rowId === rowMenu.rowId && spacer.position === 'above') ||
                spacers.some((spacer) => spacer.rowId === rowMenu.rowId && spacer.position === 'below')) && (
                <div className="row-menu-item" onClick={handleRemoveSpacer}>Remove Spacer</div>
              )}
            </>
          )}
        </div>
      )}
      {showColorRulesPopup && (
        <div className="color-rules-popup">
          <ColorRulesPopup
            colorRules={colorRules}
            onClose={() => setShowColorRulesPopup(false)}
          />
        </div>
      )}
      {editingCell && (
        <EditOverlay
          rowId={editingCell.rowId}
          colKey={editingCell.colKey}
          value={editingCell.value}
          field={editingCell.field}
          onSave={handleCellEditSave}
          onCancel={handleCellEditCancel}
          cellRect={editingCell.cellRect}
          columnWidth={editingCell.columnWidth}
        />
      )}
    </div>
  );
});

export default DataTable;