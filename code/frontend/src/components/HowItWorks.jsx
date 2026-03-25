import React, { useState } from 'react';
import { Grid, Column, Tabs, TabList, Tab, TabPanels, TabPanel, Button } from '@carbon/react';
import { DataBase, Search, ChartNetwork, DataVis_4, Link, Compare, ArrowRight } from '@carbon/icons-react';

const SAMPLE_DOCS = [
  { id: 'INC0001234', type: 'Incident', typeClass: 'type-incident', title: 'Database connection pool exhausted on PROD-DB-01', fields: [{ key: 'Priority', value: 'P1 - Critical' }, { key: 'Status', value: 'In Progress' }, { key: 'Assigned', value: 'DBA Team' }], links: ['CI-DB-PROD-01', 'PRB0000456', 'KB0001001'], vectorSeed: [0.82, 0.45, 0.91, 0.23, 0.67, 0.38, 0.74, 0.55], vectorColor: '#ff6b6b' },
  { id: 'CI-DB-PROD-01', type: 'Config Item', typeClass: 'type-ci', title: 'Oracle DB 19c — Production Cluster', fields: [{ key: 'Class', value: 'Database Server' }, { key: 'Status', value: 'Operational' }, { key: 'Owner', value: 'Platform Ops' }], links: ['INC0001234', 'CHG0002345', 'SVC-ERP-001'], vectorSeed: [0.34, 0.78, 0.12, 0.89, 0.56, 0.43, 0.21, 0.95], vectorColor: '#78a9ff' },
  { id: 'PRB0000456', type: 'Problem', typeClass: 'type-problem', title: 'Recurring connection pool exhaustion under peak load', fields: [{ key: 'State', value: 'Root Cause Analysis' }, { key: 'Impact', value: 'High' }, { key: 'Root Cause', value: 'Under investigation' }], links: ['INC0001234', 'KB0001001', 'CHG0002345'], vectorSeed: [0.61, 0.29, 0.84, 0.47, 0.73, 0.18, 0.92, 0.36], vectorColor: '#ff832b' },
  { id: 'CHG0002345', type: 'Change', typeClass: 'type-change', title: 'Increase Oracle connection pool size from 200 to 500', fields: [{ key: 'Type', value: 'Normal Change' }, { key: 'State', value: 'Approved' }, { key: 'Risk', value: 'Medium' }], links: ['CI-DB-PROD-01', 'PRB0000456'], vectorSeed: [0.15, 0.63, 0.41, 0.87, 0.29, 0.76, 0.53, 0.08], vectorColor: '#be84ff' },
  { id: 'KB0001001', type: 'KB Article', typeClass: 'type-kb', title: 'How to diagnose and resolve Oracle connection pool issues', fields: [{ key: 'Category', value: 'Database' }, { key: 'Views', value: '1,247' }, { key: 'Rating', value: '4.8 / 5.0' }], links: ['PRB0000456', 'INC0001234'], vectorSeed: [0.77, 0.52, 0.33, 0.68, 0.14, 0.91, 0.46, 0.25], vectorColor: '#42be65' },
  { id: 'SVC-ERP-001', type: 'Business Svc', typeClass: 'type-service', title: 'Enterprise Resource Planning (ERP) Platform', fields: [{ key: 'Criticality', value: 'Mission Critical' }, { key: 'SLA', value: '99.9% uptime' }, { key: 'Users', value: '4,200 employees' }], links: ['CI-DB-PROD-01'], vectorSeed: [0.48, 0.86, 0.22, 0.59, 0.95, 0.31, 0.64, 0.77], vectorColor: '#08bdba' },
];

const GRAPH_NODES = [
  { id: 'INC0001234',    label: 'INC\n0001234',   x: 50, y: 50, color: '#ff6b6b', border: '#ff4444' },
  { id: 'CI-DB-PROD-01', label: 'CI-DB\nPROD-01', x: 25, y: 25, color: '#78a9ff', border: '#4d8fff' },
  { id: 'PRB0000456',    label: 'PRB\n0000456',   x: 75, y: 25, color: '#ff832b', border: '#ff6600' },
  { id: 'CHG0002345',    label: 'CHG\n0002345',   x: 75, y: 75, color: '#be84ff', border: '#9d5fff' },
  { id: 'KB0001001',     label: 'KB\n0001001',    x: 25, y: 75, color: '#42be65', border: '#2da44e' },
  { id: 'SVC-ERP-001',   label: 'SVC\nERP-001',   x: 50, y: 15, color: '#08bdba', border: '#06a09d' },
];

const GRAPH_EDGES = [
  ['INC0001234', 'CI-DB-PROD-01'], ['INC0001234', 'PRB0000456'], ['INC0001234', 'KB0001001'],
  ['CI-DB-PROD-01', 'CHG0002345'], ['CI-DB-PROD-01', 'SVC-ERP-001'],
  ['PRB0000456', 'CHG0002345'], ['PRB0000456', 'KB0001001'],
];

function VectorBar({ seed, color, animated = false }) {
  const dims = [];
  for (let i = 0; i < 40; i++) {
    const val = seed[i % seed.length];
    const jitter = ((i * 7 + 13) % 17) / 17;
    dims.push(Math.round(4 + (val * 0.6 + jitter * 0.4) * 20));
  }
  return (
    <div className={`doc-card__vector-bar${animated ? ' vector-animated' : ''}`}>
      {dims.map((h, i) => (
        <div key={i} className="doc-card__vector-dim"
          style={{ height: `${h}px`, backgroundColor: color, opacity: 0.7 + (i % 3) * 0.1 }} />
      ))}
    </div>
  );
}

function DocCard({ doc, highlighted = false, animated = false }) {
  return (
    <div className="doc-card"
      style={highlighted ? { borderColor: doc.vectorColor, boxShadow: `0 0 16px ${doc.vectorColor}33` } : {}}>
      <div className={`doc-card__type-badge ${doc.typeClass}`}>{doc.type}</div>
      <div className="doc-card__id">{doc.id}</div>
      <div className="doc-card__title">{doc.title}</div>
      {doc.fields.map((f) => (
        <div key={f.key} className="doc-card__field">
          <span className="doc-card__field-key">{f.key}:</span>
          <span className="doc-card__field-value">{f.value}</span>
        </div>
      ))}
      <div className="doc-card__vector-section">
        <div className="doc-card__vector-label">
          {/* eslint-disable-next-line react/jsx-pascal-case */}
          <DataVis_4 size={14} />&nbsp;Embedding Vector (1024-dim · multilingual-e5-large)
        </div>
        <VectorBar seed={doc.vectorSeed} color={doc.vectorColor} animated={animated} />
        <div className="doc-card__vector-note">
          [0.{Math.round(doc.vectorSeed[0]*100)}, 0.{Math.round(doc.vectorSeed[1]*100)}, 0.{Math.round(doc.vectorSeed[2]*100)}, … +1021 more]
        </div>
      </div>
      {doc.links.length > 0 && (
        <div className="doc-card__links-section">
          <div className="doc-card__links-label"><Link size={14} />&nbsp;Graph Links (metadata.links)</div>
          {doc.links.map((l) => <span key={l} className="doc-card__link-chip"><Link size={10} /> {l}</span>)}
        </div>
      )}
    </div>
  );
}

function GraphSVG({ highlightedNodes = [], traversalPath = [] }) {
  const W = 600, H = 300;
  const nodeMap = {};
  GRAPH_NODES.forEach((n) => { nodeMap[n.id] = n; });
  const px = (p) => (p / 100) * W;
  const py = (p) => (p / 100) * H;
  const isTraversed = (a, b) => traversalPath.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <marker id="hiw-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#525252" />
        </marker>
        <marker id="hiw-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#be84ff" />
        </marker>
      </defs>
      {GRAPH_EDGES.map(([a, b], i) => {
        const na = nodeMap[a], nb = nodeMap[b];
        const active = isTraversed(a, b);
        return <line key={i} x1={px(na.x)} y1={py(na.y)} x2={px(nb.x)} y2={py(nb.y)}
          stroke={active ? '#be84ff' : '#393939'} strokeWidth={active ? 2.5 : 1}
          strokeDasharray={active ? 'none' : '4 3'}
          markerEnd={active ? 'url(#hiw-arrow-active)' : 'url(#hiw-arrow)'}
          opacity={active ? 1 : 0.5} />;
      })}
      {GRAPH_NODES.map((n) => {
        const hl = highlightedNodes.includes(n.id);
        const lines = n.label.split('\n');
        return (
          <g key={n.id} transform={`translate(${px(n.x)},${py(n.y)})`}>
            <circle r={hl ? 26 : 22} fill={hl ? n.color + '33' : '#161616'}
              stroke={hl ? n.color : n.border} strokeWidth={hl ? 2.5 : 1.5} />
            {hl && <circle r={30} fill="none" stroke={n.color} strokeWidth={1} opacity={0.3} />}
            {lines.map((line, li) => (
              <text key={li} textAnchor="middle" dy={li === 0 ? (lines.length > 1 ? -5 : 4) : 9}
                fill={hl ? n.color : '#c6c6c6'} fontSize="8"
                fontWeight={hl ? '700' : '400'} fontFamily="IBM Plex Mono, monospace">{line}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Tab 1: Data Storage ──────────────────────────────────────────────────────
function DataStorageTab() {
  const [activeDoc, setActiveDoc] = useState(null);
  return (
    <>
      <div className="hiw-section">
        <div className="hiw-section__label">Astra DB Architecture</div>
        <div className="hiw-section__title">How Enterprise ITSM Data is Stored</div>
        <div className="hiw-section__description">
          Each ITSM entity (Incident, CI, Problem, Change, KB Article, Business Service) is stored
          as a document in Astra DB with three key components: structured metadata fields,
          a 1024-dimensional embedding vector, and a graph links array for relationship traversal.
        </div>
        <div className="arch-diagram">
          <div className="arch-diagram__row">
            <div className="arch-diagram__box arch-diagram__box--gray"><div className="arch-diagram__box-icon">📋</div><span className="arch-diagram__box-label">Enterprise ITSM</span><span className="arch-diagram__box-sub">Source System</span></div>
            <div className="arch-diagram__arrow">→</div>
            <div className="arch-diagram__box arch-diagram__box--orange"><div className="arch-diagram__box-icon">⚙️</div><span className="arch-diagram__box-label">Data Generator</span><span className="arch-diagram__box-sub">Python · 1,370 docs</span></div>
            <div className="arch-diagram__arrow">→</div>
            <div className="arch-diagram__box arch-diagram__box--purple"><div className="arch-diagram__box-icon">🧠</div><span className="arch-diagram__box-label">IBM watsonx</span><span className="arch-diagram__box-sub">multilingual-e5-large</span></div>
            <div className="arch-diagram__arrow">→</div>
            <div className="arch-diagram__box arch-diagram__box--blue"><div className="arch-diagram__box-icon">🗄️</div><span className="arch-diagram__box-label">Astra DB</span><span className="arch-diagram__box-sub">Vector + Graph Store</span></div>
          </div>
          <div className="arch-diagram__divider" />
          <div className="arch-diagram__row">
            <div className="arch-diagram__box arch-diagram__box--teal"><div className="arch-diagram__box-icon">📄</div><span className="arch-diagram__box-label">_id</span><span className="arch-diagram__box-sub">INC0001234</span></div>
            <div className="arch-diagram__arrow">+</div>
            <div className="arch-diagram__box arch-diagram__box--green"><div className="arch-diagram__box-icon">📊</div><span className="arch-diagram__box-label">metadata{'{}'}</span><span className="arch-diagram__box-sub">Fields + links[]</span></div>
            <div className="arch-diagram__arrow">+</div>
            <div className="arch-diagram__box arch-diagram__box--purple"><div className="arch-diagram__box-icon">🔢</div><span className="arch-diagram__box-label">$vector</span><span className="arch-diagram__box-sub">1024 float32 dims</span></div>
          </div>
        </div>
      </div>
      <Grid>
        {[
          { value: '1,370', label: 'Total Documents',   sub: 'Across 6 entity types',           color: '#78a9ff' },
          { value: '1,024', label: 'Vector Dimensions', sub: 'multilingual-e5-large',            color: '#be84ff' },
          { value: '6',     label: 'Entity Types',      sub: 'INC · CI · PRB · CHG · KB · SVC', color: '#42be65' },
          { value: '~4.2',  label: 'Avg Links / Doc',   sub: 'Graph relationship edges',         color: '#ff832b' },
        ].map((s) => (
          <Column key={s.label} sm={4} md={2} lg={4}>
            <div className="stat-card">
              <div className="stat-card__value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__sub">{s.sub}</div>
            </div>
          </Column>
        ))}
      </Grid>
      <div className="hiw-section hiw-mt-07">
        <div className="hiw-section__label">Live Document Examples</div>
        <div className="hiw-section__title">Click any document to explore its structure</div>
        <div className="hiw-section__description">
          Each card represents one Astra DB document. Notice how every document carries both
          a semantic embedding vector (for similarity search) and explicit graph links (for relationship traversal).
        </div>
        <Grid>
          {SAMPLE_DOCS.map((doc) => (
            <Column key={doc.id} sm={4} md={4} lg={8}>
              <div onClick={() => setActiveDoc(activeDoc?.id === doc.id ? null : doc)} style={{ cursor: 'pointer', marginBlockEnd: '1rem' }}>
                <DocCard doc={doc} highlighted={activeDoc?.id === doc.id} animated={activeDoc?.id === doc.id} />
              </div>
            </Column>
          ))}
        </Grid>
        {activeDoc && (
          <div className="hiw-callout hiw-callout--info hiw-mt-05">
            <div className="hiw-callout__title">📄 Astra DB Document: {activeDoc.id}</div>
            <div className="hiw-callout__body">
              <pre style={{ fontSize: '0.75rem', color: '#a8c8ff', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`{
  "_id": "${activeDoc.id}",
  "content": "${activeDoc.title}",
  "metadata": {
    "type": "${activeDoc.type}",
    ${activeDoc.fields.map((f) => `"${f.key.toLowerCase()}": "${f.value}"`).join(',\n    ')},
    "links": [${activeDoc.links.map((l) => `"${l}"`).join(', ')}]
  },
  "$vector": [${activeDoc.vectorSeed.map((v) => v.toFixed(4)).join(', ')}, ... /* 1024 total */]
}`}
              </pre>
            </div>
          </div>
        )}
      </div>
      <div className="hiw-section hiw-mt-06">
        <div className="hiw-section__label">Collection Schema</div>
        <div className="hiw-section__title">Astra DB Collection Definition</div>
        <div className="rag-flow__step-code">{`# Python — astrapy 2.1.0
from astrapy.constants import VectorMetric
from astrapy.info import CollectionDefinition

collection = db.create_collection(
    "graphCollection",
    definition=CollectionDefinition.builder()
        .set_vector_dimension(1024)
        .set_vector_metric(VectorMetric.COSINE)
        .build(),
)

# Each document inserted:
{
    "_id":     "INC0001234",
    "content": "Database connection pool exhausted on PROD-DB-01",
    "metadata": {
        "type":     "incident",
        "priority": "P1 - Critical",
        "links":    ["CI-DB-PROD-01", "PRB0000456", "KB0001001"]
    },
    "$vector": [0.0823, 0.4512, 0.9134, ...]   # 1024 floats
}`}
        </div>
      </div>
    </>
  );
}

// ─── Tab 2: Normal RAG ────────────────────────────────────────────────────────
function NormalRAGTab() {
  const [queryRun, setQueryRun] = useState(false);
  const retrievedDocs = [
    { id: 'INC0001234', title: 'Database connection pool exhausted on PROD-DB-01', score: 0.94, type: 'Incident' },
    { id: 'KB0001001',  title: 'How to diagnose and resolve Oracle connection pool issues', score: 0.89, type: 'KB Article' },
    { id: 'PRB0000456', title: 'Recurring connection pool exhaustion under peak load', score: 0.85, type: 'Problem' },
    { id: 'INC0000987', title: 'Oracle DB performance degradation — connection timeouts', score: 0.81, type: 'Incident' },
    { id: 'KB0000892',  title: 'Oracle connection pool tuning best practices', score: 0.78, type: 'KB Article' },
  ];
  const steps = [
    { num: '1', title: 'Embed the Query', desc: 'The user query is converted to a 1024-dimensional vector using IBM watsonx multilingual-e5-large.', code: `# IBM watsonx Embeddings\nembeddings = Embeddings(\n    model_id="intfloat/multilingual-e5-large",\n    credentials=Credentials(api_key, url),\n    project_id=project_id,\n)\nquery_vector = embeddings.embed_query(\n    "Why is the database connection pool exhausted?"\n)\n# → [0.0823, 0.4512, 0.9134, ... 1024 floats]` },
    { num: '2', title: 'Vector Similarity Search', desc: 'Astra DB performs an ANN search using cosine similarity to find the top-5 most similar documents.', code: `# Astra DB — vector search\nresults = collection.find(\n    sort={"$vector": query_vector},\n    limit=5,\n    include_similarity=True,\n)\n# Returns top-5 docs by cosine similarity score` },
    { num: '3', title: 'Build Context & Generate Answer', desc: 'Retrieved documents are concatenated into a context prompt and sent to IBM watsonx Granite LLM.', code: `# IBM watsonx Granite LLM\ncontext = "\\n\\n".join([doc["content"] for doc in results])\nprompt = f"""Answer based on context only:\nContext: {'{context}'}\nQuestion: {'{query}'}\nAnswer:"""\nanswer = model.generate_text(prompt)` },
  ];
  return (
    <>
      <div className="hiw-section">
        <div className="hiw-section__label">Normal RAG Pipeline</div>
        <div className="hiw-section__title">Pure Vector Similarity Search</div>
        <div className="hiw-section__description">
          Normal RAG converts the user query into an embedding vector and finds the top-K most similar documents
          using cosine similarity. It has no awareness of relationships between documents.
        </div>
        <div className="rag-flow__pipeline">
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="rag-flow__step rag-flow__step--active">
                <div className="rag-flow__step-number rag-flow__step-number--blue">{step.num}</div>
                <div className="rag-flow__step-content">
                  <div className="rag-flow__step-title">{step.title}</div>
                  <div className="rag-flow__step-desc">{step.desc}</div>
                  <div className="rag-flow__step-code">{step.code}</div>
                </div>
              </div>
              {i < steps.length - 1 && <div className="rag-flow__connector">↓</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="hiw-section hiw-mt-06">
        <div className="hiw-section__label">Live Simulation</div>
        <div className="hiw-section__title">See Normal RAG in Action</div>
        <div className="query-sim__input-row">
          <Search size={20} style={{ color: '#78a9ff', flexShrink: 0 }} />
          <div className="query-sim__query-text">"Why is the database connection pool exhausted and what should I do?"</div>
          <Button kind="primary" size="sm" onClick={() => setQueryRun(true)} renderIcon={ArrowRight}>Run Normal RAG</Button>
        </div>
        {queryRun && (
          <>
            <div className="hiw-callout hiw-callout--info hiw-mb-05">
              <div className="hiw-callout__title">🔍 Vector Search Results (top-5 by cosine similarity)</div>
              <div className="hiw-callout__body">Only documents semantically similar to the query are retrieved. No relationship traversal occurs.</div>
            </div>
            <Grid>
              {retrievedDocs.map((doc, i) => (
                <Column key={doc.id} sm={4} md={8} lg={16}>
                  <div className="query-sim__retrieved-doc">
                    <div className="query-sim__retrieved-doc-title">#{i + 1} · [{doc.type}] {doc.title}</div>
                    <div className="query-sim__retrieved-doc-score">Cosine Similarity: <strong style={{ color: '#78a9ff' }}>{doc.score.toFixed(3)}</strong>&nbsp;·&nbsp; ID: <code style={{ color: '#78a9ff' }}>{doc.id}</code></div>
                  </div>
                </Column>
              ))}
            </Grid>
            <div className="query-sim__answer-box query-sim__answer-box--normal hiw-mt-05">
              <strong>🤖 Normal RAG Answer:</strong><br /><br />
              The database connection pool exhaustion on PROD-DB-01 is caused by high concurrent database requests exceeding the configured pool limit of 200 connections. Based on the retrieved knowledge base articles, you should: (1) immediately increase the connection pool size, (2) review active sessions, and (3) implement connection timeout policies.<br /><br />
              <em style={{ opacity: 0.7, fontSize: '0.8rem' }}>⚠️ Note: Normal RAG retrieved 5 documents. It missed CHG0002345 and SVC-ERP-001 because they were not in the top-5 similarity results — even though they are directly linked to this incident.</em>
            </div>
            <div className="hiw-callout hiw-callout--warning hiw-mt-05">
              <div className="hiw-callout__title">⚠️ Normal RAG Limitation</div>
              <div className="hiw-callout__body">Normal RAG <strong>missed CHG0002345</strong> (the approved fix) and <strong>SVC-ERP-001</strong> (the impacted business service) because those documents were not in the top-5 similarity scores — even though they are directly linked via <code>metadata.links</code> graph edges.</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Tab 3: Graph RAG ─────────────────────────────────────────────────────────
function GraphRAGTab() {
  const [step, setStep] = useState(0);
  const traversalSteps = [
    { label: 'Step 0: Initial Vector Search', highlighted: ['INC0001234'], path: [], desc: 'Start with vector similarity search — same as Normal RAG. Find the seed document: INC0001234.' },
    { label: 'Step 1: BFS Level 1 — Direct Neighbours', highlighted: ['INC0001234', 'CI-DB-PROD-01', 'PRB0000456', 'KB0001001'], path: [['INC0001234', 'CI-DB-PROD-01'], ['INC0001234', 'PRB0000456'], ['INC0001234', 'KB0001001']], desc: 'Follow metadata.links from INC0001234. Retrieve CI-DB-PROD-01, PRB0000456, and KB0001001.' },
    { label: 'Step 2: BFS Level 2 — Second-Degree Neighbours', highlighted: ['INC0001234', 'CI-DB-PROD-01', 'PRB0000456', 'KB0001001', 'CHG0002345', 'SVC-ERP-001'], path: [['INC0001234', 'CI-DB-PROD-01'], ['INC0001234', 'PRB0000456'], ['INC0001234', 'KB0001001'], ['CI-DB-PROD-01', 'CHG0002345'], ['CI-DB-PROD-01', 'SVC-ERP-001'], ['PRB0000456', 'CHG0002345']], desc: 'Follow links from CI-DB-PROD-01 and PRB0000456. Discover CHG0002345 (the fix!) and SVC-ERP-001 (impacted service).' },
  ];
  const current = traversalSteps[step];
  const graphSteps = [
    { num: '1', variant: 'blue',   title: 'Embed Query + Vector Search (same as Normal RAG)', desc: 'Convert query to 1024-dim vector. Find top-K seed documents via cosine similarity.', code: `query_vector = embeddings.embed_query(query)\nseed_docs = collection.find(\n    sort={"$vector": query_vector},\n    limit=3,\n    include_similarity=True,\n)` },
    { num: '2', variant: 'purple', title: 'BFS Graph Traversal via metadata.links', desc: 'For each seed document, follow its metadata.links to retrieve directly connected documents. Repeat up to max_depth=2.', code: `# BFS traversal\nvisited = set(seed_ids)\nqueue = list(seed_ids)\n\nwhile queue and depth <= max_depth:\n    doc_id = queue.pop(0)\n    doc = collection.find_one({"_id": doc_id})\n    links = doc["metadata"].get("links", [])\n\n    for link_id in links:\n        if link_id not in visited:\n            visited.add(link_id)\n            queue.append(link_id)` },
    { num: '3', variant: 'purple', title: 'Merge + Rank + Generate Answer', desc: 'Combine seed documents + traversed documents. Send enriched context to IBM watsonx Granite LLM.', code: `all_docs = seed_docs + traversed_docs\ncontext = "\\n\\n".join([\n    f"[{doc['metadata']['type']}] {doc['content']}"\n    for doc in all_docs\n])\n# Graph RAG context is richer — includes related\n# Change Requests, CIs, and Business Services` },
  ];
  return (
    <>
      <div className="hiw-section">
        <div className="hiw-section__label">Graph RAG Pipeline</div>
        <div className="hiw-section__title">Vector Search + Graph Traversal</div>
        <div className="hiw-section__description">
          Graph RAG starts with the same vector similarity search as Normal RAG, but then performs a BFS traversal
          through <code>metadata.links</code> to discover related documents that may not be semantically similar
          but are contextually critical for answering the question.
        </div>
        <div className="rag-flow__pipeline">
          {graphSteps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`rag-flow__step rag-flow__step--${s.variant === 'purple' ? 'graph' : 'active'}`}>
                <div className={`rag-flow__step-number rag-flow__step-number--${s.variant}`}>{s.num}</div>
                <div className="rag-flow__step-content">
                  <div className="rag-flow__step-title">{s.title}</div>
                  <div className="rag-flow__step-desc">{s.desc}</div>
                  <div className="rag-flow__step-code">{s.code}</div>
                </div>
              </div>
              {i < graphSteps.length - 1 && <div className="rag-flow__connector">↓</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="hiw-section hiw-mt-06">
        <div className="hiw-section__label">Interactive BFS Traversal</div>
        <div className="hiw-section__title">Watch Graph RAG Explore the Knowledge Graph</div>
        <div className="hiw-section__description">Step through the BFS traversal to see how Graph RAG discovers related documents that Normal RAG would miss.</div>
        <div className="graph-viz">
          <div className="graph-viz__title"><ChartNetwork size={20} style={{ color: '#be84ff' }} />&nbsp;Astra DB Knowledge Graph — BFS Traversal</div>
          <div style={{ height: '300px' }}><GraphSVG highlightedNodes={current.highlighted} traversalPath={current.path} /></div>
          <div className="graph-viz__legend">
            {[{ color: '#ff6b6b', label: 'Incident' }, { color: '#78a9ff', label: 'Config Item' }, { color: '#ff832b', label: 'Problem' }, { color: '#be84ff', label: 'Change' }, { color: '#42be65', label: 'KB Article' }, { color: '#08bdba', label: 'Business Service' }].map((l) => (
              <div key={l.label} className="graph-viz__legend-item"><div className="graph-viz__legend-dot" style={{ backgroundColor: l.color }} />{l.label}</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBlockStart: '1rem', flexWrap: 'wrap' }}>
          {traversalSteps.map((s, i) => (
            <Button key={i} kind={step === i ? 'primary' : 'tertiary'} size="sm" onClick={() => setStep(i)}>{s.label}</Button>
          ))}
        </div>
        <div className="hiw-callout hiw-callout--success hiw-mt-05">
          <div className="hiw-callout__title">🔍 {current.label}</div>
          <div className="hiw-callout__body">{current.desc}</div>
        </div>
        {step === 2 && (
          <div className="query-sim__answer-box query-sim__answer-box--graph hiw-mt-05">
            <strong>🤖 Graph RAG Answer:</strong><br /><br />
            The database connection pool exhaustion on PROD-DB-01 is a known recurring issue (PRB0000456) affecting the ERP Platform (SVC-ERP-001) which serves 4,200 employees. The root cause is insufficient pool sizing under peak load. An approved change request (CHG0002345) is in place to increase the Oracle connection pool from 200 to 500 connections. The KB article KB0001001 provides step-by-step resolution guidance.<br /><br />
            <em style={{ opacity: 0.7, fontSize: '0.8rem' }}>✅ Graph RAG retrieved 6 documents (vs 5 for Normal RAG) including the Change Request and Business Service impact — providing a complete, actionable answer.</em>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Tab 4: Comparison ────────────────────────────────────────────────────────
function ComparisonTab() {
  const rows = [
    { dim: 'Retrieval Mechanism',    normal: 'Cosine similarity on $vector field',    graph: 'Cosine similarity + BFS on metadata.links', winner: 'graph' },
    { dim: 'Context Richness',       normal: 'Only semantically similar docs',         graph: 'Semantically similar + related docs',        winner: 'graph' },
    { dim: 'Response Latency',       normal: '~1.2s (single DB query)',                graph: '~2.1s (multiple DB queries)',                winner: 'normal' },
    { dim: 'Relationship Awareness', normal: 'None — treats docs as isolated',         graph: 'Full — follows explicit links',              winner: 'graph' },
    { dim: 'Answer Completeness',    normal: 'May miss related entities',              graph: 'Discovers connected context',                winner: 'graph' },
    { dim: 'Scalability',            normal: 'O(1) DB queries',                        graph: 'O(n) queries per BFS level',                 winner: 'normal' },
    { dim: 'Best For',               normal: 'Simple factual lookups',                 graph: 'Multi-entity ITSM queries',                  winner: 'tie' },
    { dim: 'Astra DB Feature Used',  normal: '$vector ANN search',                     graph: '$vector ANN + find_one() traversal',         winner: 'graph' },
    { dim: 'Data Requirement',       normal: 'Embedding vector only',                  graph: 'Embedding vector + metadata.links',          winner: 'normal' },
    { dim: 'Hallucination Risk',     normal: 'Higher (less context)',                  graph: 'Lower (richer context)',                     winner: 'graph' },
  ];
  return (
    <>
      <div className="hiw-section">
        <div className="hiw-section__label">Head-to-Head Comparison</div>
        <div className="hiw-section__title">Normal RAG vs Graph RAG</div>
        <div className="hiw-section__description">A comprehensive comparison of both retrieval strategies across key dimensions: retrieval mechanism, context quality, performance, and use cases.</div>
        <Grid>
          <Column sm={4} md={4} lg={8}>
            <div className="rag-flow__result-box rag-flow__result-box--normal">
              <div className="rag-flow__result-title" style={{ color: '#78a9ff' }}>🔵 Normal RAG</div>
              {[{ label: 'Retrieval Method', value: 'Vector similarity only' }, { label: 'Documents Retrieved', value: '5 (top-K by cosine score)' }, { label: 'Relationship Awareness', value: 'None' }, { label: 'Avg Response Time', value: '~1.2s' }, { label: 'Context Completeness', value: 'Partial (similarity-biased)' }, { label: 'Missed in Demo', value: 'CHG0002345, SVC-ERP-001' }].map((r) => (
                <div key={r.label} className="rag-flow__result-stat"><span className="rag-flow__result-stat-label">{r.label}</span><span className="rag-flow__result-stat-value">{r.value}</span></div>
              ))}
            </div>
          </Column>
          <Column sm={4} md={4} lg={8}>
            <div className="rag-flow__result-box rag-flow__result-box--graph">
              <div className="rag-flow__result-title" style={{ color: '#be84ff' }}>🟣 Graph RAG</div>
              {[{ label: 'Retrieval Method', value: 'Vector search + BFS traversal' }, { label: 'Documents Retrieved', value: '6+ (seeds + graph neighbours)' }, { label: 'Relationship Awareness', value: 'Full (2-hop BFS)' }, { label: 'Avg Response Time', value: '~2.1s' }, { label: 'Context Completeness', value: 'Rich (relationship-aware)' }, { label: 'Extra in Demo', value: 'CHG0002345, SVC-ERP-001 ✅' }].map((r) => (
                <div key={r.label} className="rag-flow__result-stat"><span className="rag-flow__result-stat-label">{r.label}</span><span className="rag-flow__result-stat-value">{r.value}</span></div>
              ))}
            </div>
          </Column>
        </Grid>
        <div className="hiw-mt-07">
          <div className="hiw-section__label">Detailed Feature Matrix</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="comparison-table">
              <thead><tr><th>Dimension</th><th>Normal RAG</th><th>Graph RAG</th><th>Winner</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.dim}>
                    <td><strong>{row.dim}</strong></td>
                    <td className={row.winner === 'normal' ? 'comparison-table__winner' : 'comparison-table__loser'}>{row.winner === 'normal' && <span className="comparison-table__check">✓ </span>}{row.normal}</td>
                    <td className={row.winner === 'graph' ? 'comparison-table__winner' : 'comparison-table__loser'}>{row.winner === 'graph' && <span className="comparison-table__check">✓ </span>}{row.graph}</td>
                    <td>
                      {row.winner === 'graph'  && <span style={{ color: '#be84ff', fontWeight: 600 }}>Graph RAG</span>}
                      {row.winner === 'normal' && <span style={{ color: '#78a9ff', fontWeight: 600 }}>Normal RAG</span>}
                      {row.winner === 'tie'    && <span style={{ color: '#c6c6c6' }}>Context-dependent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="hiw-callout hiw-callout--success hiw-mt-07">
          <div className="hiw-callout__title">🏆 When to Use Graph RAG</div>
          <div className="hiw-callout__body">Use Graph RAG when your data has rich relationships (like ITSM entities) and queries require understanding connections between entities. The extra latency (~0.9s) is worth it for the significantly richer context and more complete answers.</div>
        </div>
        <div className="hiw-callout hiw-callout--info hiw-mt-05">
          <div className="hiw-callout__title">⚡ When to Use Normal RAG</div>
          <div className="hiw-callout__body">Use Normal RAG for simple factual lookups where speed matters and the answer can be found in a single document. It is faster, simpler, and requires no graph link metadata.</div>
        </div>
      </div>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function HowItWorks() {
  return (
    <div style={{ paddingBlockStart: '2rem' }}>
      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%)', padding: '3rem 2rem', borderBottom: '1px solid #393939', marginBottom: '0' }}>
        <div style={{ fontSize: '0.75rem', color: '#78a9ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DataBase size={14} /> DataStax Astra DB · IBM watsonx · Enterprise ITSM
        </div>
        <h2 style={{ margin: '0 0 1rem', fontSize: '2rem', color: '#ffffff' }}>
          Graph RAG vs <span style={{ color: '#78a9ff' }}>Normal RAG</span> — Visual Explainer
        </h2>
        <p style={{ color: '#c6c6c6', maxWidth: '640px', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Understand how data is stored in Astra DB as vector + graph documents, and see the fundamental
          difference between pure vector similarity search (Normal RAG) and relationship-aware graph
          traversal (Graph RAG) — using real Enterprise ITSM data as the example domain.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { label: 'Astra DB', color: '#78a9ff', bg: 'rgba(120,169,255,0.15)', border: 'rgba(120,169,255,0.3)' },
            { label: '🧠 IBM watsonx', color: '#be84ff', bg: 'rgba(190,132,255,0.15)', border: 'rgba(190,132,255,0.3)' },
            { label: 'Graph RAG', color: '#42be65', bg: 'rgba(66,190,101,0.15)', border: 'rgba(66,190,101,0.3)' },
            { label: 'Normal RAG', color: '#ff832b', bg: 'rgba(255,131,43,0.15)', border: 'rgba(255,131,43,0.3)' },
          ].map((b) => (
            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 600, color: b.color, background: b.bg, border: `1px solid ${b.border}` }}>{b.label}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Grid>
        <Column sm={4} md={8} lg={16}>
          <Tabs style={{ marginBlockStart: '2rem' }}>
            <TabList aria-label="How It Works sections">
              <Tab renderIcon={DataBase}>Data Storage</Tab>
              <Tab renderIcon={Search}>Normal RAG</Tab>
              <Tab renderIcon={ChartNetwork}>Graph RAG</Tab>
              <Tab renderIcon={Compare}>Comparison</Tab>
            </TabList>
            <TabPanels>
              <TabPanel><DataStorageTab /></TabPanel>
              <TabPanel><NormalRAGTab /></TabPanel>
              <TabPanel><GraphRAGTab /></TabPanel>
              <TabPanel><ComparisonTab /></TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
