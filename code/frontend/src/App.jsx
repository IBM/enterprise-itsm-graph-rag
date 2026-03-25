
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Theme,
  Content,
  Grid,
  Column,
  Tile,
  Button,
  TextInput,
  Tag,
  Loading,
  InlineNotification,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Accordion,
  AccordionItem,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  ProgressBar,
  InlineLoading,
  SkeletonText,
  ContentSwitcher,
  Switch,
} from '@carbon/react';
import {
  Search,
  Compare,
  DataBase,
  NetworkOverlay,
  ChartLine,
  Idea,
  Renew,
  CloudUpload,
  CheckmarkFilled,
  ErrorFilled,
} from '@carbon/icons-react';

import GraphVisualization from './components/GraphVisualization';
import HowItWorks from './components/HowItWorks';
import {
  queryNormalRAG,
  queryGraphRAG,
  lookupByTicket,
  getMetrics,
  getDataStatus,
  populateData,
  getPopulateStatus,
  getSampleQuestions,
} from './services/api';

// ─────────────────────────────────────────────
// Simple factual query detector
// ─────────────────────────────────────────────
function isSimpleFactualQuery(q) {
  if (!q) return false;
  const lower = q.toLowerCase();

  const directLookupPatterns = [
    /\bwhat is\b.*\b(status|state|priority|description|details|title|category)\b/,
    /\bshow me\b.*\b(incident|problem|change|kb|article)\b/,
    /\bdetails (of|about|for)\b/,
    /\b(inc|prb|chg|kb)\d{4,}\b/i,
    /\bwhat (happened|is the)\b/,
    /\bhow (to|do I)\b/,
    /\bsteps to\b/,
    /\bworkaround for\b/,
    /\broot cause of\b/,
  ];

  const relationshipPatterns = [
    /\blinked to\b/,
    /\bimpact chain\b/,
    /\bdownstream\b/,
    /\ball (incidents|problems|changes|services)\b/,
    /\brelationship between\b/,
    /\bfull (impact|chain|history)\b/,
    /\btrace\b/,
    /\bwhich (services|servers|systems) were affected\b/,
    /\brecurring\b/,
    /\bmost frequently\b/,
    /\bassociated (configuration|change|problem|incident)\b/,
    /\bunderlying infrastructure\b/,
    /\blinked incidents\b/,
  ];

  const isSimple = directLookupPatterns.some(p => p.test(lower));
  const isComplex = relationshipPatterns.some(p => p.test(lower));
  return isSimple && !isComplex;
}

// ─────────────────────────────────────────────
// RAG comparison explanation logic
// ─────────────────────────────────────────────
function analyzeComparison(normalResult, graphResult, query = '') {
  if (!normalResult || !graphResult) return null;

  const normalSources = normalResult.num_sources;
  const graphSources = graphResult.num_sources;
  const normalTime = normalResult.retrieval_time;
  const graphTime = graphResult.retrieval_time;
  const normalTotal = normalResult.total_time;
  const graphTotal = graphResult.total_time;
  const traversalNodes = graphResult.traversal_path?.length || 0;

  const normalAnswerLen = normalResult.answer?.length || 0;
  const graphAnswerLen = graphResult.answer?.length || 0;
  const answerLenRatio = graphAnswerLen / Math.max(normalAnswerLen, 1);

  const graphOverhead = traversalNodes - normalSources;
  const timeOverheadRatio = graphTotal / Math.max(normalTotal, 0.001);

  const normalTypes = new Set(normalResult.sources?.map(s => s.metadata?.type) || []).size;
  const graphTypes = new Set(graphResult.sources?.map(s => s.metadata?.type) || []).size;
  const graphMoreDiverse = graphTypes > normalTypes;

  const queryIsSimple = isSimpleFactualQuery(query);

  let winner = 'tie';
  let explanation = '';
  let recommendation = '';

  if (queryIsSimple && !graphMoreDiverse && answerLenRatio < 1.3) {
    winner = 'normal';
    explanation = `This is a direct factual lookup — vector similarity search is sufficient to find the answer. Normal RAG retrieved ${normalSources} sources in ${normalTotal.toFixed(2)}s. Graph RAG traversed ${traversalNodes} nodes in ${graphTotal.toFixed(2)}s (${timeOverheadRatio.toFixed(1)}× slower) but ${graphMoreDiverse ? 'found more entity types' : 'found no additional entity types'} and produced an answer only ${((answerLenRatio - 1) * 100).toFixed(0)}% longer. For single-entity factual queries, the graph traversal overhead is unnecessary.`;
    recommendation = `Normal RAG is the better choice here. This query asks for a specific fact (status, description, steps, or fields) that vector search retrieves directly from the most relevant document. Graph traversal adds ${((timeOverheadRatio - 1) * 100).toFixed(0)}% latency with no quality benefit for this query type.`;
  } else if (!queryIsSimple && (graphMoreDiverse || graphOverhead > 2 || answerLenRatio > 1.15)) {
    winner = 'graph';
    const diversityNote = graphMoreDiverse
      ? ` across ${graphTypes} entity types (vs Normal RAG's ${normalTypes})`
      : '';
    explanation = `Graph RAG retrieved ${graphSources} sources${diversityNote} by traversing ${traversalNodes} nodes — ${Math.max(graphOverhead, 0)} more than Normal RAG's ${normalSources} sources. ${answerLenRatio > 1.15 ? `Its answer is ${((answerLenRatio - 1) * 100).toFixed(0)}% richer in content, ` : ''}surfacing relationship chains (incidents → problems → changes → CIs) that pure vector similarity missed.`;
    recommendation = `Graph RAG is the better choice here. This query requires understanding relationships between ITSM entities. The ${((timeOverheadRatio - 1) * 100).toFixed(0)}% extra latency is justified by the richer, more connected context it provides.`;
  } else {
    winner = 'tie';
    explanation = `Both approaches produced comparable results. Normal RAG retrieved ${normalSources} sources in ${normalTotal.toFixed(2)}s; Graph RAG retrieved ${graphSources} sources in ${graphTotal.toFixed(2)}s traversing ${traversalNodes} nodes. The answers are of similar length (${((answerLenRatio - 1) * 100).toFixed(0)}% difference) and entity type diversity is the same.`;
    recommendation = `For this query type, both approaches are comparable. Prefer Normal RAG for lower latency in production; use Graph RAG when you need to guarantee relationship context is captured.`;
  }

  return { winner, explanation, recommendation, traversalNodes, normalSources, graphSources, normalTime, graphTime, normalTotal, graphTotal, normalTypes, graphTypes, answerLenRatio, timeOverheadRatio };
}

function ComparisonInsight({ normalResult, graphResult, query }) {
  const analysis = analyzeComparison(normalResult, graphResult, query);
  if (!analysis) return null;

  const {
    winner, explanation, recommendation,
    traversalNodes, normalSources, graphSources,
    normalTime, graphTime, normalTotal, graphTotal,
    normalTypes, graphTypes, answerLenRatio, timeOverheadRatio,
  } = analysis;

  const winnerColor = winner === 'graph' ? '#42be65' : winner === 'normal' ? '#0f62fe' : '#f1c21b';
  const winnerLabel = winner === 'graph' ? '🔴 Graph RAG' : winner === 'normal' ? '🟢 Normal RAG' : '🟡 Tie';
  const winnerBadgeType = winner === 'graph' ? 'green' : winner === 'normal' ? 'blue' : 'warm-gray';

  return (
    <Tile style={{ marginBottom: '2rem', borderLeft: `4px solid ${winnerColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Idea size={24} style={{ color: winnerColor }} />
        <h4 style={{ margin: 0 }}>RAG Comparison Analysis</h4>
        <Tag type={winnerBadgeType} style={{ marginLeft: 'auto', fontWeight: 600 }}>
          Winner: {winnerLabel}
        </Tag>
      </div>

      <p style={{ color: '#c6c6c6', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        {explanation}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#262626', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <Tag type="blue" size="sm">N: {normalSources}</Tag>
            <Tag type="green" size="sm">G: {graphSources}</Tag>
          </div>
        </div>
        <div style={{ background: '#262626', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retrieval</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <Tag type="blue" size="sm">N: {normalTime.toFixed(2)}s</Tag>
            <Tag type="green" size="sm">G: {graphTime.toFixed(2)}s</Tag>
          </div>
        </div>
        <div style={{ background: '#262626', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Time</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <Tag type="blue" size="sm">N: {normalTotal.toFixed(2)}s</Tag>
            <Tag type="green" size="sm">G: {graphTotal.toFixed(2)}s</Tag>
          </div>
          <div style={{ fontSize: '0.7rem', color: timeOverheadRatio > 1.3 ? '#fa4d56' : '#42be65', marginTop: '0.3rem' }}>
            {timeOverheadRatio.toFixed(1)}× overhead
          </div>
        </div>
        <div style={{ background: '#262626', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity Types</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <Tag type="blue" size="sm">N: {normalTypes}</Tag>
            <Tag type="green" size="sm">G: {graphTypes}</Tag>
          </div>
          <div style={{ fontSize: '0.7rem', color: graphTypes > normalTypes ? '#42be65' : '#8d8d8d', marginTop: '0.3rem' }}>
            {graphTypes > normalTypes ? '↑ more diverse' : 'same diversity'}
          </div>
        </div>
        <div style={{ background: '#262626', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traversal</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Tag type="purple" size="sm">{traversalNodes} nodes</Tag>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#8d8d8d', marginTop: '0.3rem' }}>
            answer {answerLenRatio > 1 ? `+${((answerLenRatio - 1) * 100).toFixed(0)}%` : `${((answerLenRatio - 1) * 100).toFixed(0)}%`} richer
          </div>
        </div>
      </div>

      <div style={{
        background: winner === 'normal' ? '#0a1f3d' : winner === 'graph' ? '#1c3a1c' : '#2d2a1a',
        border: `1px solid ${winnerColor}`,
        borderRadius: '4px',
        padding: '0.75rem',
      }}>
        <strong style={{ color: winnerColor, fontSize: '0.875rem' }}>💡 Recommendation: </strong>
        <span style={{ color: '#c6c6c6', fontSize: '0.875rem' }}>{recommendation}</span>
      </div>
    </Tile>
  );
}

// ─────────────────────────────────────────────
// Sample Queries Panel — dynamic questions
// ─────────────────────────────────────────────
function SampleQueriesPanel({ onSelect, questions, loading }) {
  if (loading) {
    return (
      <Tile style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <DataBase size={20} />
          <h4 style={{ margin: 0 }}>Sample Queries</h4>
          <InlineLoading description="Loading questions from your data..." style={{ marginLeft: '0.5rem' }} />
        </div>
        <SkeletonText paragraph lineCount={4} />
      </Tile>
    );
  }

  if (!questions) return null;

  const groups = [
    {
      key: 'easy',
      label: '🟢 Direct Lookups',
      description: 'Single-entity factual queries — Normal RAG typically wins here (lower latency, sufficient context)',
      queries: questions.easy || [],
    },
    {
      key: 'medium',
      label: '🟡 Filtered Queries',
      description: 'Queries filtered by priority, state, or type — both approaches competitive',
      queries: questions.medium || [],
    },
    {
      key: 'complex',
      label: '🔴 Relationship Traversal',
      description: 'Impact chain and cross-entity queries — Graph RAG wins here (BFS traversal surfaces linked records)',
      queries: questions.complex || [],
    },
  ];

  return (
    <Tile style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <DataBase size={20} />
        <h4 style={{ margin: 0 }}>Sample Queries</h4>
        <span style={{ color: '#8d8d8d', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
          Click any query to populate the input
        </span>
        <Tag type="teal" size="sm" style={{ marginLeft: 'auto' }}>
          {questions.total || 0} questions from your data
        </Tag>
      </div>

      <Accordion>
        {groups.map(group => (
          <AccordionItem
            key={group.key}
            title={<span style={{ fontWeight: 500 }}>{group.label}</span>}
          >
            <p style={{ color: '#8d8d8d', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              {group.description}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {group.queries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(q)}
                  style={{
                    background: '#262626',
                    border: '1px solid #393939',
                    borderRadius: '4px',
                    padding: '0.625rem 0.875rem',
                    color: '#f4f4f4',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#353535';
                    e.currentTarget.style.borderColor = '#0f62fe';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#262626';
                    e.currentTarget.style.borderColor = '#393939';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </AccordionItem>
        ))}
      </Accordion>
    </Tile>
  );
}

// ─────────────────────────────────────────────
// Inline Populate Panel — shown on the home page when collection is empty
// Replaces the full-screen PopulateScreen redirect.
// ─────────────────────────────────────────────
function InlinePopulatePanel({ onPopulateComplete }) {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [jobState, setJobState] = useState(null);
  const pollRef = useRef(null);

  const startPopulate = async () => {
    try {
      setStatus('running');
      const initial = await populateData();
      setJobState(initial);
      // Poll every 2 seconds while running
      pollRef.current = setInterval(async () => {
        try {
          const s = await getPopulateStatus();
          setJobState(s);
          if (s.status === 'done') {
            clearInterval(pollRef.current);
            setStatus('done');
            // Give the user 1.5s to see the success state, then unlock the query UI
            setTimeout(() => onPopulateComplete(), 1500);
          } else if (s.status === 'error') {
            clearInterval(pollRef.current);
            setStatus('error');
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, 2000);
    } catch (err) {
      setStatus('error');
      setJobState({ error: err.message || 'Failed to start population' });
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const progress = jobState?.progress || 0;
  const message = jobState?.message || '';
  const ingested = jobState?.ingested_docs || 0;
  const total = jobState?.total_docs || 0;

  return (
    <Tile style={{ marginBottom: '2rem', borderLeft: '4px solid #0f62fe' }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <DataBase size={24} style={{ color: '#0f62fe' }} />
        <h4 style={{ margin: 0 }}>No Data in Astra DB</h4>
        <Tag type="red" size="sm" style={{ marginLeft: 'auto' }}>Collection Empty</Tag>
      </div>

      {status === 'idle' && (
        <>
          <p style={{ color: '#c6c6c6', marginBottom: '0.75rem', lineHeight: 1.6 }}>
            The <strong>itsm_documents</strong> collection is empty. Generate and ingest
            1,370 synthetic ITSM documents (incidents, problems, changes, KB articles,
            configuration items, and business services) with IBM watsonx embeddings to
            enable the RAG query interface.
          </p>
          <p style={{ color: '#6f6f6f', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Estimated time: 5–10 minutes depending on API rate limits.
          </p>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <Button renderIcon={CloudUpload} onClick={startPopulate}>
              Populate Data
            </Button>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Tag type="blue" size="sm">IBM watsonx Embeddings</Tag>
              <Tag type="purple" size="sm">Granite-3-8B LLM</Tag>
              <Tag type="teal" size="sm">Astra DB Vector Store</Tag>
            </div>
          </div>

          {/* What gets generated — compact grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
            {[
              { label: 'Incidents', count: '800', color: '#fa4d56' },
              { label: 'Changes', count: '200', color: '#f1c21b' },
              { label: 'Problems', count: '80', color: '#ff832b' },
              { label: 'KB Articles', count: '150', color: '#42be65' },
              { label: 'Config Items', count: '120', color: '#0f62fe' },
              { label: 'Services', count: '20', color: '#8a3ffc' },
            ].map(item => (
              <div key={item.label} style={{ background: '#262626', padding: '0.625rem', borderRadius: '4px', textAlign: 'center', borderTop: `2px solid ${item.color}` }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: item.color }}>{item.count}</div>
                <div style={{ fontSize: '0.75rem', color: '#c6c6c6' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {status === 'running' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <InlineLoading
              description={message || 'Generating and ingesting ITSM data...'}
              status="active"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            {progress < 5 ? (
              <ProgressBar
                label="Preparing..."
                helperText="Generating ITSM data in-memory..."
                status="active"
              />
            ) : (
              <ProgressBar
                value={progress}
                max={100}
                label={`${progress}% complete`}
                helperText={
                  total > 0
                    ? `${ingested.toLocaleString()} / ${total.toLocaleString()} documents ingested`
                    : message || 'Preparing documents...'
                }
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Tag type="blue" size="sm">Generating ITSM data in-memory</Tag>
            <Tag type="purple" size="sm">Embedding with watsonx</Tag>
            <Tag type="teal" size="sm">Inserting into Astra DB</Tag>
          </div>
        </>
      )}

      {status === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckmarkFilled size={24} style={{ color: '#42be65' }} />
          <div>
            <p style={{ color: '#42be65', fontWeight: 600, margin: 0 }}>
              Data Populated — {ingested.toLocaleString()} documents ingested
            </p>
            <p style={{ color: '#8d8d8d', fontSize: '0.875rem', margin: 0 }}>
              Loading the query interface...
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <ErrorFilled size={24} style={{ color: '#fa4d56', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fa4d56', fontWeight: 600, margin: '0 0 0.5rem' }}>Population Failed</p>
            <p style={{ color: '#ffb3b8', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              {jobState?.error || 'An unexpected error occurred.'}
            </p>
            <Button
              renderIcon={Renew}
              kind="secondary"
              size="sm"
              onClick={() => { setStatus('idle'); setJobState(null); }}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
    </Tile>
  );
}

// ─────────────────────────────────────────────
// Ticket number detector
// ─────────────────────────────────────────────
function extractTicketNumber(text) {
  const match = text.match(/\b(INC|PRB|CHG|KB)\d{4,}\b/i);
  return match ? match[0].toUpperCase() : null;
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
function App() {
  // Data population state
  const [dataStatus, setDataStatus] = useState(null);   // null = checking
  const [dataStatusLoading, setDataStatusLoading] = useState(true);

  // Sample questions
  const [sampleQuestions, setSampleQuestions] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Query state
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Results
  const [normalResult, setNormalResult] = useState(null);
  const [graphResult, setGraphResult] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [metrics, setMetrics] = useState(null);

  // Active tab
  const [selectedTab, setSelectedTab] = useState(0);

  // Detected ticket number in current query
  const detectedTicket = extractTicketNumber(question);

  // ── Check data status on mount ──
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getDataStatus();
        setDataStatus(status);
      } catch (err) {
        // Backend not ready yet — treat as unpopulated
        setDataStatus({ populated: false, document_count: 0, message: 'Backend not reachable' });
      } finally {
        setDataStatusLoading(false);
      }
    };
    checkStatus();
  }, []);

  // ── Load sample questions once data is confirmed populated ──
  const loadSampleQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const qs = await getSampleQuestions();
      setSampleQuestions(qs);
    } catch (err) {
      // Non-fatal — fall back to null (panel won't render)
      setSampleQuestions(null);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dataStatus?.populated) {
      loadSampleQuestions();
    }
  }, [dataStatus, loadSampleQuestions]);

  // ── Called when PopulateScreen finishes ──
  const handlePopulateComplete = useCallback(async () => {
    // Re-check data status
    try {
      const status = await getDataStatus();
      setDataStatus(status);
    } catch {
      setDataStatus({ populated: true, document_count: 0, message: 'Populated' });
    }
  }, []);

  // ── Query handler ──
  const handleQuery = async (type) => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError(null);
    setLookupResult(null);

    try {
      const ticket = extractTicketNumber(question);

      if (type === 'lookup' && ticket) {
        const result = await lookupByTicket(ticket, true);
        setLookupResult(result);
        setSelectedTab(5);
      } else if (type === 'normal') {
        const result = await queryNormalRAG(question, 5);
        setNormalResult(result);
        setSelectedTab(0);
      } else if (type === 'graph') {
        const result = await queryGraphRAG(question, 10);
        setGraphResult(result);
        setSelectedTab(1);
      } else if (type === 'both') {
        const [normalRes, graphRes] = await Promise.all([
          queryNormalRAG(question, 5),
          queryGraphRAG(question, 10),
        ]);
        setNormalResult(normalRes);
        setGraphResult(graphRes);
        setSelectedTab(2);
      }

      const metricsData = await getMetrics();
      setMetrics(metricsData);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleSelect = (q) => setQuestion(q);

  const renderAnswer = (result, title) => {
    if (!result) return null;

    return (
      <Tile style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>{title}</h4>
        <div style={{
          padding: '1rem',
          background: '#262626',
          borderRadius: '4px',
          marginBottom: '1rem',
          borderLeft: '4px solid #0f62fe',
        }}>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result.answer}</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Tag type="blue">Sources: {result.num_sources}</Tag>
          <Tag type="green">Retrieval: {result.retrieval_time.toFixed(3)}s</Tag>
          <Tag type="purple">Generation: {result.generation_time.toFixed(3)}s</Tag>
          <Tag type="gray">Total: {result.total_time.toFixed(3)}s</Tag>
          {result.traversal_path && (
            <Tag type="teal">Traversal nodes: {result.traversal_path.length}</Tag>
          )}
        </div>

        <h5 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Retrieved Sources</h5>
        <StructuredListWrapper>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>Type</StructuredListCell>
              <StructuredListCell head>Content</StructuredListCell>
              <StructuredListCell head>Score</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {result.sources.map((source, idx) => (
              <StructuredListRow key={idx}>
                <StructuredListCell>
                  <Tag size="sm" type="cool-gray">
                    {source.metadata.type?.replace('_', ' ')}
                  </Tag>
                </StructuredListCell>
                <StructuredListCell>
                  <div style={{ maxWidth: '500px', fontSize: '0.875rem' }}>
                    {source.content.substring(0, 150)}...
                  </div>
                </StructuredListCell>
                <StructuredListCell>
                  {source.score ? source.score.toFixed(3) : 'N/A'}
                </StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>
      </Tile>
    );
  };

  const [activePage, setActivePage] = useState('demo');

  // ── Loading state while checking data status ──
  // ── Always render the main layout (no full-screen redirect) ──
  return (
    <Theme theme="g100">
      <Content style={{ background: '#161616', minHeight: '100vh', padding: '2rem' }}>
        <Grid>
          <Column lg={16} md={8} sm={4}>
            {/* Header — always visible */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <NetworkOverlay size={32} style={{ color: '#0f62fe' }} />
                <h1 style={{ margin: 0 }}>Enterprise ITSM Graph RAG Demo</h1>
                <Button
                  renderIcon={Renew}
                  kind="ghost"
                  size="sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={async () => {
                    try {
                      const status = await getDataStatus();
                      setDataStatus(status);
                      if (status.populated) loadSampleQuestions();
                    } catch {}
                  }}
                  title="Refresh data status"
                >
                  Refresh
                </Button>
              </div>
              <p style={{ color: '#c6c6c6' }}>
                Compare Normal RAG (vector-only) vs Graph RAG (vector + relationship traversal) on real ITSM data
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <Tag type="blue">IBM watsonx Embeddings</Tag>
                <Tag type="purple">Granite-3-8B LLM</Tag>
                <Tag type="teal">Astra DB Vector Store</Tag>
                {dataStatus?.document_count > 0 && (
                  <Tag type="cool-gray">
                    {dataStatus.document_count.toLocaleString()} Documents
                  </Tag>
                )}
              </div>
              <ContentSwitcher
                selectedIndex={activePage === 'demo' ? 0 : 1}
                onChange={({ name }) => setActivePage(name)}
                style={{ marginTop: '1rem', maxWidth: '320px' }}
              >
                <Switch name="demo" text="Demo" />
                <Switch name="docs" text="How It Works" />
              </ContentSwitcher>
            </div>

            {/* ── How It Works page ── */}
            {activePage === 'docs' && <HowItWorks />}

            {/* ── Demo page ── */}
            {activePage === 'demo' && <>

            {/* ── Loading spinner while checking data status ── */}
            {dataStatusLoading && (
              <Tile style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Loading description="Checking data status..." withOverlay={false} small />
                <p style={{ color: '#8d8d8d', margin: 0 }}>Connecting to Astra DB...</p>
              </Tile>
            )}

            {/* ── Inline populate panel — only when collection is empty ── */}
            {!dataStatusLoading && !dataStatus?.populated && (
              <InlinePopulatePanel onPopulateComplete={handlePopulateComplete} />
            )}

            {/* ── Sample Queries Panel — only when data is available ── */}
            {dataStatus?.populated && (
              <SampleQueriesPanel
                onSelect={handleSampleSelect}
                questions={sampleQuestions}
                loading={questionsLoading}
              />
            )}

            {/* ── Query Input + Results — only when data is available ── */}
            {dataStatus?.populated && <Tile style={{ marginBottom: '2rem' }}>
              <TextInput
                id="question-input"
                labelText="Ask a question about IT operations"
                placeholder="Type a question or a ticket number (e.g. INC0000031, PRB0000001, KB0000002)..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    detectedTicket ? handleQuery('lookup') : handleQuery('both');
                  }
                }}
                disabled={loading}
                style={{ marginBottom: '0.75rem' }}
              />

              {/* Ticket number detected banner */}
              {detectedTicket && (
                <div style={{
                  background: '#0a1f3d',
                  border: '1px solid #0f62fe',
                  borderRadius: '4px',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                }}>
                  <DataBase size={16} style={{ color: '#0f62fe', flexShrink: 0 }} />
                  <span style={{ color: '#c6c6c6' }}>
                    Ticket number detected: <strong style={{ color: '#78a9ff' }}>{detectedTicket}</strong>
                    {' '}— clicking <strong>Lookup Ticket</strong> will use direct metadata filter (exact match, no vector search).
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button renderIcon={Search} onClick={() => handleQuery('normal')} disabled={loading}>
                  Normal RAG
                </Button>
                <Button renderIcon={Search} onClick={() => handleQuery('graph')} disabled={loading} kind="secondary">
                  Graph RAG
                </Button>
                <Button renderIcon={Compare} onClick={() => handleQuery('both')} disabled={loading} kind="tertiary">
                  Compare Both
                </Button>
                {detectedTicket && (
                  <Button
                    renderIcon={DataBase}
                    onClick={() => handleQuery('lookup')}
                    disabled={loading}
                    kind="danger--tertiary"
                  >
                    Lookup {detectedTicket}
                  </Button>
                )}
              </div>

              {loading && (
                <div style={{ marginTop: '1rem' }}>
                  <Loading description="Processing query with IBM watsonx..." withOverlay={false} />
                </div>
              )}

              {error && (
                <InlineNotification
                  kind="error"
                  title="Error"
                  subtitle={error}
                  onCloseButtonClick={() => setError(null)}
                  style={{ marginTop: '1rem' }}
                />
              )}
            </Tile>}

            {/* Comparison Insight */}
            {normalResult && graphResult && (
              <ComparisonInsight normalResult={normalResult} graphResult={graphResult} query={question} />
            )}

            {/* Results Tabs */}
            {(normalResult || graphResult || lookupResult) && (
              <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
                <TabList aria-label="Results tabs">
                  <Tab disabled={!normalResult}>Normal RAG</Tab>
                  <Tab disabled={!graphResult}>Graph RAG</Tab>
                  <Tab disabled={!normalResult || !graphResult}>Side-by-Side</Tab>
                  <Tab disabled={!graphResult}>Graph Visualization</Tab>
                  <Tab disabled={!metrics}>Metrics</Tab>
                  <Tab disabled={!lookupResult}>🔍 Ticket Lookup</Tab>
                </TabList>
                <TabPanels>
                  {/* Normal RAG Results */}
                  <TabPanel>{renderAnswer(normalResult, 'Normal RAG Answer')}</TabPanel>

                  {/* Graph RAG Results */}
                  <TabPanel>{renderAnswer(graphResult, 'Graph RAG Answer')}</TabPanel>

                  {/* Side-by-Side Comparison */}
                  <TabPanel>
                    <Grid>
                      <Column lg={8} md={4} sm={4}>{renderAnswer(normalResult, 'Normal RAG')}</Column>
                      <Column lg={8} md={4} sm={4}>{renderAnswer(graphResult, 'Graph RAG')}</Column>
                    </Grid>
                  </TabPanel>

                  {/* Graph Visualization */}
                  <TabPanel>
                    <Tile>
                      <h4 style={{ marginBottom: '1rem' }}>Knowledge Graph Traversal</h4>
                      <GraphVisualization traversalPath={graphResult?.traversal_path} />
                    </Tile>
                  </TabPanel>

                  {/* Metrics */}
                  <TabPanel>
                    {metrics && (
                      <Tile>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                          <ChartLine size={24} style={{ marginRight: '0.5rem' }} />
                          <h4>Performance Metrics</h4>
                        </div>
                        <Grid>
                          <Column lg={8} md={4} sm={4}>
                            <div style={{ marginBottom: '1rem' }}>
                              <h5 style={{ marginBottom: '0.5rem' }}>Query Statistics</h5>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Tag type="blue">Total: {metrics.total_queries}</Tag>
                                <Tag type="green">Normal: {metrics.normal_rag_queries}</Tag>
                                <Tag type="purple">Graph: {metrics.graph_rag_queries}</Tag>
                              </div>
                            </div>
                          </Column>
                          <Column lg={8} md={4} sm={4}>
                            <div style={{ marginBottom: '1rem' }}>
                              <h5 style={{ marginBottom: '0.5rem' }}>Average Retrieval Time</h5>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Tag type="green">Normal: {metrics.avg_normal_retrieval_time.toFixed(3)}s</Tag>
                                <Tag type="purple">Graph: {metrics.avg_graph_retrieval_time.toFixed(3)}s</Tag>
                              </div>
                            </div>
                          </Column>
                          <Column lg={8} md={4} sm={4}>
                            <div>
                              <h5 style={{ marginBottom: '0.5rem' }}>Average Sources Retrieved</h5>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Tag type="green">Normal: {metrics.avg_normal_sources.toFixed(1)}</Tag>
                                <Tag type="purple">Graph: {metrics.avg_graph_sources.toFixed(1)}</Tag>
                              </div>
                            </div>
                          </Column>
                        </Grid>
                      </Tile>
                    )}
                  </TabPanel>

                  {/* Ticket Lookup Results */}
                  <TabPanel>
                    {lookupResult && (
                      <Tile>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                          <DataBase size={24} style={{ color: '#0f62fe' }} />
                          <h4 style={{ margin: 0 }}>Direct Ticket Lookup: {lookupResult.ticket_number}</h4>
                          <Tag type={lookupResult.found ? 'green' : 'red'} style={{ marginLeft: 'auto' }}>
                            {lookupResult.found ? '✅ Found' : '❌ Not Found'}
                          </Tag>
                        </div>

                        {lookupResult.found ? (
                          <>
                            <div style={{ background: '#0a1f3d', border: '1px solid #0f62fe', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                              <strong style={{ color: '#78a9ff' }}>🔍 How this works: </strong>
                              <span style={{ color: '#c6c6c6' }}>
                                Instead of vector similarity search, this used a direct <code style={{ color: '#42be65' }}>metadata.number = "{lookupResult.ticket_number}"</code> filter query against Astra DB.
                                Retrieved in <strong>{lookupResult.retrieval_time.toFixed(3)}s</strong> with exact match (score: 1.0).
                                {lookupResult.graph_context?.length > 0 && ` Then traversed ${lookupResult.graph_context.length} linked documents from the graph.`}
                              </span>
                            </div>

                            <div style={{ padding: '1rem', background: '#262626', borderRadius: '4px', marginBottom: '1rem', borderLeft: '4px solid #0f62fe' }}>
                              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{lookupResult.answer}</p>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                              <Tag type="blue">Retrieval: {lookupResult.retrieval_time.toFixed(3)}s</Tag>
                              <Tag type="purple">Generation: {lookupResult.generation_time.toFixed(3)}s</Tag>
                              <Tag type="gray">Total: {lookupResult.total_time.toFixed(3)}s</Tag>
                              {lookupResult.graph_context?.length > 0 && (
                                <Tag type="teal">Linked docs: {lookupResult.graph_context.length}</Tag>
                              )}
                            </div>

                            {lookupResult.document && (
                              <>
                                <h5 style={{ marginBottom: '0.5rem' }}>Source Document (Exact Match)</h5>
                                <div style={{ background: '#1c2a1c', border: '1px solid #42be65', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                    <Tag type="green" size="sm">Score: 1.000 (exact)</Tag>
                                    <Tag type="cool-gray" size="sm">{lookupResult.document.metadata?.type?.replace('_', ' ')}</Tag>
                                  </div>
                                  <p style={{ color: '#c6c6c6', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {lookupResult.document.content}
                                  </p>
                                </div>
                              </>
                            )}

                            {lookupResult.graph_context?.length > 0 && (
                              <>
                                <h5 style={{ marginBottom: '0.5rem' }}>Linked Documents (Graph Traversal)</h5>
                                <StructuredListWrapper>
                                  <StructuredListHead>
                                    <StructuredListRow head>
                                      <StructuredListCell head>Type</StructuredListCell>
                                      <StructuredListCell head>Content</StructuredListCell>
                                    </StructuredListRow>
                                  </StructuredListHead>
                                  <StructuredListBody>
                                    {lookupResult.graph_context.map((doc, idx) => (
                                      <StructuredListRow key={idx}>
                                        <StructuredListCell>
                                          <Tag size="sm" type="cool-gray">
                                            {doc.metadata?.type?.replace('_', ' ')}
                                          </Tag>
                                        </StructuredListCell>
                                        <StructuredListCell>
                                          <div style={{ maxWidth: '600px', fontSize: '0.875rem' }}>
                                            {doc.content}
                                          </div>
                                        </StructuredListCell>
                                      </StructuredListRow>
                                    ))}
                                  </StructuredListBody>
                                </StructuredListWrapper>
                              </>
                            )}
                          </>
                        ) : (
                          <div style={{ background: '#2d1a1a', border: '1px solid #fa4d56', borderRadius: '4px', padding: '1rem' }}>
                            <p style={{ color: '#ffb3b8' }}>{lookupResult.answer}</p>
                          </div>
                        )}
                      </Tile>
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}

            </>}
          </Column>
        </Grid>
      </Content>
    </Theme>
  );
}

export default App;
