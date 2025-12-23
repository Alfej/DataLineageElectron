import { TableRelation } from "../components/graph/graphModel";

export type HierarchyLevel =
  | "Sector"
  | "Application"
  | "Purpose"
  | "Client"
  | "Tool"
  | "System"
  | "Schema"
  | "ObjectName";

export interface HierarchyFromToConfig {
  selectedLevels: HierarchyLevel[];
  selectedValues: string[];
}

const parentFieldMap: Record<HierarchyLevel, string> = {
  Sector: "ParentSector",
  Application: "ParentApplication",
  Purpose: "ParentPurpose",
  Client: "ParentClient",
  Tool: "ParentTool",
  System: "ParentSystemID", // system identified by SystemID per requirement
  Schema: "ParentSchema",
  ObjectName: "ParentObjectName",
};

const childFieldMap: Record<HierarchyLevel, string> = {
  Sector: "ChildSector",
  Application: "ChildApplication",
  Purpose: "ChildPurpose",
  Client: "ChildClient",
  Tool: "ChildTool",
  System: "ChildSystemID",
  Schema: "ChildSchema",
  ObjectName: "ChildObjectName",
};

/**
 * Transform raw CSV rows (new schema) into TableRelation[] for the graph,
 * based on a chosen hierarchy level. Keeps original columns for filtering.
 * @deprecated Use transformRelationsFromTo instead for the new from/to hierarchy system
 */
export function transformRelations(
  rawRows: Record<string, unknown>[],
  level: HierarchyLevel
): TableRelation[] {
  const pField = parentFieldMap[level];
  const cField = childFieldMap[level];

  return (rawRows || [])
    .map((row) => {
      const parentName = safeString(row?.[pField]);
      const childName = safeString(row?.[cField]);
      const relationship = safeString(row?.InternalRelationship);

      if (!parentName || !childName) return null; // skip incomplete rows

      const base: TableRelation = {
        parentTableName: parentName,
        childTableName: childName,
        parentTableType: level, // use level as the type for coloring/legend
        childTableType: level,
        relationship,
        ClientID: safeString(row?.ParentClient) || "",
        AppID: safeString(row?.ParentApplication) || "",
      } as TableRelation;

      // Merge original row fields for dynamic filtering elsewhere
      return {
        ...row,
        ...base,
      } as TableRelation;
    })
    .filter(Boolean) as TableRelation[];
}

/**
 * Transform raw CSV rows into TableRelation[] for the graph using hierarchy configuration.
 * Supports filtering by multiple selected levels and their values.
 */
export function transformRelationsFromTo(
  rawRows: Record<string, unknown>[],
  config: HierarchyFromToConfig
): TableRelation[] {
  if (!rawRows || rawRows.length === 0) {
    return [];
  }
  
  // If no levels or values selected, return empty
  if (config.selectedLevels.length === 0 || config.selectedValues.length === 0) {
    return [];
  }

  // Filter rows that match any of the selected values in any of the selected levels
  return (rawRows || [])
    .map((row) => {
      const relationship = safeString(row?.InternalRelationship);

      // Collect all values from the row that match selected levels
      const parentValues: string[] = [];
      const childValues: string[] = [];
      
      for (const level of config.selectedLevels) {
        const parentField = parentFieldMap[level];
        const childField = childFieldMap[level];
        const parentValue = safeString(row?.[parentField]);
        const childValue = safeString(row?.[childField]);
        
        if (parentValue && config.selectedValues.includes(parentValue)) {
          parentValues.push(`${level}:${parentValue}`);
        }
        if (childValue && config.selectedValues.includes(childValue)) {
          childValues.push(`${level}:${childValue}`);
        }
      }

      // Skip rows that don't have at least one matching parent and one matching child
      if (parentValues.length === 0 || childValues.length === 0) {
        return null;
      }

      // Create node names from collected values
      const parentName = parentValues.join(' | ');
      const childName = childValues.join(' | ');

      const base: TableRelation = {
        parentTableName: parentName,
        childTableName: childName,
        parentTableType: config.selectedLevels.join(', '),
        childTableType: config.selectedLevels.join(', '),
        relationship,
        ClientID: safeString(row?.ParentClient) || "",
        AppID: safeString(row?.ParentApplication) || "",
      } as TableRelation;

      // Merge original row fields for dynamic filtering elsewhere
      return {
        ...row,
        ...base,
      } as TableRelation;
    })
    .filter(Boolean) as TableRelation[];
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
