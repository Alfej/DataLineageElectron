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
  from: HierarchyLevel;
  to: HierarchyLevel;
  fromValues: string[];
  toValues: string[];
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
 * Transform raw CSV rows into TableRelation[] for the graph using from/to hierarchy configuration.
 * Supports filtering by specific values within each hierarchy level.
 */
export function transformRelationsFromTo(
  rawRows: Record<string, unknown>[],
  config: HierarchyFromToConfig
): TableRelation[] {
  if (!rawRows || rawRows.length === 0) {
    return [];
  }
  
  // If from and to are the same, use the original transform logic
  if (config.from === config.to) {
    const filtered = (rawRows || [])
      .filter((row) => {
        if (config.fromValues.length === 0 && config.toValues.length === 0) {
          return true; // No filtering
        }
        
        const parentField = parentFieldMap[config.from];
        const childField = childFieldMap[config.from];
        const parentValue = safeString(row?.[parentField]);
        const childValue = safeString(row?.[childField]);
        
        const allSelectedValues = [...config.fromValues, ...config.toValues];
        if (allSelectedValues.length === 0) return true;
        
        return allSelectedValues.includes(parentValue) || allSelectedValues.includes(childValue);
      });
      
    return transformRelations(filtered, config.from);
  }

  const fromParentField = parentFieldMap[config.from];
  const fromChildField = childFieldMap[config.from];
  const toParentField = parentFieldMap[config.to];
  const toChildField = childFieldMap[config.to];

  return (rawRows || [])
    .map((row) => {
      const fromParentValue = safeString(row?.[fromParentField]);
      const fromChildValue = safeString(row?.[fromChildField]);
      const toParentValue = safeString(row?.[toParentField]);
      const toChildValue = safeString(row?.[toChildField]);
      const relationship = safeString(row?.InternalRelationship);

      // Skip rows with incomplete data
      if (!fromParentValue || !fromChildValue || !toParentValue || !toChildValue) {
        return null;
      }

      // Apply from values filter (if specified)
      if (config.fromValues.length > 0) {
        const hasFromMatch = config.fromValues.includes(fromParentValue) || 
                            config.fromValues.includes(fromChildValue);
        if (!hasFromMatch) return null;
      }

      // Apply to values filter (if specified)  
      if (config.toValues.length > 0) {
        const hasToMatch = config.toValues.includes(toParentValue) || 
                          config.toValues.includes(toChildValue);
        if (!hasToMatch) return null;
      }

      // Create parent node name combining from and to hierarchy values
      const parentName = `${fromParentValue} → ${toParentValue}`;
      const childName = `${fromChildValue} → ${toChildValue}`;

      const base: TableRelation = {
        parentTableName: parentName,
        childTableName: childName,
        parentTableType: `${config.from} → ${config.to}`,
        childTableType: `${config.from} → ${config.to}`,
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
