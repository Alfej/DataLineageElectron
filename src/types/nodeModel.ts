/**
 * Node Model - Hierarchical tree structure organized by levels and values
 * Structure: HierarchyLevel -> Value -> Node Details
 *
 * Updated: Child references now store per-child relationships to maintain
 * exact node-to-node InternalRelationship arrays.
 */

export type HierarchyLevel = 
  | "Sector"
  | "Application"
  | "Purpose"
  | "Client"
  | "Tool"
  | "System"
  | "Schema"
  | "ObjectName";

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Child references grouped by hierarchy level
 * Maps hierarchy level to array of child values at that level
 */
export type ChildLevelMap = Record<string, string[]>; // { [childNodeValue]: InternalRelationship[] }

export interface ChildReferences {
  Sector?: ChildLevelMap;
  Application?: ChildLevelMap;
  Purpose?: ChildLevelMap;
  Client?: ChildLevelMap;
  Tool?: ChildLevelMap;
  System?: ChildLevelMap;
  Schema?: ChildLevelMap;
  ObjectName?: ChildLevelMap;
}

/**
 * Node details for a specific value at a hierarchy level
 */
export interface NodeDetails {
  // Child nodes organized by hierarchy level, each with per-child relationships
  Childs: ChildReferences;
  Position: NodePosition;
  FilteredOut: boolean;
  Hidden: boolean;
}

/**
 * Map of values to their node details at a specific hierarchy level
 * Example: { "Finance": NodeDetails, "Sales": NodeDetails }
 */
export interface HierarchyValueMap {
  [value: string]: NodeDetails;
}

/**
 * Complete hierarchical data structure
 * Organized as: HierarchyLevel -> Value -> NodeDetails
 */
export interface HierarchicalDataStructure {
  Sector: HierarchyValueMap;
  Application: HierarchyValueMap;
  Purpose: HierarchyValueMap;
  Client: HierarchyValueMap;
  Tool: HierarchyValueMap;
  System: HierarchyValueMap;
  Schema: HierarchyValueMap;
  ObjectName: HierarchyValueMap;
}

/**
 * CSV Row structure matching the input data
 */
export interface CSVRow {
  ParentSector: string;
  ParentApplication: string;
  ParentPurpose: string;
  ParentClient: string;
  ParentTool: string;
  ParentSystem: string;
  ParentSystemID: string;
  ParentSchema: string;
  ParentObjectName: string;
  InternalRelationship: string;
  ChildSector: string;
  ChildApplication: string;
  ChildPurpose: string;
  ChildClient: string;
  ChildTool: string;
  ChildSystem: string;
  ChildSystemID: string;
  ChildSchema: string;
  ChildObjectName: string;
}
