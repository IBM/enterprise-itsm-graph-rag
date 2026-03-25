/**
 * API Service — communicates with the FastAPI backend.
 *
 * Backend: FastAPI on port 8000 (Astra DB + IBM watsonx)
 * Endpoints:
 *   POST /query/normal       — Normal RAG (vector similarity only)
 *   POST /query/graph        — Graph RAG (vector + BFS traversal)
 *   POST /query/lookup       — Direct ticket lookup by number
 *   GET  /metrics            — Performance metrics
 *   POST /metrics/reset      — Reset metrics counters
 *   GET  /data-status        — Check if collection is populated
 *   POST /populate           — Trigger background data generation + ingestion
 *   GET  /populate/status    — Poll populate job progress
 *   GET  /sample-questions   — Dynamic questions from real ingested data
 *   GET  /                   — Health check
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Query using Normal RAG (vector similarity search only)
 * Returns top-k most similar documents + LLM-generated answer
 */
export const queryNormalRAG = async (question, topK = 5) => {
  const response = await api.post('/query/normal', {
    question,
    top_k: topK,
  });
  return response.data;
};

/**
 * Query using Graph RAG (vector search + BFS relationship traversal)
 * Seeds with top-3 documents, then traverses metadata.links to depth 2
 * Returns up to 10 documents + traversal path for visualization
 */
export const queryGraphRAG = async (question, topK = 10) => {
  const response = await api.post('/query/graph', {
    question,
    top_k: topK,
  });
  return response.data;
};

/**
 * Direct lookup by ticket number (INC/PRB/CHG/KB + digits)
 * Uses metadata filter — exact match, bypasses vector search
 * Optionally traverses graph from the found document
 */
export const lookupByTicket = async (ticketNumber, includeGraph = true) => {
  const response = await api.post('/query/lookup', {
    ticket_number: ticketNumber.trim().toUpperCase(),
    include_graph: includeGraph,
  });
  return response.data;
};

/** Get aggregated performance metrics */
export const getMetrics = async () => {
  const response = await api.get('/metrics');
  return response.data;
};

/** Reset metrics counters */
export const resetMetrics = async () => {
  const response = await api.post('/metrics/reset');
  return response.data;
};

/** Health check — returns backend status + Astra DB connection state */
export const healthCheck = async () => {
  const response = await api.get('/');
  return response.data;
};

/**
 * Check whether the Astra DB collection has been populated.
 * Returns { populated: bool, document_count: int, message: string }
 */
export const getDataStatus = async () => {
  const response = await api.get('/data-status');
  return response.data;
};

/**
 * Trigger background data generation + Astra DB ingestion.
 * Generates 1,370 synthetic ITSM documents in-memory, embeds them with
 * IBM watsonx, and inserts them into Astra DB.
 * Returns immediately — poll getPopulateStatus() for progress.
 */
export const populateData = async () => {
  const response = await api.post('/populate');
  return response.data;
};

/**
 * Poll the current status of the background populate job.
 * Returns {
 *   status: 'idle' | 'running' | 'done' | 'error',
 *   message: string,
 *   progress: number (0-100),
 *   total_docs: number,
 *   ingested_docs: number,
 *   started_at: string | null,
 *   finished_at: string | null,
 *   error: string | null,
 * }
 */
export const getPopulateStatus = async () => {
  const response = await api.get('/populate/status');
  return response.data;
};

/**
 * Fetch dynamically generated sample questions based on real data in Astra DB.
 * Returns { easy: string[], medium: string[], complex: string[], total: number }
 */
export const getSampleQuestions = async () => {
  const response = await api.get('/sample-questions');
  return response.data;
};

export default api;
