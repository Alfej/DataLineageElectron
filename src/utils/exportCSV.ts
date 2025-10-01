import Papa from "papaparse";

/**
 * Export data to CSV file and trigger download
 * @param data - Array of objects to export
 * @param filename - Name of the CSV file (without extension)
 */
export const exportToCSV = (data: any[], filename: string = 'export'): void => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    // Convert data to CSV using Papa Parse
    const csv = Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });

    // Create blob and download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      // Create download URL
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Failed to export CSV:', error);
  }
};

/**
 * Get filtered and visible table data for export
 * @param filteredData - Already filtered data based on column filters and neighborhood
 * @param hiddenNodes - Set of hidden node IDs
 * @returns Array of visible rows ready for CSV export
 */
export const getVisibleTableData = (filteredData: any[], hiddenNodes: Set<string>): any[] => {
  return filteredData.filter(row => 
    !hiddenNodes.has(row.parentTableName) && !hiddenNodes.has(row.childTableName)
  );
};