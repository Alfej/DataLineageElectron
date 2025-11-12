/**
 * Hierarchical Adapter - Converts hierarchical structure to legacy TableRelation format
 * Provides backward compatibility with existing Graph component
 */

import { HierarchicalDataStructure, HierarchyLevel } from '../types/nodeModel';
import { CSVRow } from './hierarchicalParser';

export interface TableRelation {
  parentSector: string;
  parentApplication: string;
  parentPurpose: string;
  parentClient: string;
  parentTool: string;
  parentSystem: string;
  parentSchema: string;
  parentObjectName: string;
  
  childSector: string;
  childApplication: string;
  childPurpose: string;
  childClient: string;
  childTool: string;
  childSystem: string;
  childSchema: string;
  childObjectName: string;
  
  internalRelationship: string;
}

/**
 * Convert hierarchical structure back to flat TableRelation array
 * This allows existing Graph component to work without changes
 */
export function convertToTableRelations(
  _structure: HierarchicalDataStructure,
  rawCSV: CSVRow[]
): TableRelation[] {
  // For now, we'll use the raw CSV as the source of truth for relationships
  // The hierarchical structure stores aggregated data, but the CSV maintains the exact relationships
  return rawCSV.map(row => ({
    parentSector: row.ParentSector || '',
    parentApplication: row.ParentApplication || '',
    parentPurpose: row.ParentPurpose || '',
    parentClient: row.ParentClient || '',
    parentTool: row.ParentTool || '',
    parentSystem: row.ParentSystem || '',
    parentSchema: row.ParentSchema || '',
    parentObjectName: row.ParentObjectName || '',
    
    childSector: row.ChildSector || '',
    childApplication: row.ChildApplication || '',
    childPurpose: row.ChildPurpose || '',
    childClient: row.ChildClient || '',
    childTool: row.ChildTool || '',
    childSystem: row.ChildSystem || '',
    childSchema: row.ChildSchema || '',
    childObjectName: row.ChildObjectName || '',
    
    internalRelationship: row.InternalRelationship || ''
  }));
}

/**
 * Filter table relations based on hierarchy selection
 */
export function filterTableRelations(
  relations: TableRelation[],
  fromLevel?: HierarchyLevel,
  fromValues?: string[],
  toLevel?: HierarchyLevel,
  toValues?: string[]
): TableRelation[] {
  return relations.filter(relation => {
    // Check "from" (parent) filter
    if (fromLevel && fromValues && fromValues.length > 0) {
      const parentValue = getValueFromRelation(relation, fromLevel, 'parent');
      if (!fromValues.includes(parentValue)) {
        return false;
      }
    }
    
    // Check "to" (child) filter
    if (toLevel && toValues && toValues.length > 0) {
      const childValue = getValueFromRelation(relation, toLevel, 'child');
      if (!toValues.includes(childValue)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get value from relation based on hierarchy level and side
 */
function getValueFromRelation(
  relation: TableRelation,
  level: HierarchyLevel,
  side: 'parent' | 'child'
): string {
  const prefix = side === 'parent' ? 'parent' : 'child';
  const key = `${prefix}${level}` as keyof TableRelation;
  return relation[key] || '';
}

/**
 * Get all unique values at a hierarchy level from relations
 */
export function getUniqueValuesFromRelations(
  relations: TableRelation[],
  level: HierarchyLevel,
  side: 'parent' | 'child' | 'both' = 'both'
): string[] {
  const values = new Set<string>();
  
  relations.forEach(relation => {
    if (side === 'parent' || side === 'both') {
      const parentValue = getValueFromRelation(relation, level, 'parent');
      if (parentValue) values.add(parentValue);
    }
    
    if (side === 'child' || side === 'both') {
      const childValue = getValueFromRelation(relation, level, 'child');
      if (childValue) values.add(childValue);
    }
  });
  
  return Array.from(values).sort();
}

/**
 * Apply hidden and filtered states from hierarchical structure to relations
 */
export function applyNodeStates(
  relations: TableRelation[],
  structure: HierarchicalDataStructure
): TableRelation[] {
  return relations.filter(relation => {
    // Check if any node in this relation is hidden or filtered out
    const levels: HierarchyLevel[] = [
      'Sector', 'Application', 'Purpose', 'Client',
      'Tool', 'System', 'Schema', 'ObjectName'
    ];
    
    for (const level of levels) {
      // Check parent side
      const parentValue = getValueFromRelation(relation, level, 'parent');
      if (parentValue && structure[level][parentValue]) {
        const node = structure[level][parentValue];
        if (node.Hidden || node.FilteredOut) {
          return false;
        }
      }
      
      // Check child side
      const childValue = getValueFromRelation(relation, level, 'child');
      if (childValue && structure[level][childValue]) {
        const node = structure[level][childValue];
        if (node.Hidden || node.FilteredOut) {
          return false;
        }
      }
    }
    
    return true;
  });
}

/**
 * Get statistics about the relations
 */
export function getRelationStats(relations: TableRelation[]): {
  totalRelations: number;
  uniqueInternalRelationships: number;
  relationshipBreakdown: Record<string, number>;
} {
  const uniqueRelationships = new Set<string>();
  const breakdown: Record<string, number> = {};
  
  relations.forEach(relation => {
    if (relation.internalRelationship) {
      uniqueRelationships.add(relation.internalRelationship);
      breakdown[relation.internalRelationship] = (breakdown[relation.internalRelationship] || 0) + 1;
    }
  });
  
  return {
    totalRelations: relations.length,
    uniqueInternalRelationships: uniqueRelationships.size,
    relationshipBreakdown: breakdown
  };
}
