export default function DataExport({ data, showToast }) {
  const exportToCSV = () => {
    if (!data || data.length === 0) {
      if (showToast) showToast('No data to export', 'warning');
      return;
    }

    // Extract keys from first row
    const keys = Object.keys(data[0]);
    const csvRows = [];
    
    // Header
    csvRows.push(keys.join(','));
    
    // Data rows
    data.forEach(row => {
      const values = keys.map(key => {
        const value = row[key];
        // Handle nested objects and arrays
        if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `market_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    if (showToast) showToast(`Exported ${data.length} rows to CSV`, 'success');
  };

  const exportToJSON = () => {
    if (!data || data.length === 0) {
      if (showToast) showToast('No data to export', 'warning');
      return;
    }

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `market_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);

    if (showToast) showToast(`Exported ${data.length} rows to JSON`, 'success');
  };

  const buttonStyle = {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#334155',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '8px',
      backgroundColor: '#1e293b',
      borderRadius: '8px',
      border: '1px solid #334155'
    }}>
      <button
        onClick={exportToCSV}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.backgroundColor = '#475569'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#334155'}
        title="Export data as CSV"
      >
        📊 CSV
      </button>
      <button
        onClick={exportToJSON}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.backgroundColor = '#475569'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#334155'}
        title="Export data as JSON"
      >
        📝 JSON
      </button>
      <span style={{
        padding: '8px',
        fontSize: '11px',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center'
      }}>
        {data?.length || 0} snapshots
      </span>
    </div>
  );
}
