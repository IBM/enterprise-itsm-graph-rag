"""
RAG Pipeline Implementations
- NormalRAG: Vector similarity search only
- GraphRAG: Vector search + relationship traversal
Uses IBM watsonx for embeddings (intfloat/multilingual-e5-large, 1024d) and LLM generation.
"""

import os
from typing import List, Dict, Any, Tuple
from collections import deque
from dotenv import load_dotenv

from astrapy import DataAPIClient
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import Embeddings, ModelInference
from ibm_watsonx_ai.metanames import EmbedTextParamsMetaNames as EmbedParams

load_dotenv()

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
ASTRA_DB_TOKEN = os.getenv("ASTRA_DB_APPLICATION_TOKEN") or os.getenv("ASTRA_DB_TOKEN")
ASTRA_DB_API_ENDPOINT = os.getenv("ASTRA_DB_API_ENDPOINT")
ASTRA_DB_KEYSPACE = os.getenv("ASTRA_DB_KEYSPACE", "graphCollection")
COLLECTION_NAME = os.getenv("ASTRA_DB_COLLECTION", "itsm_documents")

WATSONX_API_KEY = os.getenv("WATSONX_API_KEY")
WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
EMBEDDING_MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "intfloat/multilingual-e5-large")
LLM_MODEL_ID = os.getenv("LLM_MODEL_ID", "ibm/granite-3-8b-instruct")


class BaseRAG:
    """Base class for RAG implementations using IBM watsonx"""

    def __init__(self):
        """Initialize Astra DB connection and watsonx clients"""
        # Astra DB
        self.client = DataAPIClient(ASTRA_DB_TOKEN)
        self.db = self.client.get_database_by_api_endpoint(
            ASTRA_DB_API_ENDPOINT,
            keyspace=ASTRA_DB_KEYSPACE
        )
        self.collection = self.db.get_collection(COLLECTION_NAME)

        # watsonx credentials (shared)
        self._credentials = Credentials(
            api_key=WATSONX_API_KEY,
            url=WATSONX_URL
        )

        # Embedding model
        self._embed_params = {
            EmbedParams.TRUNCATE_INPUT_TOKENS: 512,
            EmbedParams.RETURN_OPTIONS: {"input_text": False}
        }
        self._embeddings = Embeddings(
            model_id=EMBEDDING_MODEL_ID,
            params=self._embed_params,
            credentials=self._credentials,
            project_id=WATSONX_PROJECT_ID
        )

        # LLM for generation
        self._llm = ModelInference(
            model_id=LLM_MODEL_ID,
            credentials=self._credentials,
            project_id=WATSONX_PROJECT_ID,
            params={
                "max_new_tokens": 512,
                "temperature": 0.3,
                "repetition_penalty": 1.1
            }
        )

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding vector for a single text"""
        results = self._embeddings.embed_documents(texts=[text])
        return results[0]

    def generate_answer(self, question: str, sources: List[Dict]) -> str:
        """Generate answer using watsonx LLM with retrieved sources"""
        context_parts = []
        for i, source in enumerate(sources, 1):
            content = source.get("page_content", "")
            metadata = source.get("metadata", {})
            doc_type = metadata.get("type", "document")
            context_parts.append(f"[Source {i} - {doc_type}]\n{content}\n")

        context = "\n".join(context_parts)

        prompt = f"""<|system|>
You are an expert IT operations assistant analyzing Enterprise ITSM data.
Answer questions based ONLY on the provided context about incidents, problems,
changes, configuration items, and knowledge base articles.
- Reference specific incidents, problems, or changes by their numbers.
- Explain relationships between entities when relevant.
- If the context does not contain enough information, say so clearly.
- Be concise but thorough.
<|user|>
Context:
{context}

Question: {question}
<|assistant|>
"""
        response = self._llm.generate_text(prompt=prompt)
        return response.strip() if isinstance(response, str) else str(response)


class NormalRAG(BaseRAG):
    """Normal RAG: Vector similarity search only"""

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Retrieve documents using vector similarity search.

        Args:
            query: User question
            top_k: Number of documents to retrieve

        Returns:
            List of retrieved documents with metadata
        """
        query_embedding = self.get_embedding(query)

        # astrapy 2.x ANN search - no projection to avoid Astra API restrictions
        results = self.collection.find(
            sort={"$vector": query_embedding},
            limit=top_k,
            include_similarity=True
        )

        documents = []
        for doc in results:
            documents.append({
                "id": doc.get("_id", ""),
                "page_content": doc.get("page_content", ""),
                "metadata": doc.get("metadata", {}),
                "score": doc.get("$similarity", 0.0)
            })

        return documents


class GraphRAG(BaseRAG):
    """Graph RAG: Vector search + BFS relationship traversal"""

    def retrieve_with_traversal(
        self,
        query: str,
        start_k: int = 3,
        max_depth: int = 2,
        select_k: int = 10
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Retrieve documents using vector search + graph traversal.

        Args:
            query: User question
            start_k: Number of initial seed documents from vector search
            max_depth: Maximum BFS traversal depth
            select_k: Maximum total documents to return

        Returns:
            Tuple of (documents, traversal_path)
        """
        # Step 1: Initial vector search for seed documents
        query_embedding = self.get_embedding(query)

        seed_results = self.collection.find(
            sort={"$vector": query_embedding},
            limit=start_k,
            include_similarity=True
        )

        visited: set = set()
        all_documents: List[Dict] = []
        traversal_path: List[Dict] = []
        queue: deque = deque()

        # Seed the BFS queue
        for doc in seed_results:
            doc_id = doc.get("_id", "")
            if doc_id and doc_id not in visited:
                visited.add(doc_id)
                all_documents.append({
                    "id": doc_id,
                    "page_content": doc.get("page_content", ""),
                    "metadata": doc.get("metadata", {}),
                    "score": doc.get("$similarity", 0.0),
                    "depth": 0
                })
                traversal_path.append({
                    "id": doc_id,
                    "type": doc.get("metadata", {}).get("type", "unknown"),
                    "depth": 0,
                    "content": doc.get("page_content", "")
                })
                queue.append((doc_id, 0))

        # Step 2: BFS traversal via metadata.links
        while queue and len(all_documents) < select_k:
            current_id, current_depth = queue.popleft()

            if current_depth >= max_depth:
                continue

            # Fetch current doc to read its links
            current_doc = self.collection.find_one(
                filter={"_id": current_id}
            )

            if not current_doc:
                continue

            links = current_doc.get("metadata", {}).get("links", [])

            for link_id in links:
                if link_id and link_id not in visited and len(all_documents) < select_k:
                    linked_doc = self.collection.find_one(
                        filter={"_id": link_id}
                    )

                    if linked_doc:
                        visited.add(link_id)
                        all_documents.append({
                            "id": link_id,
                            "page_content": linked_doc.get("page_content", ""),
                            "metadata": linked_doc.get("metadata", {}),
                            "score": None,
                            "depth": current_depth + 1
                        })
                        traversal_path.append({
                            "id": link_id,
                            "type": linked_doc.get("metadata", {}).get("type", "unknown"),
                            "depth": current_depth + 1,
                            "content": linked_doc.get("page_content", "")
                        })
                        queue.append((link_id, current_depth + 1))

        return all_documents[:select_k], traversal_path


class MetricsCollector:
    """Collect and aggregate metrics for RAG performance comparison"""

    def __init__(self):
        self.reset()

    def reset(self):
        """Reset all metrics"""
        self.queries: Dict[str, List] = {
            "normal": [],
            "graph": []
        }

    def record_query(self, query_type: str, retrieval_time: float, num_sources: int):
        """Record a query execution"""
        self.queries[query_type].append({
            "retrieval_time": retrieval_time,
            "num_sources": num_sources
        })

    def get_metrics(self) -> Dict[str, Any]:
        """Get aggregated metrics"""
        normal_queries = self.queries["normal"]
        graph_queries = self.queries["graph"]

        def avg(values):
            return sum(values) / len(values) if values else 0.0

        return {
            "total_queries": len(normal_queries) + len(graph_queries),
            "normal_rag_queries": len(normal_queries),
            "graph_rag_queries": len(graph_queries),
            "avg_normal_retrieval_time": avg([q["retrieval_time"] for q in normal_queries]),
            "avg_graph_retrieval_time": avg([q["retrieval_time"] for q in graph_queries]),
            "avg_normal_sources": avg([q["num_sources"] for q in normal_queries]),
            "avg_graph_sources": avg([q["num_sources"] for q in graph_queries])
        }

