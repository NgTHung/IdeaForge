# Local similarity clustering service

The service clusters the note embeddings supplied by the Next.js development route. It does not call Gemini or accept browser requests directly. The service binds to `127.0.0.1:8000`.

From the repository root, create and activate its isolated Python environment:

```powershell
py -3.13 -m venv .venv-clustering
.\.venv-clustering\Scripts\Activate.ps1
python -m pip install -r services/clustering/requirements.txt
```

Start the service in one terminal:

```powershell
npm run cluster:dev
```

Start the Next.js app in a second terminal with `npm run dev`, then open `/similarity-lab`. The group count and vector method can be changed in the left panel. The service offers `GET /health` and `POST /clusters`.

Set `FASTAPI_CLUSTER_URL` only when the service listens at another trusted HTTP URL. The app's `/api/similarity/clusters` route is limited to development mode.
