import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Button,
  Card,
  CardContent,
  ToastProvider,
  toast,
} from "@heroui/react";
import { InputPanel } from "./components/InputPanel";
import { ViewerPanel } from "./components/ViewerPanel";
import type {
  JsonArray,
  JsonObject,
  JsonValue,
  NodeKind,
  Notice,
  PathSegment,
  TreeData,
  TreeNode,
  ThemeMode,
} from "./jsonTypes";
import { DEFAULT_SAMPLE_JSON } from "./defaultSampleJson";
import { SHARE_QUERY_KEYS, SHARE_QUERY_KEY, getShareBaseUrl } from "./shareConfig";

const QUERY_KEYS = SHARE_QUERY_KEYS;
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const DEFAULT_COLLAPSE_DEPTH = 2;
const TREE_ROW_HEIGHT = 40;
const TREE_SCROLL_OVERSCAN = 10;
const GITHUB_REPO_URL = "https://github.com/DevooKim/jason";
const THEME_STORAGE_KEY = "jason-theme";
const DEFAULT_THEME: ThemeMode = "dark";

function getSystemThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }

  return getSystemThemeMode() || DEFAULT_THEME;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBase64(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const missing = base64.length % 4;
  if (missing === 0) return base64;
  if (missing === 2) return `${base64}==`;
  if (missing === 3) return `${base64}=`;
  return base64;
}

function decodeBase64Utf8(input: string): string | null {
  try {
    const normalized = normalizeBase64(input);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function determineKind(value: JsonValue): NodeKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
}

function pathTextFromSegments(segments: PathSegment[]): string {
  if (segments.length === 0) return "$";

  return segments.reduce<string>((path, segment) => {
    if (typeof segment === "number") {
      return `${path}[${segment}]`;
    }

    if (IDENTIFIER_RE.test(segment)) {
      return `${path}.${segment}`;
    }

    return `${path}["${segment.replaceAll("\\", "\\\\").replaceAll('"', "\\\"")}"]`;
  }, "$");
}

function buildTree(value: JsonValue): TreeData {
  const nodes: Record<string, TreeNode> = {};
  let sequence = 0;

  const build = (
    current: JsonValue,
    pathSegments: PathSegment[],
    displayKey: string | null,
    parentId: string | undefined,
    depth: number,
  ): string => {
    const id = `node-${sequence++}`;
    const kind = determineKind(current);
    const pathText = pathTextFromSegments(pathSegments);

    const node: TreeNode = {
      id,
      displayKey,
      value: current,
      kind,
      depth,
      pathSegments: [...pathSegments],
      pathText,
      parentId,
      childrenIds: [],
      hasChildren: kind === "object" || kind === "array",
      summary:
        kind === "object"
          ? `{${Object.keys(current as JsonObject).length} keys}`
          : kind === "array"
            ? `[${(current as JsonArray).length} items]`
            : JSON.stringify(current),
      searchText: [
        displayKey ?? "",
        pathText,
        kind === "object" ? "object" : kind === "array" ? "array" : String(current),
        kind === "object"
          ? `{${Object.keys(current as JsonObject).length} keys}`
          : kind === "array"
            ? `[${(current as JsonArray).length} items]`
            : JSON.stringify(current),
      ]
        .join(" ")
        .toLowerCase(),
    };

    nodes[id] = node;

    if (kind === "object") {
      const obj = current as JsonObject;
      for (const [key, child] of Object.entries(obj)) {
        const childId = build(child, [...pathSegments, key], key, id, depth + 1);
        node.childrenIds.push(childId);
      }
    }

    if (kind === "array") {
      const arr = current as JsonArray;
      arr.forEach((child, index) => {
        const key = String(index);
        const childId = build(child, [...pathSegments, index], key, id, depth + 1);
        node.childrenIds.push(childId);
      });
    }

    return id;
  };

  const rootId = build(value, [], null, undefined, 0);
  return { nodes, rootIds: [rootId] };
}

function makeDefaultCollapsed(nodes: Record<string, TreeNode>): Set<string> {
  const next = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.hasChildren && node.depth >= DEFAULT_COLLAPSE_DEPTH) {
      next.add(node.id);
    }
  }
  return next;
}

function getValueForCopy(node: TreeNode, kind: "value" | "subtree"): string {
  if (kind === "subtree") {
    return JSON.stringify(node.value, null, 2);
  }

  if (node.kind === "string") {
    return `${node.value}`;
  }

  return JSON.stringify(node.value);
}

function parseJson(text: string): { ok: true; value: JsonValue } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, error: `JSON 파싱 실패: ${error.message}` };
    }

    return { ok: false, error: `입력 형식이 유효하지 않습니다: ${String(error)}` };
  }
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value === "object") {
    const sortedEntries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    const sortedObj: JsonObject = {};

    for (const [key, item] of sortedEntries) {
      sortedObj[key] = sortJsonValue(item);
    }

    return sortedObj;
  }

  return value;
}

function stringifyParsedValueForInput(value: JsonValue): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export function App() {
  const [treeData, setTreeData] = useState<TreeData>({ nodes: {}, rootIds: [] });
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedView, setSelectedView] = useState<"tree" | "raw">("tree");
  const [activeTab, setActiveTab] = useState<"input" | "viewer">("input");
  const [parsedJsonValue, setParsedJsonValue] = useState<JsonValue | null>(null);
  const [rawCollapsed, setRawCollapsed] = useState<boolean | number>(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  const noticeTimerRef = useRef<number | null>(null);
  const searchResultCacheRef = useRef(new Map<string, string[]>());
  const treeScrollRef = useRef<HTMLDivElement | null>(null);

  const showNotice = useCallback((next: Notice) => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
    }
    setNotice(next);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 1800);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode(prev => (prev === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore storage errors
    }
  }, [themeMode]);

  const loadFromJsonText = useCallback((rawText: string) => {
    const candidateRaw = safeDecodeURIComponent(rawText);
    const parseTargets: string[] = [candidateRaw];

    const decodedFromBase64 = decodeBase64Utf8(candidateRaw);
    if (decodedFromBase64 && !parseTargets.includes(decodedFromBase64)) {
      parseTargets.push(decodedFromBase64);
    }

    let parsed: { ok: true; value: JsonValue } | { ok: false; error: string } = {
      ok: false,
      error: "입력 문자열이 JSON 형태가 아닙니다.",
    };

    for (const candidate of parseTargets) {
      const result = parseJson(candidate);
      if (result.ok) {
        parsed = result;
        break;
      }
      parsed = result;
    }

    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      setParsedJsonValue(null);
      setRawCollapsed(false);
      setSearchInput("");
      return false;
    }

    setPasteText(stringifyParsedValueForInput(parsed.value));
    const tree = buildTree(parsed.value);
    setTreeData(tree);
    setCollapsedIds(makeDefaultCollapsed(tree.nodes));
    setParsedJsonValue(parsed.value);
    setRawCollapsed(false);
    setSelectedId(tree.rootIds[0] ?? null);
    setErrorMessage(null);
    setSearchInput("");
    if (treeScrollRef.current) {
      treeScrollRef.current.scrollTop = 0;
    }

    return true;
  }, []);

  const parseAndLoadQuerySource = useCallback((raw: string): boolean => {
    return loadFromJsonText(raw);
  }, [loadFromJsonText]);

  useEffect(() => {
    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      let loadedFromQuery = false;

      for (const key of QUERY_KEYS) {
        const raw = params.get(key);
        if (raw && raw.trim()) {
          const ok = parseAndLoadQuerySource(raw);
          loadedFromQuery = ok;
          break;
        }
      }

      if (loadedFromQuery) {
        return;
      }

      try {
        const ok = loadFromJsonText(DEFAULT_SAMPLE_JSON);
        if (!ok) {
          throw new Error("기본 샘플을 파싱할 수 없습니다.");
        }
      } catch (error) {
        setErrorMessage(
          `초기 로딩 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void bootstrap();
  }, [parseAndLoadQuerySource, loadFromJsonText]);

  const nodeEntries = useMemo(() => Object.entries(treeData.nodes), [treeData.nodes]);

  const deferredSearchInput = useDeferredValue(searchInput);
  const normalizedSearch = useMemo(() => deferredSearchInput.trim().toLowerCase(), [deferredSearchInput]);

  useEffect(() => {
    searchResultCacheRef.current.clear();
  }, [treeData.nodes]);

  const searchMatchIds = useMemo(() => {
    if (!normalizedSearch) {
      return [] as string[];
    }

    const cached = searchResultCacheRef.current.get(normalizedSearch);
    if (cached) {
      return cached;
    }

    let candidates: Array<[string, TreeNode]> = nodeEntries;
    for (let i = normalizedSearch.length - 1; i >= 1; i--) {
      const prefix = normalizedSearch.slice(0, i);
      const cachedPrefix = searchResultCacheRef.current.get(prefix);
      if (!cachedPrefix) {
        continue;
      }

      const candidateEntries: Array<[string, TreeNode]> = [];
      for (const id of cachedPrefix) {
        const node = treeData.nodes[id];
        if (node) {
          candidateEntries.push([id, node]);
        }
      }
      candidates = candidateEntries;
      break;
    }

    const result = candidates
      .filter(([, node]) => node.searchText.includes(normalizedSearch))
      .map(([id]) => id);

    if (searchResultCacheRef.current.size > 40) {
      const oldestKey = searchResultCacheRef.current.keys().next().value;
      if (oldestKey !== undefined) {
        searchResultCacheRef.current.delete(oldestKey);
      }
    }

    searchResultCacheRef.current.set(normalizedSearch, result);
    return result;
  }, [nodeEntries, normalizedSearch]);

  const searchMatchSet = useMemo(() => new Set(searchMatchIds), [searchMatchIds]);

  const visibleScopeSet = useMemo(() => {
    if (!normalizedSearch) {
      return null;
    }

    const scope = new Set<string>();
    for (const matchId of searchMatchIds) {
      let current: string | undefined = matchId;
      while (current) {
        scope.add(current);
        current = treeData.nodes[current]?.parentId;
      }
    }
    return scope;
  }, [normalizedSearch, searchMatchIds, treeData.nodes]);

  const visibleIds = useMemo(() => {
    const output: string[] = [];
    if (treeData.rootIds.length === 0) {
      return output;
    }

    const traverse = (id: string) => {
      const node = treeData.nodes[id];
      if (!node) {
        return;
      }

      if (normalizedSearch && visibleScopeSet && !visibleScopeSet.has(id)) {
        return;
      }

      output.push(id);

      const shouldExpand =
        node.childrenIds.length > 0 &&
        (!collapsedIds.has(id) || (normalizedSearch && (visibleScopeSet?.has(id) ?? false)));
      if (!shouldExpand) {
        return;
      }

      for (const childId of node.childrenIds) {
        traverse(childId);
      }
    };

    for (const rootId of treeData.rootIds) {
      traverse(rootId);
    }

    return output;
  }, [treeData.nodes, treeData.rootIds, normalizedSearch, visibleScopeSet, collapsedIds]);

  const treeVirtualizer = useVirtualizer({
    count: visibleIds.length,
    getScrollElement: () => treeScrollRef.current,
    estimateSize: () => TREE_ROW_HEIGHT,
    overscan: TREE_SCROLL_OVERSCAN,
  });
  const virtualRows = treeVirtualizer.getVirtualItems();

  const selected = useMemo(() => (selectedId ? treeData.nodes[selectedId] ?? null : null), [selectedId, treeData.nodes]);
  const sortedRawJsonValue = useMemo(() => {
    if (parsedJsonValue === null) {
      return null;
    }

    if (typeof parsedJsonValue !== "object") {
      return parsedJsonValue;
    }

    return sortJsonValue(parsedJsonValue);
  }, [parsedJsonValue]);

  useEffect(() => {
    if (!selected || visibleIds.includes(selected.id)) {
      return;
    }
    setSelectedId(visibleIds[0] ?? null);
  }, [selected, visibleIds]);

  useEffect(() => {
    if (!selected?.id) {
      return;
    }

    const selectedIndex = visibleIds.indexOf(selected.id);
    if (selectedIndex < 0) return;

    treeVirtualizer.scrollToIndex(selectedIndex, { align: "auto", behavior: "smooth" });
  }, [selected, treeVirtualizer, visibleIds]);

  const toggleNode = useCallback((id: string) => {
    const target = treeData.nodes[id];
    if (!target || !target.hasChildren) return;

    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [treeData.nodes]);

  const copyText = useCallback(async (value: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(okMessage);
      return;
    } catch {
      // Fallback for browsers/environments where Clipboard API is blocked
      // (especially for large text payloads or non-HTTPS/permission-limited contexts).
    }

    try {
      const temp = document.createElement("textarea");
      temp.value = value;
      temp.setAttribute("readonly", "true");
      temp.style.position = "fixed";
      temp.style.left = "-9999px";
      temp.style.top = "-9999px";
      document.body.appendChild(temp);
      temp.focus();
      temp.select();

      const ok = document.execCommand("copy");
      document.body.removeChild(temp);

      if (ok) {
        toast.success(`${okMessage} (fallback)`);
      } else {
        toast.danger("클립보드를 사용할 수 없습니다.");
      }
    } catch {
      toast.danger("클립보드를 사용할 수 없습니다.");
    }
  }, []);

  const buildShareUrl = useCallback(() => {
    if (!parsedJsonValue) {
      toast.warning("공유할 데이터가 없습니다.");
      return null;
    }

    const rawText = JSON.stringify(parsedJsonValue);
    const encoded = encodeBase64Utf8(rawText);
    const base = getShareBaseUrl();
    if (!base) {
      return null;
    }

    try {
      const url = new URL(base);
      url.searchParams.set(SHARE_QUERY_KEY, encoded);
      return url.toString();
    } catch {
      return `${base}?${SHARE_QUERY_KEY}=${encoded}`;
    }
  }, [parsedJsonValue]);

  const onShare = useCallback(async () => {
    const url = buildShareUrl();
    if (!url) {
      toast.warning("공유 링크를 만들 수 없습니다.");
      return;
    }

    await copyText(url, "공유 링크가 클립보드에 복사되었습니다.");
  }, [buildShareUrl, copyText]);

  const onCopyPath = useCallback((id: string) => {
    const node = treeData.nodes[id];
    if (!node) return;
    void copyText(node.pathText, `경로 복사: ${node.pathText}`);
  }, [copyText, treeData.nodes]);

  const onCopyKey = useCallback((id: string) => {
    const node = treeData.nodes[id];
    if (!node || node.displayKey === null) return;
    void copyText(node.displayKey, `키 복사: ${node.displayKey}`);
  }, [copyText, treeData.nodes]);

  const onCopyValue = useCallback((id: string) => {
    const node = treeData.nodes[id];
    if (!node) return;
    void copyText(getValueForCopy(node, "value"), `값 복사: ${node.pathText}`);
  }, [copyText, treeData.nodes]);

  const onCopySubtree = useCallback((id: string) => {
    const node = treeData.nodes[id];
    if (!node) return;
    void copyText(getValueForCopy(node, "subtree"), `노드 JSON 복사: ${node.pathText}`);
  }, [copyText, treeData.nodes]);

  const collapseAll = useCallback(() => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      for (const node of nodeEntries.map(([, node]) => node)) {
        if (node.hasChildren && node.depth >= 1) {
          next.add(node.id);
        }
      }
      return next;
    });
    setRawCollapsed(true);
  }, [nodeEntries]);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
    setRawCollapsed(false);
  }, []);

  const onUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setPasteText(text);
    loadFromJsonText(text);
    event.target.value = "";
  }, [loadFromJsonText]);

  const onPasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteText(text);
      loadFromJsonText(text);
    } catch {
      showNotice({ kind: "error", text: "클립보드 읽기 권한이 없습니다." });
    }
  }, [loadFromJsonText, showNotice]);

  const onParsePastedText = useCallback(() => {
    if (!pasteText.trim()) {
      setNotice({ kind: "error", text: "붙여넣기 텍스트가 비어 있습니다." });
      return;
    }

    const ok = loadFromJsonText(pasteText);
    if (ok) {
      setActiveTab("viewer");
    }
  }, [loadFromJsonText, pasteText]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onWindowScroll = () => {
      setShowScrollTop(window.scrollY > 260);
    };

    onWindowScroll();
    window.addEventListener("scroll", onWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  return (
    <div className="viewer-shell">
      <ToastProvider />
      <header className="app-header">
        <Button
          size="sm"
          className="ui-button github-header-button"
          onPress={() => {
            window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
          }}
          aria-label="GitHub 저장소 열기"
        >
          GitHub
        </Button>
      </header>
      <Card className="app-shell-card">
        <CardContent className="viewer-content">
          <div className="workspace-tab-bar">
            <span className="workspace-tab-group workspace-tab-group--left">
              <Button
                size="sm"
                className="ui-button theme-switch-button"
                onPress={toggleThemeMode}
              >
                {themeMode === "dark" ? "☀️ Light" : "🌙 Dark"}
              </Button>
              <Button
                size="sm"
                className="ui-button"
                onPress={onShare}
                isDisabled={parsedJsonValue === null}
              >
                🔗 공유
              </Button>
            </span>
            <span className="workspace-tab-spacer" />
            <span className="workspace-tab-group workspace-tab-group--right">
              <Button
                size="sm"
                className={`ui-button workspace-tab-button ${activeTab === "input" ? "active" : ""}`}
                onPress={() => setActiveTab("input")}
              >
                데이터 입력
              </Button>
              <Button
                size="sm"
                className={`ui-button workspace-tab-button ${activeTab === "viewer" ? "active" : ""}`}
                onPress={() => setActiveTab("viewer")}
              >
                뷰어
              </Button>
            </span>
          </div>

          {activeTab === "input" ? (
            <InputPanel
              pasteText={pasteText}
              onPasteTextChange={setPasteText}
              onUpload={onUpload}
              onPasteFromClipboard={onPasteFromClipboard}
              onParsePastedText={onParsePastedText}
            />
          ) : (
            <ViewerPanel
              selectedView={selectedView}
              onSelectView={setSelectedView}
              onSearchReset={() => setSearchInput("")}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              searchMatchCount={searchMatchIds.length}
              visibleNodeCount={visibleIds.length}
              selectedDisplayKey={selected?.displayKey ?? null}
              totalNodeCount={nodeEntries.length}
              currentPath={selected?.pathText ?? null}
              treeData={treeData}
              visibleIds={visibleIds}
              treeScrollRef={treeScrollRef}
              treeVirtualRows={virtualRows}
              treeTotalSize={treeVirtualizer.getTotalSize()}
              selectedId={selected?.id ?? null}
              searchMatchSet={searchMatchSet}
              collapsedIds={collapsedIds}
              onToggleNode={toggleNode}
              onSelectNode={setSelectedId}
              onCopyPath={onCopyPath}
              onCopyKey={onCopyKey}
              onCopyValue={onCopyValue}
              onCopySubtree={onCopySubtree}
              onCollapseAll={collapseAll}
              onExpandAll={expandAll}
              rawCollapsed={rawCollapsed}
              onRawCollapseChange={setRawCollapsed}
              errorMessage={errorMessage}
              parsedJsonValue={parsedJsonValue}
              sortedRawJsonValue={sortedRawJsonValue}
              themeMode={themeMode}
            />
          )}

        </CardContent>
      </Card>

      {notice ? <div className={`notice ${notice.kind}`}>{notice.text}</div> : null}

      {showScrollTop ? (
        <Button
          isIconOnly
          className="scroll-top-button"
          variant="primary"
          size="lg"
          onPress={scrollToTop}
          aria-label="상단으로 이동"
            >
          ↑
        </Button>
      ) : null}
    </div>
  );
}

export default App;
