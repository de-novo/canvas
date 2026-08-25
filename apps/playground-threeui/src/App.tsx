import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { CATALOG, CATALOG_GROUPS, type CatalogItem } from "./catalog";
import { loadComparePanes, type ComparePane, type LineTally } from "./compare";

const vendorLoaders = new Map<string, ComponentType<Record<string, string>>>();
const denovoLoaders = new Map<string, ComponentType<Record<string, string>>>();

function HostFor(
  item: CatalogItem,
  cache: Map<string, ComponentType<Record<string, string>>>,
  load: CatalogItem["load"]
) {
  const cached = cache.get(item.id);
  if (cached) return cached;
  const Loaded = lazy(load);
  cache.set(item.id, Loaded);
  return Loaded;
}

export function App() {
  const [activeId, setActiveId] = useState("warp-field");
  const [panes, setPanes] = useState<{
    original: ComparePane;
    ours: ComparePane;
    tally: LineTally;
  } | null>(null);
  const active = CATALOG.find((item) => item.id === activeId) ?? CATALOG[0];
  const OriginalHost = useMemo(() => HostFor(active, vendorLoaders, active.load), [active]);
  const DenovoHost = useMemo(() => {
    if (!active.denovoLoad) return null;
    return HostFor(active, denovoLoaders, active.denovoLoad);
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    setPanes(null);
    void loadComparePanes(active).then((next) => {
      if (!cancelled) setPanes(next);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div className="shell">
      <aside className="rail">
        <p className="eyebrow">Isolated playground</p>
        <h1>ThreeUI Community hosts</h1>
        <p className="lede">
          왼쪽은 ThreeUI 원본, 오른쪽은 Denovo 문서에서 엔진을 돌립니다.
          Warp Field만 오른쪽이 있습니다. createCanvas 어댑터는 뺐습니다.
        </p>
        <p className="count">{CATALOG.length} public rooms</p>
        {CATALOG_GROUPS.map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            <div className="list">
              {CATALOG.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-threeui-item={item.id}
                  aria-pressed={item.id === active.id}
                  onClick={() => setActiveId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </aside>
      <main className="stage-wrap">
        <header>
          <h2>{active.label}</h2>
          <p>{active.engine}</p>
          <LineCompare tally={panes?.tally} />
        </header>
        <div className="quad">
          <section className="cell">
            <h3>원본</h3>
            <div className="stage" data-threeui-stage={active.id}>
              <Suspense fallback={<div className="loading">Loading original…</div>}>
                <OriginalHost key={`original-${active.id}`} {...(active.props ?? {})} />
              </Suspense>
            </div>
          </section>
          <section className="cell">
            <h3>우리 코드</h3>
            <div className="stage" data-denovo-stage={active.id}>
              {DenovoHost ? (
                <Suspense fallback={<div className="loading">Loading Denovo…</div>}>
                  <DenovoHost key={`denovo-${active.id}`} {...(active.props ?? {})} />
                </Suspense>
              ) : (
                <div className="empty">아직 Denovo 호스트가 없습니다.</div>
              )}
            </div>
          </section>
          <CompareColumn pane={panes?.original} fallback="원본 소스를 읽는 중…" />
          <CompareColumn pane={panes?.ours} fallback="Denovo 소스를 읽는 중…" />
        </div>
      </main>
    </div>
  );
}

function LineCompare({ tally }: { tally?: LineTally }) {
  if (!tally) {
    return <p className="tally">줄 수를 세는 중…</p>;
  }

  if (!tally.ported) {
    return (
      <p className="tally" data-line-tally="unported">
        원본 {tally.originalTotal.toLocaleString()}줄 · 오른쪽은 아직 없음. 아래는 실제로 읽힌 파일
        전부입니다.
      </p>
    );
  }

  return (
    <p className="tally" data-line-tally="ported">
      우리 파일만으로는 안 됩니다. 원본 {tally.originalTotal.toLocaleString()}줄 · 우리 쪽{" "}
      {tally.ourTotal.toLocaleString()}줄 (호스트 {tally.ourHost} + 문서 {tally.ourDocument} +
      엔진 {tally.engineStillRequired.toLocaleString()} + 패키지 {tally.ourPackage.toLocaleString()}
      ). 아래 칸은 빠진 파일 없이 전문입니다.
    </p>
  );
}

function CompareColumn({ pane, fallback }: { pane?: ComparePane; fallback: string }) {
  const files = pane?.files ?? [];
  const totalLines = files.reduce((sum, file) => sum + file.lineCount, 0);
  return (
    <article className="compare-pane" data-compare-title={pane?.title ?? ""}>
      <header>
        <h3>{pane?.title ?? "…"}</h3>
        {pane ? (
          <p>{`${files.length} files · ${totalLines} lines · 전문`}</p>
        ) : (
          <p>{fallback}</p>
        )}
      </header>
      <div className="compare-files" data-compare-body={pane?.title ?? "loading"}>
        {files.length === 0 ? <pre>{fallback}</pre> : null}
        {files.map((file) => (
          <section key={file.path} className="compare-file">
            <h4>
              <code>{file.path}</code>
              <span>
                {file.role} · {file.lineCount} lines
              </span>
            </h4>
            <pre>{file.body}</pre>
          </section>
        ))}
      </div>
    </article>
  );
}
