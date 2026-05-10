"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Trash2, Download, File, FileText, FileImage, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiGet, apiDelete } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Document = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (mimeType.includes("pdf"))      return <FileText   className="w-4 h-4 text-red-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  entityType: string;
  entityId: string;
  canUpload?: boolean;
}

export function DocumentAttachments({ entityType, entityId, canUpload = true }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    apiGet<{ documents: Document[] }>(`/api/documents?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => setDocuments(r.documents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large — max 10 MB");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api/documents?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
            "Content-Length": String(file.size),
          },
          body: file,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json() as { document: Document };
      setDocuments((d) => [data.document, ...d]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).forEach(uploadFile);
  }

  async function remove(id: string) {
    await apiDelete(`/api/documents/${id}`).catch(() => {});
    setDocuments((d) => d.filter((doc) => doc.id !== id));
  }

  function download(id: string, name: string) {
    const a = document.createElement("a");
    a.href = `${BASE_URL}/api/documents/${id}/download`;
    a.download = name;
    a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Attachments</h3>
        <span className="text-xs text-muted-foreground">({documents.length})</span>
      </div>

      {/* Upload zone */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
            uploading && "opacity-60 pointer-events-none"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
          {uploading ? (
            <p className="text-xs text-muted-foreground">Uploading…</p>
          ) : (
            <>
              <p className="text-xs font-medium">Drop files here or click to upload</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Max 10 MB per file</p>
            </>
          )}
        </div>
      )}

      {/* File list */}
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {!loading && documents.length === 0 && !canUpload && (
        <p className="text-xs text-muted-foreground">No attachments</p>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 group hover:bg-muted/40 transition-colors">
          {fileIcon(doc.mimeType)}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{doc.originalName}</p>
            <p className="text-[11px] text-muted-foreground">{fmtSize(doc.size)}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => download(doc.id, doc.originalName)}
              className="p-1 rounded hover:bg-muted"
              title="Download"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {canUpload && (
              <button
                onClick={() => remove(doc.id)}
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
