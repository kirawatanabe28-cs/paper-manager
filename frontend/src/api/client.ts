import axios from 'axios';
import type { Project, Paper, PaperDetail, GraphData, UrlItem } from '../types';

const api = axios.create({ baseURL: '/api' });

// ---- Projects ----
export const getProjects = () =>
  api.get<Project[]>('/projects/').then(r => r.data);

export const createProject = (name: string, description: string) =>
  api.post<Project>('/projects/', { name, description }).then(r => r.data);

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
    urls: UrlItem[];
    rawRefs?: string[];
  },
) => {
  const form = new FormData();
  form.append('title', data.title);
  form.append('year', String(data.year));
  form.append('description', data.description);
  form.append('file', data.file);
  form.append('citing_paper_ids', JSON.stringify(data.citingPaperIds));
  form.append('cited_by_paper_ids', JSON.stringify(data.citedByPaperIds));
  form.append('urls', JSON.stringify(data.urls));
  form.append('raw_refs', JSON.stringify(data.rawRefs ?? []));
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
    urls: UrlItem[];
  },
) =>
  api.put<Paper>(`/projects/${projectId}/papers/${paperId}`, {
    title: data.title,
    year: data.year,
    description: data.description,
    citing_paper_ids: data.citingPaperIds,
    cited_by_paper_ids: data.citedByPaperIds,
    urls: data.urls,
  }).then(r => r.data);

export const deletePaper = (projectId: number, paperId: number) =>
  api.delete(`/projects/${projectId}/papers/${paperId}`);

// ---- GROBID ----
export const extractHeader = (file: File): Promise<{ title: string; year: number | null }> => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ title: string; year: number | null }>('/grobid/extract-title', form).then(r => r.data);
};

export const analyzeCitations = (
  projectId: number,
  title: string,
  year: number,
  file: File,
): Promise<{ citing_ids: number[]; cited_by_ids: number[]; raw_refs: string[] }> => {
  const form = new FormData();
  form.append('title', title);
  form.append('year', String(year));
  form.append('file', file);
  return api
    .post(`/projects/${projectId}/analyze-citations`, form)
    .then(r => r.data);
};

// ---- Graph ----
export const getGraph = (projectId: number) =>
  api.get<GraphData>(`/projects/${projectId}/graph`).then(r => r.data);

export const getSubgraph = (projectId: number, paperId: number) =>
  api.get<GraphData>(`/projects/${projectId}/graph/${paperId}`).then(r => r.data);
