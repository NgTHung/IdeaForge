from __future__ import annotations

from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sklearn.cluster import KMeans


class EmbeddedNote(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    id: str = Field(min_length=1, max_length=80)
    vector: list[float] = Field(min_length=1, max_length=4096)


class ClusterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    notes: list[EmbeddedNote] = Field(min_length=2, max_length=50)
    cluster_count: int = Field(ge=2, le=10)
    metric: Literal["centered", "raw"]
    embedding_model: str = Field(min_length=1, max_length=120)

    @model_validator(mode="after")
    def validate_notes(self) -> ClusterRequest:
        ids = [note.id for note in self.notes]
        if len(set(ids)) != len(ids):
            raise ValueError("Note IDs must be unique.")
        if self.cluster_count > len(self.notes):
            raise ValueError("The cluster count cannot exceed the note count.")
        dimensions = {len(note.vector) for note in self.notes}
        if len(dimensions) != 1:
            raise ValueError("All note vectors must have the same dimension.")
        return self


class ClusterGroup(BaseModel):
    id: str
    label: str
    note_ids: list[str]
    size: int


class NoteAssignment(BaseModel):
    note_id: str
    group_id: str


class ClusterResponse(BaseModel):
    algorithm: Literal["kmeans_l2_normalized"]
    embedding_model: str
    metric: Literal["centered", "raw"]
    cluster_count: int
    groups: list[ClusterGroup]
    assignments: list[NoteAssignment]


app = FastAPI(title="IdeaForge Similarity Clustering", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ideaforge-clustering"}


@app.post("/clusters", response_model=ClusterResponse)
def clusters(request: ClusterRequest) -> ClusterResponse:
    vectors = np.asarray([note.vector for note in request.notes], dtype=np.float64)

    if request.metric == "centered":
        vectors = vectors - vectors.mean(axis=0, keepdims=True)

    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    if np.any(norms <= 1e-12):
        raise HTTPException(
            status_code=422,
            detail="The requested method produced zero-length vectors; choose a different method or note set.",
        )

    normalized_vectors = vectors / norms
    estimator = KMeans(n_clusters=request.cluster_count, random_state=42, n_init=10, max_iter=300)
    labels = estimator.fit_predict(normalized_vectors)
    distinct_labels = np.unique(labels)
    if len(distinct_labels) != request.cluster_count:
        raise HTTPException(
            status_code=422,
            detail="There are not enough distinct note vectors to form the requested number of groups.",
        )

    label_order = sorted(
        (int(label) for label in distinct_labels),
        key=lambda label: int(np.flatnonzero(labels == label)[0]),
    )
    group_id_by_label = {label: f"group-{index + 1}" for index, label in enumerate(label_order)}
    groups: list[ClusterGroup] = []
    for index, label in enumerate(label_order, start=1):
        note_ids = [note.id for note_index, note in enumerate(request.notes) if labels[note_index] == label]
        groups.append(ClusterGroup(
            id=group_id_by_label[label],
            label=f"Group {index}",
            note_ids=note_ids,
            size=len(note_ids),
        ))

    assignments = [
        NoteAssignment(note_id=note.id, group_id=group_id_by_label[int(labels[index])])
        for index, note in enumerate(request.notes)
    ]
    return ClusterResponse(
        algorithm="kmeans_l2_normalized",
        embedding_model=request.embedding_model,
        metric=request.metric,
        cluster_count=request.cluster_count,
        groups=groups,
        assignments=assignments,
    )
