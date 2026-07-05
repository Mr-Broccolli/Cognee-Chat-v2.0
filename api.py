import json
import shutil
import traceback
import sys
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

_project_root = Path(__file__).resolve().parent
_cognee_system = str(_project_root / ".cognee_system")
_cognee_data = str(_project_root / ".data_storage")
_cognee_cache = str(_project_root / ".cognee_cache")

os.environ["system_root_directory"] = _cognee_system
os.environ["data_root_directory"] = _cognee_data
os.environ["cache_root_directory"] = _cognee_cache
os.environ["CACHING"] = "false"
os.environ["ENABLE_BACKEND_ACCESS_CONTROL"] = "false"

os.makedirs(_cognee_system, exist_ok=True)
os.makedirs(_cognee_data, exist_ok=True)
os.makedirs(_cognee_cache, exist_ok=True)

_cognee_db_dir = os.path.join(_cognee_system, "databases")
if os.getenv("COGNEE_WIPE_DB_ON_STARTUP", "false").lower() == "true" and os.path.isdir(_cognee_db_dir):
    for f in os.listdir(_cognee_db_dir):
        if f.startswith("cognee_graph_"):
            try:
                os.remove(os.path.join(_cognee_db_dir, f))
                print(f"   [startup] wiped stale graph file: {f}")
            except Exception as e:
                print(f"   [startup] failed to wipe {f}: {e}")

_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("LLM_API_KEY")
if _key:
    os.environ["OPENROUTER_API_KEY"] = _key

LLM_MODEL = os.getenv("LLM_MODEL", "openrouter/meta-llama/llama-3.1-8b-instruct")

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import cognee
from cognee.exceptions.exceptions import CogneeValidationError
from litellm import acompletion

cognee.config.set_llm_model(LLM_MODEL)
cognee.config.set_llm_api_key(_key or "")
cognee.config.set_llm_endpoint(os.getenv("LLM_ENDPOINT", "https://openrouter.ai/api/v1"))
cognee.config.set_llm_provider(os.getenv("LLM_PROVIDER", "openai"))
cognee.config.set_embedding_provider(os.getenv("EMBEDDING_PROVIDER", "fastembed"))
cognee.config.set_embedding_model(os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"))
cognee.config.set_embedding_dimensions(int(os.getenv("EMBEDDING_DIMENSIONS", "384")))
cognee.config.set_graph_database_provider("kuzu")
cognee.config.set_graph_database_subprocess_enabled(True)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app = FastAPI(title="Graph-RAG Knowledge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URL,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "active"}

@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)

@app.get("/health")
async def health():
    return {"status": "ok"}

class TextPayload(BaseModel):
    text: str

@app.post("/ingest/text")
async def ingest_text(payload: TextPayload):
    try:
        await cognee.remember(payload.text)
        return {"status": "success", "message": "Text memory added to the graph."}
    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n{'='*60}\nINGEST ERROR:\n{tb}\n{'='*60}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = content.decode("utf-8")
        await cognee.remember(text_content)
        return {"status": "success", "message": f"File '{file.filename}' processed and added to memory."}
    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n{'='*60}\nFILE INGEST ERROR:\n{tb}\n{'='*60}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

@app.post("/chat")
async def query_memory(payload: TextPayload):
    try:
        results = await cognee.recall(payload.text)
    except CogneeValidationError:
        return {
            "status": "success",
            "answer": "I cannot find information regarding that — the knowledge graph is empty. Please ingest some data first.",
            "sources": [],
        }

    try:
        if not results or len(results) == 0:
            return {
                "status": "success",
                "answer": "I cannot find information regarding that — the knowledge graph is empty. Please ingest some data first.",
                "sources": [],
            }

        graph_context = "\n".join([str(r) for r in results])

        source_ids = []
        for r in results:
            try:
                if hasattr(r, "id"):
                    source_ids.append(str(r.id))
                elif hasattr(r, "node_id"):
                    source_ids.append(str(r.node_id))
                elif isinstance(r, dict):
                    if "id" in r:
                        source_ids.append(str(r["id"]))
                    elif "node_id" in r:
                        source_ids.append(str(r["node_id"]))
            except Exception:
                pass

        system_prompt = f"""You are a precise knowledge assistant. 
        Answer the user's question using ONLY this retrieved memory context.
        If the answer is not in the context, say 'I cannot find information regarding that.'
        
        Context:
        {graph_context}
        """

        response = await acompletion(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload.text}
            ]
        )

        answer = response.choices[0].message.content
        return {"status": "success", "answer": answer, "sources": source_ids}

    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n{'='*60}\nCHAT ERROR:\n{tb}\n{'='*60}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

class TitlePayload(BaseModel):
    text: str

@app.post("/generate-title")
async def generate_title(payload: TitlePayload):
    try:
        response = await acompletion(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "Summarize this user query into a clean, informative, 2-to-3 word chat title. Do not use quotes, punctuation, or filler words."},
                {"role": "user", "content": payload.text}
            ]
        )
        title = response.choices[0].message.content.strip().strip('"').strip("'")
        if len(title) > 40:
            title = title[:37] + "..."
        return {"title": title}
    except Exception as e:
        return JSONResponse(status_code=200, content={"title": payload.text[:35] + "..." if len(payload.text) > 35 else payload.text})

@app.get("/graph/visualize")
async def get_graph_data():
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine

        graph_engine = await get_graph_engine()
        raw_nodes, raw_edges = await graph_engine.get_graph_data()

        if not raw_nodes or len(raw_nodes) == 0:
            return {"nodes": [], "edges": [], "status": "empty"}

        nodes = []
        for node in raw_nodes:
            if isinstance(node, tuple) and len(node) >= 2:
                n_id = str(node[0])
                n_data = node[1] if isinstance(node[1], dict) else {}
            else:
                n_id = str(node)
                n_data = {}

            raw_name = n_data.get("name") or n_data.get("text") or n_id
            clean_name = str(raw_name).strip()

            if len(clean_name) > 35:
                clean_name = clean_name[:32] + "..."

            node_type = n_data.get("type", "Entity")
            nodes.append({"id": n_id, "label": clean_name, "group": node_type})

        edges = []
        for edge in raw_edges:
            if isinstance(edge, tuple) and len(edge) >= 2:
                source = str(edge[0])
                target = str(edge[1])
                e_data = edge[2] if len(edge) > 2 and isinstance(edge[2], dict) else {}
            else:
                continue

            relationship = e_data.get("relationship_name", "connected_to")
            weight_candidate = e_data.get("weight")
            if weight_candidate is None:
                weight_candidate = e_data.get("score")
            if weight_candidate is None:
                weight_candidate = e_data.get("confidence")
            weight = weight_candidate if weight_candidate is not None else 0.5
            if isinstance(weight, (int, float)):
                weight = max(0.0, min(1.0, float(weight)))
            else:
                weight = 0.5
            edges.append({"source": source, "target": target, "label": relationship, "weight": weight})

        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        print(f"\n{'='*60}\nGRAPH ERROR:\n{traceback.format_exc()}\n{'='*60}", file=sys.stderr)
        return {"nodes": [], "edges": [], "status": "error", "detail": str(e)}

@app.delete("/reset")
async def wipe_memory():
    try:
        await cognee.forget(everything=True)
        return {"status": "success", "message": "Graph wiped clean."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))