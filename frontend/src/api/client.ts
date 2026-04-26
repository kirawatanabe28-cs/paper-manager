import axios from 'axios';
import type { Project, Paper, PaperDetail, GraphData } from '../types';

const api = axios.create({ baseURL: '/api' });

// ---- Projects ----
export const getProjects = () =>
  api.get<Project[]>('/projects').then(r => r.data);

export const createProject = (name: string, description: string) =>
  api.post<Project>('/projects', { name, description }).then(r => r.data);

export const getProject = (projectId: number) =>
  api.get<Project>(`/projects/${projectId}`).then(r => r.data);

export const deleteProject = (projectId: number) =>
  api.delete(`/projects/${projectId}`);

// ---- Papers ----
export const getPapers = (projectId: number) =>
  api.get<Paper[]>(`/projects/${projectId}/papers`).then(r => r.data);

export const getPaper = (projectId: number, paperId: number) =>
  api.get<PaperDetail>(`/projects/${projectId}/papers/${paperId}`).then(r => r.data);

export const getPapersForCitation = (
  projectId: number,
  year: number,
  direction: 'citing' | 'cited_by',
  excludeId?: number,
) =>
  api
    .get<Paper[]>(`/projects/${projectId}/papers/for-citation`, {
      params: { year, direction, exclude_id: excludeId },
    })
    .then(r => r.data);

export const uploadPaper = (
  projectId: number,
  data: {
    title: string;
    year: number;
    description: string;
    file: File;
    citingPaperIds: number[];
    citedByPaperIds: number[];
  },
) => {
  const form = new FormData();
  form.append('title', data.title);
  form.append('year', String(data.year));
  form.append('description', data.description);
  form.append('file', data.file);
  form.append('citing_paper_ids', JSON.stringify(data.citingPaperIds));
  form.append('cited_by_paper_ids', JSON.stringify(data.citedByPaperIds));
  return api.post<Paper>(`/projects/${projectId}/papers`, form).then(r => r.data);
};

export const updatePaper = (
  projectId: number,
  paperId: number,
  data: {
    title: string;
    year: number;
    description: string;
    citingPaperIds: number[];
    citedByPaperIds: number[];
  },
) =>
  api.put<Paper>(`/projects/${projectId}/papers/${paperId}`, {
    title: data.title,
    year: data.year,
    description: data.description,
    citing_paper_ids: data.citingPaperIds,
    cited_by_paper_ids: data.citedByPaperIds,
  }).then(r => r.data);

export const deletePaper = (projectId: number, paperId: number) =>
  api.delete(`/projects/${projectId}/papers/${paperId}`);

// ---- Graph ----
export const getGraph = (projectId: number) =>
  api.get<GraphData>(`/projects/${projectId}/graph`).then(r => r.data);

export const getSubgraph = (projectId: number, paperId: number) =>
  api.get<GraphData>(`/projects/${projectId}/graph/${paperId}`).then(r => r.data);
