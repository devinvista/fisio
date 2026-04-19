import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import {
  Camera,
  Upload,
  X,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageOff,
  ZoomIn,
  Calendar,
  Tag,
  Info,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewType = "frontal" | "lateral_d" | "lateral_e" | "posterior" | "detalhe";

interface PatientPhoto {
  id: number;
  patientId: number;
  clinicId: number | null;
  takenAt: string;
  viewType: ViewType;
  sessionLabel: string | null;
  objectPath: string;
  originalFilename: string | null;
  contentType: string | null;
  fileSize: number | null;
  notes: string | null;
  createdAt: string;
}

interface PhotoSession {
  dateKey: string;
  label: string | null;
  photos: PatientPhoto[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEW_LABELS: Record<ViewType, string> = {
  frontal: "Frontal",
  lateral_d: "Lateral Dir.",
  lateral_e: "Lateral Esq.",
  posterior: "Posterior",
  detalhe: "Detalhe",
};

const VIEW_ORDER: ViewType[] = [
  "frontal",
  "lateral_d",
  "lateral_e",
  "posterior",
  "detalhe",
];

const VIEW_COLORS: Record<ViewType, string> = {
  frontal: "bg-blue-100 text-blue-700 border-blue-200",
  lateral_d: "bg-violet-100 text-violet-700 border-violet-200",
  lateral_e: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  posterior: "bg-amber-100 text-amber-700 border-amber-200",
  detalhe: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const MAX_PHOTO_SIZE = 15 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBySession(photos: PatientPhoto[]): PhotoSession[] {
  const map = new Map<string, PatientPhoto[]>();
  for (const p of photos) {
    const key = p.takenAt.split("T")[0];
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, photos]) => ({
      dateKey,
      label: photos[0].sessionLabel,
      photos,
    }));
}

function formatDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── AuthImage — fetches private GCS objects with Bearer token ────────────────

function AuthImage({
  objectPath,
  alt,
  className,
  style,
  draggable,
}: {
  objectPath: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    setError(false);
    setSrc(null);

    if (!token) {
      setError(true);
      return;
    }

    apiFetch(`/api/storage${objectPath}`)
      .then((res) => {
        if (!res.ok) throw new Error("not ok");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [objectPath, token]);

  if (error)
    return (
      <div className={`bg-slate-100 flex items-center justify-center ${className ?? ""}`} style={style}>
        <ImageOff className="w-5 h-5 text-slate-300" />
      </div>
    );

  if (!src)
    return (
      <div className={`bg-slate-100 animate-pulse ${className ?? ""}`} style={style} />
    );

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      draggable={draggable}
    />
  );
}

// ─── Before/After Slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({
  beforePath,
  afterPath,
  beforeLabel,
  afterLabel,
}: {
  beforePath: string;
  afterPath: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    updatePosition(e.clientX);
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current) return;
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  const containerWidth = containerRef.current?.clientWidth ?? 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden select-none cursor-ew-resize bg-black"
      style={{ aspectRatio: "3/4", maxHeight: "560px" }}
      onMouseDown={onMouseDown}
      onTouchStart={(e) => {
        isDragging.current = true;
        updatePosition(e.touches[0].clientX);
      }}
    >
      {/* After (right) — full width */}
      <AuthImage
        objectPath={afterPath}
        alt="Depois"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Before (left) — clipped */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <AuthImage
          objectPath={beforePath}
          alt="Antes"
          className="absolute inset-0 object-cover"
          style={{ width: containerWidth || "100%", height: "100%" }}
          draggable={false}
        />
      </div>

      {/* Divider */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl border-2 border-primary flex items-center justify-center pointer-events-auto">
          <ChevronLeft className="w-3 h-3 text-primary absolute left-1" />
          <ChevronRight className="w-3 h-3 text-primary absolute right-1" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none">
        <span className="px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm">
          {beforeLabel}
        </span>
      </div>
      <div className="absolute top-3 right-3 z-20 pointer-events-none">
        <span className="px-2 py-1 bg-primary/80 text-white text-xs rounded-md backdrop-blur-sm">
          {afterLabel}
        </span>
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <span className="px-3 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm">
          Arraste para comparar
        </span>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  open,
  patientId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewType, setViewType] = useState<ViewType>("frontal");
  const [takenAt, setTakenAt] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [sessionLabel, setSessionLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setPreviews((prev) => {
      prev.forEach(URL.revokeObjectURL);
      return [];
    });
    setViewType("frontal");
    setTakenAt(new Date().toISOString().split("T")[0]);
    setSessionLabel("");
    setNotes("");
    setProgress({ done: 0, total: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files ?? []);
    const selected = allFiles.filter((f) => ALLOWED_PHOTO_TYPES.has(f.type) && f.size <= MAX_PHOTO_SIZE);
    const rejected = allFiles.length - selected.length;
    if (rejected > 0) {
      toast({
        title: `${rejected} arquivo(s) ignorado(s)`,
        description: "Use JPG, PNG, WebP ou HEIC com até 15MB por foto.",
        variant: "destructive",
      });
    }
    setFiles(selected);
    setPreviews((prev) => {
      prev.forEach(URL.revokeObjectURL);
      return selected.map(URL.createObjectURL);
    });
  };

  const uploadSingle = async (file: File): Promise<void> => {
    const urlRes = await apiFetch("/api/storage/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    if (!urlRes.ok) throw new Error("Falha ao obter URL de upload");
    const { uploadURL, objectPath } = await urlRes.json();

    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error("Falha ao enviar arquivo");

    const metaRes = await apiFetch(`/api/patients/${patientId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectPath,
        originalFilename: file.name,
        contentType: file.type,
        fileSize: file.size,
        viewType,
        takenAt: `${takenAt}T12:00:00.000Z`,
        sessionLabel: sessionLabel || null,
        notes: notes || null,
      }),
    });
    if (!metaRes.ok) throw new Error("Falha ao salvar metadados");
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let errors = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadSingle(files[i]);
        setProgress({ done: i + 1, total: files.length });
      } catch (err) {
        console.error(err);
        errors++;
      }
    }
    setUploading(false);
    if (errors === 0) {
      toast({ title: `${files.length} foto(s) enviada(s) com sucesso!` });
      onSuccess();
      handleClose();
    } else {
      toast({
        title: `${files.length - errors} de ${files.length} enviadas`,
        description: `${errors} arquivo(s) falharam.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" /> Adicionar Fotos
          </DialogTitle>
          <DialogDescription>
            Selecione as imagens e informe a vista e a data da sessão fotográfica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <Label>Imagens *</Label>
            <div
              className="mt-1.5 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {previews.length === 0 ? (
                <>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Clique para selecionar ou arraste aqui
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    JPG, PNG, WebP · máx. 15MB por arquivo
                  </p>
                </>
              ) : (
                <div className="flex gap-2 flex-wrap justify-center">
                  {previews.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg border"
                      />
                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                    <Upload className="w-5 h-5" />
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vista *</Label>
              <Select
                value={viewType}
                onValueChange={(v) => setViewType(v as ViewType)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_ORDER.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VIEW_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data da Sessão *</Label>
              <Input
                type="date"
                className="mt-1.5"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div>
            <Label>Rótulo da Sessão (opcional)</Label>
            <Input
              className="mt-1.5"
              placeholder="Ex: Avaliação Inicial, Mês 1, Pós-tratamento…"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              className="mt-1.5 resize-none"
              rows={2}
              placeholder="Notas clínicas sobre esta foto…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Enviando {progress.done + 1} de {progress.total}…
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Enviar {files.length > 1 ? `${files.length} fotos` : "foto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────

function PhotoLightbox({
  photo,
  onClose,
  onDelete,
}: {
  photo: PatientPhoto;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="relative bg-black">
            <AuthImage
              objectPath={photo.objectPath}
              alt={VIEW_LABELS[photo.viewType as ViewType]}
              className="w-full max-h-[75vh] object-contain"
            />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${VIEW_COLORS[photo.viewType as ViewType]}`}
                >
                  {VIEW_LABELS[photo.viewType as ViewType]}
                </Badge>
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(photo.takenAt)}
                </span>
                {photo.sessionLabel && (
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    {photo.sessionLabel}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            </div>
            {photo.notes && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 flex gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                {photo.notes}
              </p>
            )}
            {photo.originalFilename && (
              <p className="text-xs text-slate-400">
                {photo.originalFilename}
                {photo.fileSize && ` · ${formatBytes(photo.fileSize)}`}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto será removida
              permanentemente do prontuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
                onClose();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Compare Modal ────────────────────────────────────────────────────────────

function CompareModal({
  open,
  sessions,
  onClose,
}: {
  open: boolean;
  sessions: PhotoSession[];
  onClose: () => void;
}) {
  const [beforeKey, setBeforeKey] = useState<string>("");
  const [afterKey, setAfterKey] = useState<string>("");
  const [viewType, setViewType] = useState<ViewType>("frontal");

  const beforeSession = sessions.find((s) => s.dateKey === beforeKey);
  const afterSession = sessions.find((s) => s.dateKey === afterKey);
  const beforePhoto = beforeSession?.photos.find((p) => p.viewType === viewType);
  const afterPhoto = afterSession?.photos.find((p) => p.viewType === viewType);

  const availableViews = (() => {
    if (!beforeSession || !afterSession) return VIEW_ORDER;
    const bv = new Set(beforeSession.photos.map((p) => p.viewType));
    const av = new Set(afterSession.photos.map((p) => p.viewType));
    return VIEW_ORDER.filter((v) => bv.has(v) && av.has(v));
  })();

  useEffect(() => {
    if (sessions.length >= 2) {
      setBeforeKey(sessions[sessions.length - 1].dateKey);
      setAfterKey(sessions[0].dateKey);
    }
  }, [sessions]);

  useEffect(() => {
    if (availableViews.length > 0 && !availableViews.includes(viewType)) {
      setViewType(availableViews[0]);
    }
  }, [availableViews, viewType]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" /> Comparar
            Fotos
          </DialogTitle>
          <DialogDescription>
            Selecione duas sessões e a vista para ver a evolução lado a lado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Antes</Label>
            <Select value={beforeKey} onValueChange={setBeforeKey}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione sessão" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem
                    key={s.dateKey}
                    value={s.dateKey}
                    disabled={s.dateKey === afterKey}
                  >
                    {formatDate(s.dateKey + "T12:00:00")}
                    {s.label ? ` · ${s.label}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Depois</Label>
            <Select value={afterKey} onValueChange={setAfterKey}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione sessão" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem
                    key={s.dateKey}
                    value={s.dateKey}
                    disabled={s.dateKey === beforeKey}
                  >
                    {formatDate(s.dateKey + "T12:00:00")}
                    {s.label ? ` · ${s.label}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vista</Label>
            <Select
              value={viewType}
              onValueChange={(v) => setViewType(v as ViewType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableViews.map((v) => (
                  <SelectItem key={v} value={v}>
                    {VIEW_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2">
          {beforePhoto && afterPhoto ? (
            <BeforeAfterSlider
              beforePath={beforePhoto.objectPath}
              afterPath={afterPhoto.objectPath}
              beforeLabel={formatDate(beforePhoto.takenAt)}
              afterLabel={formatDate(afterPhoto.takenAt)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-400">
              <ImageOff className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">
                {!beforeKey || !afterKey
                  ? "Selecione as duas sessões para comparar"
                  : `Nenhuma foto "${VIEW_LABELS[viewType]}" em uma das sessões`}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onPhotoDeleted,
}: {
  session: PhotoSession;
  onPhotoDeleted: (photoId: number) => void;
}) {
  const [lightbox, setLightbox] = useState<PatientPhoto | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Camera className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-800">
              {formatDate(session.dateKey + "T12:00:00")}
            </p>
            {session.label && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" /> {session.label}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {session.photos.length} foto{session.photos.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {VIEW_ORDER.map((viewType) => {
            const photo = session.photos.find((p) => p.viewType === viewType);
            if (!photo) return null;
            return (
              <button
                key={photo.id}
                className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all"
                onClick={() => setLightbox(photo)}
              >
                <AuthImage
                  objectPath={photo.objectPath}
                  alt={VIEW_LABELS[viewType]}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                </div>
                <div className="absolute top-1.5 left-1.5">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${VIEW_COLORS[viewType]}`}
                  >
                    {VIEW_LABELS[viewType]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <PhotoLightbox
          photo={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={() => onPhotoDeleted(lightbox.id)}
        />
      )}
    </>
  );
}

// ─── Main PhotosTab ───────────────────────────────────────────────────────────

export function PhotosTab({ patientId }: { patientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: photos = [], isLoading } = useQuery<PatientPhoto[]>({
    queryKey: ["patient-photos", patientId],
    queryFn: async () => {
      const res = await apiFetch(`/api/patients/${patientId}/photos`);
      if (!res.ok) throw new Error("Falha ao carregar fotos");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const res = await apiFetch(`/api/patients/${patientId}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao excluir foto");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-photos", patientId] });
      toast({ title: "Foto excluída com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao excluir foto.", variant: "destructive" });
    },
  });

  const sessions = groupBySession(photos);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Acompanhamento Fotográfico
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Registre a evolução visual do paciente ao longo do tratamento
          </p>
        </div>
        <div className="flex gap-2">
          {sessions.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen(true)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" /> Comparar
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" /> Adicionar Fotos
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
          <p className="text-sm">Carregando fotos…</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
          <Camera className="w-12 h-12 mb-4 text-slate-300" />
          <p className="font-medium text-slate-500">Nenhuma foto registrada</p>
          <p className="text-sm mt-1 mb-5">
            Adicione fotos para acompanhar a evolução visual do tratamento
          </p>
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" /> Adicionar Primeiras Fotos
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 text-center">
              <p className="text-2xl font-bold text-primary">{sessions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Sessões</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
              <p className="text-2xl font-bold text-slate-700">{photos.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Fotos no total</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
              <p className="text-2xl font-bold text-slate-700">
                {sessions.length > 1
                  ? (() => {
                      const first = new Date(
                        sessions[sessions.length - 1].dateKey
                      );
                      const last = new Date(sessions[0].dateKey);
                      const days = Math.round(
                        (last.getTime() - first.getTime()) / 86400000
                      );
                      return days >= 30
                        ? `${Math.round(days / 30)}m`
                        : `${days}d`;
                    })()
                  : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Período</p>
            </div>
          </div>

          {/* Sessions */}
          {sessions.map((session) => (
            <SessionCard
              key={session.dateKey}
              session={session}
              onPhotoDeleted={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        open={uploadOpen}
        patientId={patientId}
        onClose={() => setUploadOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: ["patient-photos", patientId],
          })
        }
      />

      <CompareModal
        open={compareOpen}
        sessions={sessions}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
