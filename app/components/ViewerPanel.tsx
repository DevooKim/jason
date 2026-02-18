import type { ChangeEvent, RefObject } from "react";
import { Button, Card, CardContent, Input, Tooltip } from "@heroui/react";
import type { VirtualItem } from "@tanstack/react-virtual";
import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
import type { JsonValue, ThemeMode, TreeData, TreeNode } from "../jsonTypes";

type ViewMode = "tree" | "raw";

interface ViewerPanelProps {
  selectedView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onSearchReset: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  searchMatchCount: number;
  visibleNodeCount: number;
  selectedDisplayKey: string | null;
  totalNodeCount: number;
  currentPath: string | null;
  treeData: TreeData;
  visibleIds: string[];
  treeScrollRef: RefObject<HTMLDivElement | null>;
  treeVirtualRows: VirtualItem[];
  treeTotalSize: number;
  selectedId: string | null;
  searchMatchSet: Set<string>;
  collapsedIds: Set<string>;
  onToggleNode: (id: string) => void;
  onSelectNode: (id: string) => void;
  onCopyPath: (id: string) => void;
  onCopyKey: (id: string) => void;
  onCopyValue: (id: string) => void;
  onCopySubtree: (id: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  rawCollapsed: boolean | number;
  onRawCollapseChange: (next: boolean | number) => void;
  errorMessage: string | null;
  parsedJsonValue: JsonValue | null;
  sortedRawJsonValue: JsonValue | null;
  themeMode: ThemeMode;
}

function getValueTypeLabel(node: TreeNode): string {
  if (node.kind === "null") return "null";
  return node.kind;
}

export function ViewerPanel({
  selectedView,
  onSelectView,
  onSearchReset,
  searchInput,
  onSearchInputChange,
  searchMatchCount,
  visibleNodeCount,
  selectedDisplayKey,
  totalNodeCount,
  currentPath,
  treeData,
  visibleIds,
  treeScrollRef,
  treeVirtualRows,
  treeTotalSize,
  selectedId,
  searchMatchSet,
  collapsedIds,
  onToggleNode,
  onSelectNode,
  onCopyPath,
  onCopyKey,
  onCopyValue,
  onCopySubtree,
  onCollapseAll,
  onExpandAll,
  rawCollapsed,
  onRawCollapseChange,
  errorMessage,
  parsedJsonValue,
  sortedRawJsonValue,
  themeMode,
}: ViewerPanelProps) {
  return (
    <>
      <Card className="control-card">
        <CardContent>
          <div className="control-bar">
            <Input
              value={searchInput}
              placeholder="키/경로/값 검색"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onSearchInputChange(event.target.value)
              }
              className="search-input"
            />

            <Button size="sm" onPress={onSearchReset} className="ui-button">
              검색 초기화
            </Button>

            <span className="search-count-badge">
              매칭 {searchMatchCount}개{visibleNodeCount ? ` / 표시 ${visibleNodeCount}개` : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="tree-meta">
        <div>{selectedDisplayKey ? `선택: ${selectedDisplayKey}` : "선택 없음"}</div>
        <div>총 노드: {totalNodeCount}</div>
        <div>현재 경로: {currentPath ?? "-"}</div>
      </div>

      <Card className="tree-card">
        <CardContent className="tree-card-content">
          <div className="tree-view-mode">
            <Button
              size="sm"
              className={`ui-button ${selectedView === "tree" ? "view-mode-button active" : ""}`}
              onPress={() => onSelectView("tree")}
            >
              트리
            </Button>
            <Button
              size="sm"
              className={`ui-button ${selectedView === "raw" ? "view-mode-button active" : ""}`}
              onPress={() => onSelectView("raw")}
            >
              RAW
            </Button>
            <Button size="sm" onPress={onCollapseAll} className="ui-button">
              전체 접기
            </Button>
            <Button size="sm" onPress={onExpandAll} className="ui-button">
              전체 펼침
            </Button>
          </div>
          {errorMessage ? <div className="error-box">{errorMessage}</div> : null}

          {selectedView === "tree" ? (
            <div className="tree-grid-shell" role="tree" aria-label="json tree">
              <div className="tree-header-row">
                <div className="tree-header-col key">키 / 타입 / 값</div>
                <div className="tree-header-col action">복사</div>
              </div>

              <div className="tree-scroll" ref={treeScrollRef}>
                <div className="tree-virtual-content" style={{ height: `${treeTotalSize}px` }}>
                  {treeVirtualRows.map(virtualRow => {
                    const id = visibleIds[virtualRow.index];
                    const node = id ? treeData.nodes[id] : null;
                    if (!node) return null;

                    const isCollapsed = collapsedIds.has(id);
                    const isSelected = selectedId === id;
                    const isMatched = searchMatchSet.has(id);

                    const rowClass = [
                      "tree-row",
                      isSelected ? "selected" : "",
                      node.hasChildren ? "branch" : "",
                      isMatched ? "matched" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div
                        key={id}
                        role="treeitem"
                        aria-expanded={node.hasChildren ? !isCollapsed : undefined}
                        className={rowClass}
                        style={{
                          paddingLeft: `${Math.max(0, node.depth - 1) * 18 + 8}px`,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          height: `${virtualRow.size}px`,
                        }}
                        onClick={() => {
                          onSelectNode(id);
                        }}
                      >
                        <div className="cell key-cell">
                          {node.hasChildren ? (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button size="sm" onPress={() => onToggleNode(id)} className="toggle">
                                  {isCollapsed ? "▸" : "▾"}
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content className="toggle-tooltip">
                                {isCollapsed ? "펼치기" : "접기"}
                              </Tooltip.Content>
                            </Tooltip>
                          ) : (
                            <span className="toggle-empty">•</span>
                          )}

                          <span className="node-key" title={node.displayKey ?? "<root>"}>
                            {node.displayKey ?? "<root>"}
                          </span>

                          <span className="node-type">{getValueTypeLabel(node)}</span>
                          <span className="node-summary" title={node.summary}>
                            {node.summary}
                          </span>
                        </div>

                        <span className="cell action-cell">
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button size="sm" onPress={() => onCopyPath(id)} className="action-button">
                                경로
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content className="action-tooltip">경로 복사</Tooltip.Content>
                          </Tooltip>

                          {node.displayKey !== null ? (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button size="sm" onPress={() => onCopyKey(id)} className="action-button">
                                  키
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content className="action-tooltip">키 복사</Tooltip.Content>
                            </Tooltip>
                          ) : null}

                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button size="sm" onPress={() => onCopyValue(id)} className="action-button">
                                값
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content className="action-tooltip">값 복사</Tooltip.Content>
                          </Tooltip>

                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button size="sm" onPress={() => onCopySubtree(id)} className="action-button">
                                노드
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content className="action-tooltip">노드 JSON 복사</Tooltip.Content>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="raw-json-panel">
              {parsedJsonValue === null || typeof parsedJsonValue !== "object" ? (
                <pre className="raw-json-panel__pre">
                  {parsedJsonValue === null ? "null" : JSON.stringify(sortedRawJsonValue, null, 2)}
                </pre>
              ) : (
                <div className="raw-json-tree">
                  <div className="tree-view-mode tree-view-mode--dense">
                    <Button
                      size="sm"
                      onPress={() => onRawCollapseChange(rawCollapsed === false ? true : false)}
                      className="ui-button"
                    >
                      {rawCollapsed ? "펼침" : "접기"}
                    </Button>
                  </div>
                  <JsonView
                    value={sortedRawJsonValue as object}
                    collapsed={rawCollapsed}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    indentWidth={16}
                    objectSortKeys={false}
                    style={themeMode === "dark" ? githubDarkTheme : githubLightTheme}
                    className="ui-json-view"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
