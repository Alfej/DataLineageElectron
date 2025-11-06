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
 */
export function transformRelations(
  rawRows: any[],
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

function safeString(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
