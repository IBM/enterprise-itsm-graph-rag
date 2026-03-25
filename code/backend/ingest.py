"""
Astra DB Ingestion Script
Ingests Enterprise ITSM synthetic data into Astra DB with vector embeddings.
Uses IBM watsonx embeddings (intfloat/multilingual-e5-large, 1024d).

Usage:
    python ingest.py

Prerequisites:
    - .env file with ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT,
      WATSONX_API_KEY, WATSONX_PROJECT_ID
    - data/ folder with combined_dataset.json (run data_generator.py first)
"""

import json
import os
import time
from typing import List, Dict, Any
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Astra DB
from astrapy import DataAPIClient
from astrapy.constants import VectorMetric
from astrapy.info import CollectionDefinition

# IBM watsonx embeddings
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import Embeddings
from ibm_watsonx_ai.metanames import EmbedTextParamsMetaNames as EmbedParams


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
ASTRA_DB_TOKEN = os.getenv("ASTRA_DB_APPLICATION_TOKEN") or os.getenv("ASTRA_DB_TOKEN")
ASTRA_DB_API_ENDPOINT = os.getenv("ASTRA_DB_API_ENDPOINT")
ASTRA_DB_KEYSPACE = os.getenv("ASTRA_DB_KEYSPACE", "graphCollection")
COLLECTION_NAME = os.getenv("ASTRA_DB_COLLECTION", "itsm_documents")
# intfloat/multilingual-e5-large produces 1024-dimensional vectors
VECTOR_DIMENSION = 1024

# Data directory — relative to this script: ../data
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"

BATCH_SIZE = 20  # Documents per batch for ingestion


# ─────────────────────────────────────────────
# Embedding Functions
# ─────────────────────────────────────────────
def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings using IBM watsonx intfloat/multilingual-e5-large (1024d)"""
    embed_params = {
        EmbedParams.TRUNCATE_INPUT_TOKENS: 512,
        EmbedParams.RETURN_OPTIONS: {"input_text": False}
    }
    credentials = Credentials(
        api_key=os.getenv("WATSONX_API_KEY"),
        url=os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    )
    embedding = Embeddings(
        model_id=os.getenv("EMBEDDING_MODEL_ID", "intfloat/multilingual-e5-large"),
        params=embed_params,
        credentials=credentials,
        project_id=os.getenv("WATSONX_PROJECT_ID")
    )
    return embedding.embed_documents(texts=texts)


# ─────────────────────────────────────────────
# Document Preparation
# ─────────────────────────────────────────────
def prepare_business_service_doc(item: Dict) -> Dict:
    """Convert business service to document"""
    page_content = (
        f"Business Service: {item['name']}\n"
        f"Description: {item['description']}\n"
        f"Criticality: {item['criticality']}\n"
        f"Owner: {item['owner']}"
    )
    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "business_service",
            "id": item["id"],
            "name": item["name"],
            "criticality": item["criticality"],
            "links": item.get("dependent_services", [])
        }
    }


def prepare_ci_doc(item: Dict) -> Dict:
    """Convert configuration item to document"""
    page_content = (
        f"Configuration Item: {item['name']}\n"
        f"Type: {item['type']}\n"
        f"Description: {item['description']}\n"
        f"Status: {item['status']}\n"
        f"Business Service: {item['business_service']}"
    )
    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "configuration_item",
            "id": item["id"],
            "name": item["name"],
            "ci_type": item["type"],
            "business_service": item["business_service"],
            "links": item.get("dependencies", [])
        }
    }


def prepare_incident_doc(item: Dict) -> Dict:
    """Convert incident to document"""
    page_content = (
        f"Incident: {item['number']}\n"
        f"Description: {item['short_description']}\n"
        f"Details: {item['detailed_description']}\n"
        f"Priority: {item['priority']}\n"
        f"Impact: {item['impact']}\n"
        f"State: {item['state']}\n"
        f"Affected CI: {item['affected_ci']}"
    )
    # Flatten all links into a single list
    links = item.get("links", {})
    all_links = []
    if isinstance(links, dict):
        for link_list in links.values():
            if isinstance(link_list, list):
                all_links.extend(link_list)
    elif isinstance(links, list):
        all_links = links

    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "incident",
            "id": item["id"],
            "number": item["number"],
            "priority": item["priority"],
            "state": item["state"],
            "affected_ci": item["affected_ci"],
            "links": all_links
        }
    }


def prepare_change_doc(item: Dict) -> Dict:
    """Convert change request to document"""
    page_content = (
        f"Change Request: {item['number']}\n"
        f"Description: {item['short_description']}\n"
        f"Details: {item['detailed_description']}\n"
        f"Type: {item['type']}\n"
        f"Risk: {item['risk']}\n"
        f"State: {item['state']}"
    )
    links = item.get("links", {})
    all_links = []
    if isinstance(links, dict):
        for link_list in links.values():
            if isinstance(link_list, list):
                all_links.extend(link_list)
    elif isinstance(links, list):
        all_links = links

    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "change_request",
            "id": item["id"],
            "number": item["number"],
            "change_type": item["type"],
            "risk": item["risk"],
            "state": item["state"],
            "affected_cis": item.get("affected_cis", []),
            "links": all_links
        }
    }


def prepare_problem_doc(item: Dict) -> Dict:
    """Convert problem record to document"""
    page_content = (
        f"Problem Record: {item['number']}\n"
        f"Description: {item['short_description']}\n"
        f"Details: {item['detailed_description']}\n"
        f"Root Cause: {item['root_cause']}\n"
        f"Workaround: {item['workaround']}\n"
        f"State: {item['state']}"
    )
    links = item.get("links", {})
    all_links = []
    if isinstance(links, dict):
        for link_list in links.values():
            if isinstance(link_list, list):
                all_links.extend(link_list)
    elif isinstance(links, list):
        all_links = links

    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "problem_record",
            "id": item["id"],
            "number": item["number"],
            "state": item["state"],
            "affected_cis": item.get("affected_cis", []),
            "links": all_links
        }
    }


def prepare_kb_doc(item: Dict) -> Dict:
    """Convert KB article to document"""
    page_content = (
        f"Knowledge Base Article: {item['number']}\n"
        f"Title: {item['title']}\n"
        f"Content: {item['content']}\n"
        f"Category: {item['category']}\n"
        f"Tags: {', '.join(item.get('tags', []))}"
    )
    links = item.get("links", {})
    all_links = []
    if isinstance(links, dict):
        for link_list in links.values():
            if isinstance(link_list, list):
                all_links.extend(link_list)
    elif isinstance(links, list):
        all_links = links

    return {
        "_id": item["id"],
        "page_content": page_content,
        "metadata": {
            "type": "kb_article",
            "id": item["id"],
            "number": item["number"],
            "title": item["title"],
            "category": item["category"],
            "tags": item.get("tags", []),
            "links": all_links
        }
    }


# ─────────────────────────────────────────────
# Astra DB Connection
# ─────────────────────────────────────────────
def get_astra_collection():
    """Connect to Astra DB and get/create the collection"""
    client = DataAPIClient(ASTRA_DB_TOKEN)
    db = client.get_database_by_api_endpoint(
        ASTRA_DB_API_ENDPOINT,
        keyspace=ASTRA_DB_KEYSPACE
    )

    # Check if collection exists
    existing = [c.name for c in db.list_collections()]
    if COLLECTION_NAME not in existing:
        print(f"Creating collection '{COLLECTION_NAME}' with {VECTOR_DIMENSION}d vectors...")
        collection = db.create_collection(
            COLLECTION_NAME,
            definition=CollectionDefinition.builder()
                .set_vector_dimension(VECTOR_DIMENSION)
                .set_vector_metric(VectorMetric.COSINE)
                .build()
        )
        print(f"Collection created: {COLLECTION_NAME}")
    else:
        print(f"Using existing collection: {COLLECTION_NAME}")
        collection = db.get_collection(COLLECTION_NAME)

    return collection


# ─────────────────────────────────────────────
# Batch Ingestion
# ─────────────────────────────────────────────
def ingest_batch(collection, batch: List[Dict], batch_num: int, total_batches: int):
    """Ingest a single batch of documents"""
    texts = [doc["page_content"] for doc in batch]

    # Get embeddings from watsonx
    embeddings = get_embeddings(texts)

    # Attach embeddings to documents
    docs_to_insert = []
    for doc, embedding in zip(batch, embeddings):
        doc_copy = dict(doc)
        doc_copy["$vector"] = embedding
        docs_to_insert.append(doc_copy)

    # Insert into Astra DB
    try:
        result = collection.insert_many(docs_to_insert, ordered=False)
        print(f"  Batch {batch_num}/{total_batches}: inserted {len(docs_to_insert)} docs")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print(f"  Batch {batch_num}/{total_batches}: some docs already exist, skipping duplicates")
        else:
            raise


def ingest_dataset(collection, documents: List[Dict], dataset_name: str):
    """Ingest a full dataset in batches"""
    print(f"\nIngesting {dataset_name}: {len(documents)} documents")

    batches = [documents[i:i+BATCH_SIZE] for i in range(0, len(documents), BATCH_SIZE)]
    total_batches = len(batches)

    for i, batch in enumerate(batches, 1):
        try:
            ingest_batch(collection, batch, i, total_batches)
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f"  Error in batch {i}: {e}")
            time.sleep(2)
            # Retry once
            try:
                ingest_batch(collection, batch, i, total_batches)
            except Exception as e2:
                print(f"  Failed batch {i} after retry: {e2}")


# ─────────────────────────────────────────────
# Main Ingestion
# ─────────────────────────────────────────────
def load_data() -> Dict[str, List[Dict]]:
    """Load all data from JSON files"""
    combined_path = DATA_DIR / "combined_dataset.json"

    if combined_path.exists():
        with open(combined_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        raise FileNotFoundError(
            f"Data file not found: {combined_path}\n"
            f"Run data_generator.py first to generate the data."
        )


def prepare_all_documents(data: Dict[str, List[Dict]]) -> List[Dict]:
    """Prepare all documents for ingestion"""
    all_docs = []

    preparers = {
        "business_services": prepare_business_service_doc,
        "configuration_items": prepare_ci_doc,
        "incidents": prepare_incident_doc,
        "change_requests": prepare_change_doc,
        "problem_records": prepare_problem_doc,
        "kb_articles": prepare_kb_doc
    }

    for dataset_name, preparer in preparers.items():
        items = data.get(dataset_name, [])
        docs = [preparer(item) for item in items]
        all_docs.extend(docs)
        print(f"Prepared {len(docs)} {dataset_name} documents")

    return all_docs


def main():
    """Main ingestion pipeline"""
    print("=" * 60)
    print("Astra DB Ingestion Pipeline")
    print(f"Embedding model : {os.getenv('EMBEDDING_MODEL_ID', 'intfloat/multilingual-e5-large')}")
    print(f"Vector dimension: {VECTOR_DIMENSION}")
    print(f"Data directory  : {DATA_DIR}")
    print("=" * 60)

    # Validate environment
    if not ASTRA_DB_TOKEN or not ASTRA_DB_API_ENDPOINT:
        print("ERROR: Missing ASTRA_DB_APPLICATION_TOKEN or ASTRA_DB_API_ENDPOINT")
        print("Please set environment variables in .env file")
        return

    if not os.getenv("WATSONX_API_KEY") or not os.getenv("WATSONX_PROJECT_ID"):
        print("ERROR: Missing WATSONX_API_KEY or WATSONX_PROJECT_ID")
        print("Please set environment variables in .env file")
        return

    # Load data
    print("\nLoading data...")
    data = load_data()

    # Prepare documents
    print("\nPreparing documents...")
    all_docs = prepare_all_documents(data)
    print(f"\nTotal documents to ingest: {len(all_docs)}")

    # Connect to Astra DB
    print("\nConnecting to Astra DB...")
    collection = get_astra_collection()

    # Ingest by type for better progress tracking
    preparers = {
        "business_services": prepare_business_service_doc,
        "configuration_items": prepare_ci_doc,
        "incidents": prepare_incident_doc,
        "change_requests": prepare_change_doc,
        "problem_records": prepare_problem_doc,
        "kb_articles": prepare_kb_doc
    }

    for dataset_name, preparer in preparers.items():
        items = data.get(dataset_name, [])
        docs = [preparer(item) for item in items]
        ingest_dataset(collection, docs, dataset_name)

    print("\n" + "=" * 60)
    print("Ingestion complete!")
    print(f"Collection '{COLLECTION_NAME}' in keyspace '{ASTRA_DB_KEYSPACE}'")
    print("=" * 60)


if __name__ == "__main__":
    main()

