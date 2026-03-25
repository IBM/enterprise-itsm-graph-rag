"""
FastAPI Backend for Enterprise ITSM Graph RAG Demo
Provides endpoints for Normal RAG and Graph RAG queries,
plus on-demand data population and dynamic sample questions.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import re
import asyncio
from dotenv import load_dotenv
import time

from rag_pipelines import NormalRAG, GraphRAG, MetricsCollector

load_dotenv()

# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(
    title="Enterprise ITSM Graph RAG API",
    description="Compare Normal RAG vs Graph RAG for Enterprise ITSM queries",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Global instances
# ─────────────────────────────────────────────
normal_rag = None
graph_rag = None
metrics_collector = MetricsCollector()

# Populate job state — tracks background ingestion progress
populate_state = {
    "status": "idle",       # idle | running | done | error
    "message": "",
    "progress": 0,          # 0-100
    "total_docs": 0,
    "ingested_docs": 0,
    "started_at": None,
    "finished_at": None,
    "error": None,
}


# ─────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(..., description="User question")
    top_k: Optional[int] = Field(5, description="Number of documents to retrieve")


class LookupRequest(BaseModel):
    ticket_number: str = Field(..., description="Ticket number e.g. INC0000031, PRB0000001, CHG0000001, KB0000001")
    include_graph: Optional[bool] = Field(True, description="Also traverse graph from the found document")


class SourceDocument(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any]
    score: Optional[float] = None


class TraversalPath(BaseModel):
    node_id: str
    node_type: str
    depth: int
    content: str


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceDocument]
    retrieval_time: float
    generation_time: float
    total_time: float
    num_sources: int
    traversal_path: Optional[List[TraversalPath]] = None


class LookupResponse(BaseModel):
    ticket_number: str
    found: bool
    document: Optional[Dict[str, Any]] = None
    answer: str
    graph_context: Optional[List[Dict[str, Any]]] = None
    traversal_path: Optional[List[Dict[str, Any]]] = None
    retrieval_time: float
    generation_time: float
    total_time: float


class MetricsResponse(BaseModel):
    total_queries: int
    normal_rag_queries: int
    graph_rag_queries: int
    avg_normal_retrieval_time: float
    avg_graph_retrieval_time: float
    avg_normal_sources: float
    avg_graph_sources: float


class HealthResponse(BaseModel):
    status: str
    message: str
    astra_connected: bool
    embedding_provider: str


class PopulateStatusResponse(BaseModel):
    status: str
    message: str
    progress: int
    total_docs: int
    ingested_docs: int
    started_at: Optional[str]
    finished_at: Optional[str]
    error: Optional[str]


class DataStatusResponse(BaseModel):
    populated: bool
    document_count: int
    collection_name: str
    message: str


class SampleQuestion(BaseModel):
    query: str
    tier: str   # easy | medium | complex


class SampleQuestionsResponse(BaseModel):
    easy: List[str]
    medium: List[str]
    complex: List[str]
    total: int


# ─────────────────────────────────────────────
# Startup/Shutdown
# ─────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Initialize RAG pipelines on startup"""
    global normal_rag, graph_rag

    try:
        print("Initializing RAG pipelines...")
        normal_rag = NormalRAG()
        graph_rag = GraphRAG()
        print("RAG pipelines initialized successfully")
    except Exception as e:
        print(f"Error initializing RAG pipelines: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("Shutting down...")


# ─────────────────────────────────────────────
# Health Endpoints
# ─────────────────────────────────────────────
@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    astra_connected = False
    try:
        if normal_rag and normal_rag.collection:
            astra_connected = True
    except:
        pass

    return HealthResponse(
        status="healthy",
        message="Enterprise ITSM Graph RAG API is running",
        astra_connected=astra_connected,
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "watsonx")
    )


@app.get("/health")
async def health():
    """Lightweight health check for Docker/nginx healthcheck probes"""
    return {"status": "ok"}


# ─────────────────────────────────────────────
# Data Status Endpoint
# ─────────────────────────────────────────────
@app.get("/data-status", response_model=DataStatusResponse)
async def data_status():
    """
    Check whether the Astra DB collection has been populated.
    The UI calls this on load to decide whether to show the Populate screen
    or the query interface.
    """
    if not normal_rag or not normal_rag.collection:
        return DataStatusResponse(
            populated=False,
            document_count=0,
            collection_name=os.getenv("ASTRA_DB_COLLECTION", "itsm_documents"),
            message="RAG pipeline not initialized"
        )

    try:
        # Count documents — find_one is cheap; for a real count use estimated_document_count
        sample = list(normal_rag.collection.find({}, limit=1))
        if not sample:
            return DataStatusResponse(
                populated=False,
                document_count=0,
                collection_name=os.getenv("ASTRA_DB_COLLECTION", "itsm_documents"),
                message="Collection is empty — click Populate Data to generate and ingest ITSM documents"
            )

        # Estimate count by fetching up to 10 docs (cheap proxy)
        try:
            count = normal_rag.collection.estimated_document_count()
        except Exception:
            count = -1  # Not all SDK versions support this

        return DataStatusResponse(
            populated=True,
            document_count=count,
            collection_name=os.getenv("ASTRA_DB_COLLECTION", "itsm_documents"),
            message=f"Collection has documents — ready to query"
        )
    except Exception as e:
        return DataStatusResponse(
            populated=False,
            document_count=0,
            collection_name=os.getenv("ASTRA_DB_COLLECTION", "itsm_documents"),
            message=f"Could not check collection: {str(e)}"
        )


# ─────────────────────────────────────────────
# Populate Endpoint — background ingestion
# ─────────────────────────────────────────────
def _run_populate():
    """
    Synchronous worker that generates ITSM data in-memory and ingests it
    into Astra DB.

    Execution model:
      - Called via FastAPI BackgroundTasks.add_task() — runs in a thread pool
        inside the same process (single uvicorn worker, --workers 1).
      - Mutates the module-level populate_state dict directly; the GIL ensures
        dict key assignments are atomic so /populate/status reads are safe.

    Progress milestones:
      2%  → initialising
      3–13% → generating each entity type (services, CIs, problems, changes, KB, incidents)
      16–18% → preparing documents + connecting to Astra DB
      20–95% → batch ingestion (one update per batch)
      100% → done
    """
    global populate_state

    from dataclasses import asdict
    from data_generator import ITSMDataGenerator
    from ingest import (
        get_astra_collection,
        prepare_business_service_doc,
        prepare_ci_doc,
        prepare_incident_doc,
        prepare_change_doc,
        prepare_problem_doc,
        prepare_kb_doc,
        get_embeddings,
        BATCH_SIZE,
    )

    try:
        populate_state["status"] = "running"
        populate_state["message"] = "Initialising data generator..."
        populate_state["progress"] = 2
        populate_state["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # ── Step 1: Generate each entity type individually with progress updates ──
        # This replaces the single generate_all_data() call so the frontend sees
        # incremental progress during the generation phase (not just a frozen 0%).
        generator = ITSMDataGenerator()

        populate_state["message"] = "Generating business services (20)..."
        populate_state["progress"] = 3
        generator.generate_business_services(20)

        populate_state["message"] = "Generating configuration items (120)..."
        populate_state["progress"] = 5
        generator.generate_configuration_items(120)

        populate_state["message"] = "Generating problem records (80)..."
        populate_state["progress"] = 7
        generator.generate_problem_records(80)

        populate_state["message"] = "Generating change requests (200)..."
        populate_state["progress"] = 9
        generator.generate_change_requests(200)

        populate_state["message"] = "Generating KB articles (150)..."
        populate_state["progress"] = 11
        generator.generate_kb_articles(150)

        populate_state["message"] = "Generating incidents (800)..."
        populate_state["progress"] = 13
        generator.generate_incidents(800)

        # ── Step 2: Prepare documents for ingestion ──
        populate_state["message"] = "Preparing documents for ingestion..."
        populate_state["progress"] = 16

        raw_data = {
            "business_services": [asdict(s) for s in generator.business_services],
            "configuration_items": [asdict(c) for c in generator.configuration_items],
            "incidents": [asdict(i) for i in generator.incidents],
            "change_requests": [asdict(c) for c in generator.change_requests],
            "problem_records": [asdict(p) for p in generator.problem_records],
            "kb_articles": [asdict(k) for k in generator.kb_articles],
        }

        preparers = {
            "business_services": prepare_business_service_doc,
            "configuration_items": prepare_ci_doc,
            "incidents": prepare_incident_doc,
            "change_requests": prepare_change_doc,
            "problem_records": prepare_problem_doc,
            "kb_articles": prepare_kb_doc,
        }

        all_docs = []
        for key, preparer in preparers.items():
            all_docs.extend([preparer(item) for item in raw_data[key]])

        total = len(all_docs)
        populate_state["total_docs"] = total
        populate_state["message"] = f"Generated {total} documents — connecting to Astra DB..."
        populate_state["progress"] = 18

        # ── Step 3: Connect to Astra DB ──
        collection = get_astra_collection()
        populate_state["message"] = "Connected to Astra DB — starting ingestion..."
        populate_state["progress"] = 20

        # ── Step 3: Ingest in batches ──
        ingested = 0
        batches = [all_docs[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
        total_batches = len(batches)

        for batch_idx, batch in enumerate(batches, 1):
            texts = [doc["page_content"] for doc in batch]
            embeddings = get_embeddings(texts)

            docs_to_insert = []
            for doc, emb in zip(batch, embeddings):
                d = dict(doc)
                d["$vector"] = emb
                docs_to_insert.append(d)

            try:
                collection.insert_many(docs_to_insert, ordered=False)
            except Exception as e:
                err_str = str(e).lower()
                if "already exists" in err_str or "duplicate" in err_str:
                    pass  # Skip duplicates silently
                else:
                    raise

            ingested += len(batch)
            populate_state["ingested_docs"] = ingested
            # Progress: 20% → 95% during ingestion
            populate_state["progress"] = 20 + int((ingested / total) * 75)
            populate_state["message"] = (
                f"Ingesting batch {batch_idx}/{total_batches} "
                f"({ingested}/{total} documents)..."
            )
            time.sleep(0.3)  # Gentle rate limiting

        populate_state["status"] = "done"
        populate_state["progress"] = 100
        populate_state["ingested_docs"] = ingested
        populate_state["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        populate_state["message"] = (
            f"Population complete — {ingested} documents ingested into Astra DB"
        )

    except Exception as e:
        populate_state["status"] = "error"
        populate_state["error"] = str(e)
        populate_state["message"] = f"Population failed: {str(e)}"
        populate_state["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@app.post("/populate", response_model=PopulateStatusResponse)
async def populate_data(background_tasks: BackgroundTasks):
    """
    Trigger on-demand data generation and Astra DB ingestion.
    Generates 1,370 synthetic ITSM documents in-memory (no files needed),
    embeds them with IBM watsonx, and inserts them into Astra DB.
    Returns immediately — poll GET /populate/status for progress.
    """
    global populate_state

    if populate_state["status"] == "running":
        return PopulateStatusResponse(
            status=populate_state["status"],
            message=populate_state["message"],
            progress=populate_state["progress"],
            total_docs=populate_state["total_docs"],
            ingested_docs=populate_state["ingested_docs"],
            started_at=populate_state["started_at"],
            finished_at=populate_state["finished_at"],
            error=populate_state["error"],
        )

    # Reset state for a fresh run
    populate_state = {
        "status": "running",
        "message": "Starting data generation...",
        "progress": 0,
        "total_docs": 0,
        "ingested_docs": 0,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "finished_at": None,
        "error": None,
    }

    # Run in thread pool — avoids blocking the async event loop
    # Use background_tasks to ensure it runs in the same process (single worker)
    background_tasks.add_task(_run_populate)

    return PopulateStatusResponse(**populate_state)


@app.get("/populate/status", response_model=PopulateStatusResponse)
async def populate_status():
    """
    Poll the current status of the background populate job.
    Frontend polls this every 2 seconds while status == 'running'.
    """
    return PopulateStatusResponse(**populate_state)


# ─────────────────────────────────────────────
# Sample Questions — derived from real data
# ─────────────────────────────────────────────
@app.get("/sample-questions", response_model=SampleQuestionsResponse)
async def sample_questions():
    """
    Return dynamically generated sample questions based on actual documents
    in the Astra DB collection.  Fetches a small sample of real ticket numbers
    and entity names, then builds contextual questions from them.

    Tiers:
      easy    — direct factual lookups (single entity, specific ticket)
      medium  — filtered queries (by priority, state, type)
      complex — relationship / impact chain queries
    """
    if not normal_rag or not normal_rag.collection:
        raise HTTPException(status_code=503, detail="RAG not initialized")

    try:
        # ── Fetch a sample of real documents ──
        incidents = list(normal_rag.collection.find(
            {"metadata.type": "incident"},
            limit=6,
            projection={"metadata.number": True, "metadata.priority": True, "metadata.state": True}
        ))
        problems = list(normal_rag.collection.find(
            {"metadata.type": "problem_record"},
            limit=4,
            projection={"metadata.number": True, "metadata.state": True}
        ))
        changes = list(normal_rag.collection.find(
            {"metadata.type": "change_request"},
            limit=4,
            projection={"metadata.number": True, "metadata.change_type": True, "metadata.risk": True}
        ))
        kb_articles = list(normal_rag.collection.find(
            {"metadata.type": "kb_article"},
            limit=3,
            projection={"metadata.number": True, "metadata.title": True, "metadata.category": True}
        ))
        services = list(normal_rag.collection.find(
            {"metadata.type": "business_service"},
            limit=3,
            projection={"metadata.name": True, "metadata.criticality": True}
        ))

        # ── Build easy questions (direct lookups) ──
        easy = []
        for doc in incidents[:3]:
            num = doc.get("metadata", {}).get("number", "")
            if num:
                easy.append(f"What is the status and details of incident {num}?")
        for doc in problems[:2]:
            num = doc.get("metadata", {}).get("number", "")
            if num:
                easy.append(f"What is the root cause and workaround for problem {num}?")
        for doc in kb_articles[:2]:
            num = doc.get("metadata", {}).get("number", "")
            title = doc.get("metadata", {}).get("title", "")
            cat = doc.get("metadata", {}).get("category", "")
            if num:
                easy.append(f"Show me the knowledge base article {num} about {cat}.")
        for doc in changes[:1]:
            num = doc.get("metadata", {}).get("number", "")
            if num:
                easy.append(f"What are the details and risk level of change request {num}?")

        # Fallback easy questions if collection is sparse
        if len(easy) < 3:
            easy += [
                "What are the most recent P1 incidents?",
                "Show me all open problem records",
                "List all emergency change requests",
            ]

        # ── Build medium questions (filtered / aggregated) ──
        medium = []
        p1_inc = next((d for d in incidents if d.get("metadata", {}).get("priority") == "P1"), None)
        if p1_inc:
            medium.append(
                f"What P1 incidents are currently open and what is their impact on business services?"
            )
        medium.append("Which incidents have been linked to problem records for root cause analysis?")
        medium.append("What change requests are currently in progress and what systems do they affect?")
        medium.append("Show me all high-risk change requests and their associated configuration items.")
        medium.append("Which problem records are still open and what workarounds are available?")
        for doc in services[:2]:
            name = doc.get("metadata", {}).get("name", "")
            if name:
                medium.append(f"What incidents have affected the {name} service?")
                break

        # ── Build complex questions (relationship traversal) ──
        complex_qs = []
        for doc in incidents[:2]:
            num = doc.get("metadata", {}).get("number", "")
            if num:
                complex_qs.append(
                    f"Trace the full impact chain for incident {num} — "
                    f"which configuration items, problem records, and change requests are linked?"
                )
        for doc in problems[:1]:
            num = doc.get("metadata", {}).get("number", "")
            if num:
                complex_qs.append(
                    f"For problem {num}, show all linked incidents, the root cause, "
                    f"and what change requests were raised to fix it."
                )
        complex_qs.append(
            "Which services have the most recurring incidents and what underlying "
            "infrastructure problems are driving them?"
        )
        complex_qs.append(
            "Show the relationship between high-risk change requests and the incidents "
            "they were raised to resolve, including affected configuration items."
        )
        complex_qs.append(
            "What is the downstream impact of the most critical configuration items "
            "that have active incidents and open problem records?"
        )

        # Trim to reasonable sizes
        easy = easy[:6]
        medium = medium[:6]
        complex_qs = complex_qs[:5]

        return SampleQuestionsResponse(
            easy=easy,
            medium=medium,
            complex=complex_qs,
            total=len(easy) + len(medium) + len(complex_qs)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate sample questions: {str(e)}")


# ─────────────────────────────────────────────
# Query Endpoints
# ─────────────────────────────────────────────
@app.post("/query/normal", response_model=QueryResponse)
async def query_normal_rag(request: QueryRequest):
    """
    Query using Normal RAG (vector similarity only)
    """
    if not normal_rag:
        raise HTTPException(status_code=503, detail="Normal RAG not initialized")

    try:
        start_time = time.time()

        # Retrieve documents
        retrieval_start = time.time()
        sources = normal_rag.retrieve(request.question, top_k=request.top_k or 5)
        retrieval_time = time.time() - retrieval_start

        # Generate answer
        generation_start = time.time()
        answer = normal_rag.generate_answer(request.question, sources)
        generation_time = time.time() - generation_start

        total_time = time.time() - start_time

        # Convert sources to response format
        source_docs = [
            SourceDocument(
                id=src.get("id", ""),
                content=src.get("page_content", ""),
                metadata=src.get("metadata", {}),
                score=src.get("score")
            )
            for src in sources
        ]

        # Track metrics
        metrics_collector.record_query(
            query_type="normal",
            retrieval_time=retrieval_time,
            num_sources=len(sources)
        )

        return QueryResponse(
            answer=answer,
            sources=source_docs,
            retrieval_time=retrieval_time,
            generation_time=generation_time,
            total_time=total_time,
            num_sources=len(sources)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.post("/query/graph", response_model=QueryResponse)
async def query_graph_rag(request: QueryRequest):
    """
    Query using Graph RAG (vector + relationship traversal)
    """
    if not graph_rag:
        raise HTTPException(status_code=503, detail="Graph RAG not initialized")

    try:
        start_time = time.time()

        # Retrieve documents with graph traversal
        retrieval_start = time.time()
        sources, traversal_path = graph_rag.retrieve_with_traversal(
            request.question,
            start_k=3,
            max_depth=2,
            select_k=request.top_k or 10
        )
        retrieval_time = time.time() - retrieval_start

        # Generate answer
        generation_start = time.time()
        answer = graph_rag.generate_answer(request.question, sources)
        generation_time = time.time() - generation_start

        total_time = time.time() - start_time

        # Convert sources to response format
        source_docs = [
            SourceDocument(
                id=src.get("id", ""),
                content=src.get("page_content", ""),
                metadata=src.get("metadata", {}),
                score=src.get("score")
            )
            for src in sources
        ]

        # Convert traversal path
        traversal_nodes = [
            TraversalPath(
                node_id=node["id"],
                node_type=node["type"],
                depth=node["depth"],
                content=node["content"][:200] + "..." if len(node["content"]) > 200 else node["content"]
            )
            for node in traversal_path
        ]

        # Track metrics
        metrics_collector.record_query(
            query_type="graph",
            retrieval_time=retrieval_time,
            num_sources=len(sources)
        )

        return QueryResponse(
            answer=answer,
            sources=source_docs,
            retrieval_time=retrieval_time,
            generation_time=generation_time,
            total_time=total_time,
            num_sources=len(sources),
            traversal_path=traversal_nodes
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.post("/query/lookup", response_model=LookupResponse)
async def lookup_by_ticket_number(request: LookupRequest):
    """
    Direct lookup by ticket number using metadata filter.
    Bypasses vector search — finds the exact document by INC/PRB/CHG/KB number.
    Optionally traverses the graph from that document for richer context.
    """
    if not normal_rag:
        raise HTTPException(status_code=503, detail="RAG not initialized")

    ticket = request.ticket_number.strip().upper()

    # Validate ticket number format
    if not re.match(r'^(INC|PRB|CHG|KB)\d+$', ticket):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticket number format: '{ticket}'. Expected INC/PRB/CHG/KB followed by digits."
        )

    try:
        start_time = time.time()

        # ── Step 1: Direct metadata filter lookup ──
        retrieval_start = time.time()
        doc = normal_rag.collection.find_one(
            filter={"metadata.number": ticket}
        )
        retrieval_time = time.time() - retrieval_start

        if not doc:
            return LookupResponse(
                ticket_number=ticket,
                found=False,
                answer=f"No document found with ticket number {ticket}. Please verify the number exists in the system.",
                retrieval_time=retrieval_time,
                generation_time=0.0,
                total_time=time.time() - start_time
            )

        # Build source document
        source_doc = {
            "id": doc.get("_id", ""),
            "page_content": doc.get("page_content", ""),
            "metadata": doc.get("metadata", {}),
            "score": 1.0  # Exact match = perfect score
        }

        # ── Step 2: Optional graph traversal from this document ──
        graph_context = []
        traversal_nodes = []

        if request.include_graph and graph_rag:
            links = doc.get("metadata", {}).get("links", [])

            for link_id in links[:8]:  # Limit to 8 linked docs
                if link_id:
                    linked = normal_rag.collection.find_one(filter={"_id": link_id})
                    if linked:
                        graph_context.append({
                            "id": linked.get("_id", ""),
                            "page_content": linked.get("page_content", ""),
                            "metadata": linked.get("metadata", {}),
                            "score": None
                        })
                        traversal_nodes.append({
                            "id": linked.get("_id", ""),
                            "type": linked.get("metadata", {}).get("type", "unknown"),
                            "depth": 1,
                            "number": linked.get("metadata", {}).get("number", ""),
                            "content": linked.get("page_content", "")[:200]
                        })

        # ── Step 3: Generate answer with all context ──
        all_sources = [source_doc] + graph_context
        generation_start = time.time()
        question = f"Provide full details about {ticket}: its description, priority, state, root cause, workaround, and any linked records."
        answer = normal_rag.generate_answer(question, all_sources)
        generation_time = time.time() - generation_start

        total_time = time.time() - start_time

        return LookupResponse(
            ticket_number=ticket,
            found=True,
            document={
                "id": source_doc["id"],
                "content": source_doc["page_content"],
                "metadata": source_doc["metadata"]
            },
            answer=answer,
            graph_context=[
                {"id": g["id"], "content": g["page_content"][:200], "metadata": g["metadata"]}
                for g in graph_context
            ],
            traversal_path=traversal_nodes,
            retrieval_time=retrieval_time,
            generation_time=generation_time,
            total_time=total_time
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lookup failed: {str(e)}")


# ─────────────────────────────────────────────
# Metrics Endpoints
# ─────────────────────────────────────────────
@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """
    Get aggregated metrics for both RAG approaches
    """
    metrics = metrics_collector.get_metrics()

    return MetricsResponse(
        total_queries=metrics["total_queries"],
        normal_rag_queries=metrics["normal_rag_queries"],
        graph_rag_queries=metrics["graph_rag_queries"],
        avg_normal_retrieval_time=metrics["avg_normal_retrieval_time"],
        avg_graph_retrieval_time=metrics["avg_graph_retrieval_time"],
        avg_normal_sources=metrics["avg_normal_sources"],
        avg_graph_sources=metrics["avg_graph_sources"]
    )


@app.post("/metrics/reset")
async def reset_metrics():
    """Reset metrics"""
    metrics_collector.reset()
    return {"message": "Metrics reset successfully"}


# ─────────────────────────────────────────────
# Run with: uvicorn main:app --reload --port 8000
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
