// src/services/api.js
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

export const getFirmalar   = () => api.get("/firmalar").then(r => r.data);
export const addFirma      = (data) => api.post("/firmalar", data).then(r => r.data);
export const deleteFirma   = (id) => api.delete(`/firmalar/${id}`).then(r => r.data);
export const updateFirma   = (id, data) => api.put(`/firmalar/${id}`, data).then(r => r.data);
