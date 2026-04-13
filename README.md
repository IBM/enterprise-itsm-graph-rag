# enterprise-itsm-graph-rag

This repository contains the sample code for the IBM Developer tutorial on building a Graph RAG application for enterprise ITSM using BFS traversal.

## Folder structure

- `code/` – main application source and runtime files
  - `backend/` – backend services and APIs
  - `frontend/` – UI application
  - `.env.example` – example environment variables
  - `Dockerfile` – container build definition
  - `docker-compose.yml` – local multi-service startup
  - `nginx-combined.conf` – nginx configuration
  - `supervisord.conf` – process management config
  - `.dockerignore` / `.gitignore` – ignore rules
- `images/` – repository images and supporting visuals
- `README.md` – project overview

## Tutorial steps

Follow the full setup and implementation steps in the IBM Developer tutorial:

[Build a Graph RAG application for enterprise ITSM using Breadth-First Search traversal](https://developer.ibm.com/tutorials/build-graph-rag-bfs-traversal-enterprise-itsm/)