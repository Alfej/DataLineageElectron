/**
 * Hierarchical Storage - Manages localStorage persistence for hierarchical data structure
 */

import { HierarchicalDataStructure } from '../types/nodeModel';
import { CSVRow } from './hierarchicalParser';

const STORAGE_VERSION = '3.2'; // Updated: Childs[level] is map { [childValue]: string[] }
const FILE_INDEX_KEY = 'hierarchical_file_index';

export interface StoredHierarchicalData {
  version: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  lastModified: number;
  rowCount: number;
  structure: HierarchicalDataStructure;
  rawCSV: CSVRow[];
}

export interface FileMetadata {
  key: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  rowCount: number;
}

/**
 * Generate unique storage key for a file
 */
export function generateFileKey(fileName: string, fileSize: number, lastModified: number): string {
  return `hierarchical_data::${fileName}::${fileSize}::${lastModified}`;
}

/**
 * Save hierarchical structure to localStorage
 */
export function saveHierarchicalData(
  fileName: string,
  fileSize: number,
  lastModified: number,
  structure: HierarchicalDataStructure,
  rawCSV: CSVRow[]
): string {
  const key = generateFileKey(fileName, fileSize, lastModified);
  
  const data: StoredHierarchicalData = {
    version: STORAGE_VERSION,
    fileName,
    fileSize,
    uploadedAt: new Date().toISOString(),
    lastModified,
    rowCount: rawCSV.length,
    structure,
    rawCSV
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(data));
    updateFileIndex(key, fileName, fileSize, data.uploadedAt, rawCSV.length);
    console.log(`✅ Saved hierarchical data: ${key}`);
    return key;
  } catch (error) {
    console.error('Failed to save hierarchical data:', error);
    throw new Error('Failed to save data to localStorage. Storage may be full.');
  }
}

/**
 * Load hierarchical structure from localStorage
 */
export function loadHierarchicalData(fileKey: string): StoredHierarchicalData | null {
  try {
    const stored = localStorage.getItem(fileKey);
    if (!stored) {
      console.warn(`No data found for key: ${fileKey}`);
      return null;
    }
    
    const data: StoredHierarchicalData = JSON.parse(stored);
    
    // Version check
    if (data.version !== STORAGE_VERSION) {
      console.warn(`Version mismatch. Expected ${STORAGE_VERSION}, got ${data.version}`);
      // Could implement migration logic here
    }
    
    return data;
  } catch (error) {
    console.error('Failed to load hierarchical data:', error);
    return null;
  }
}

/**
 * Update the file index with metadata
 */
function updateFileIndex(
  key: string,
  fileName: string,
  fileSize: number,
  uploadedAt: string,
  rowCount: number
): void {
  try {
    const index = getFileIndex();
    
    // Remove existing entry for this file if it exists
    const filtered = index.filter(item => item.key !== key);
    
    // Add new entry
    filtered.push({ key, fileName, fileSize, uploadedAt, rowCount });
    
    localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to update file index:', error);
  }
}

/**
 * Get list of all stored files
 */
export function getStoredFiles(): FileMetadata[] {
  return getFileIndex();
}

/**
 * Get file index from localStorage
 */
function getFileIndex(): FileMetadata[] {
  try {
    const stored = localStorage.getItem(FILE_INDEX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to read file index:', error);
    return [];
  }
}

/**
 * Delete a file from storage
 */
export function deleteHierarchicalData(fileKey: string): boolean {
  try {
    localStorage.removeItem(fileKey);
    
    // Update index
    const index = getFileIndex();
    const filtered = index.filter(item => item.key !== fileKey);
    localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(filtered));
    
    console.log(`🗑️ Deleted: ${fileKey}`);
    return true;
  } catch (error) {
    console.error('Failed to delete hierarchical data:', error);
    return false;
  }
}

/**
 * Update specific node details in storage
 */
export function updateNodeInStorage(
  fileKey: string,
  level: string,
  value: string,
  updates: { Position?: { x: number; y: number }; Hidden?: boolean; FilteredOut?: boolean }
): boolean {
  try {
    const data = loadHierarchicalData(fileKey);
    if (!data) return false;
    
    const levelKey = level as keyof HierarchicalDataStructure;
    if (data.structure[levelKey] && data.structure[levelKey][value]) {
      data.structure[levelKey][value] = {
        ...data.structure[levelKey][value],
        ...updates
      };
      
      localStorage.setItem(fileKey, JSON.stringify(data));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to update node in storage:', error);
    return false;
  }
}

/**
 * Clear all hierarchical data from storage
 */
export function clearAllHierarchicalData(): void {
  try {
    const index = getFileIndex();
    index.forEach(item => {
      localStorage.removeItem(item.key);
    });
    localStorage.removeItem(FILE_INDEX_KEY);
    console.log('🧹 Cleared all hierarchical data');
  } catch (error) {
    console.error('Failed to clear hierarchical data:', error);
  }
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): {
  fileCount: number;
  totalRows: number;
  estimatedSizeKB: number;
} {
  const index = getFileIndex();
  const totalRows = index.reduce((sum, item) => sum + item.rowCount, 0);
  
  // Estimate storage size
  let estimatedSize = 0;
  index.forEach(item => {
    const data = localStorage.getItem(item.key);
    if (data) {
      estimatedSize += data.length;
    }
  });
  
  return {
    fileCount: index.length,
    totalRows,
    estimatedSizeKB: Math.round(estimatedSize / 1024)
  };
}
