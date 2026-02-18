export type PathSegment = string | number;
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type NodeKind = "object" | "array" | "string" | "number" | "boolean" | "null";
export type QueryHint = "json" | "data" | "payload" | "source";
export type ThemeMode = "light" | "dark";

export interface TreeNode {
  id: string;
  displayKey: string | null;
  value: JsonValue;
  kind: NodeKind;
  depth: number;
  pathSegments: PathSegment[];
  pathText: string;
  parentId?: string;
  childrenIds: string[];
  hasChildren: boolean;
  summary: string;
  searchText: string;
}

export interface TreeData {
  nodes: Record<string, TreeNode>;
  rootIds: string[];
}

export interface Notice {
  kind: "ok" | "error";
  text: string;
}
