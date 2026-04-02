import { useCallback, useEffect, useRef, useState } from "react";

import { useConfirm } from "../../components/ui/confirm";
import { useToast } from "../../components/ui/toast";
import { ApiError } from "../../services/apiClient";
import {
  listDetailedOutlines,
  getDetailedOutline,
  updateDetailedOutline,
  deleteDetailedOutline,
  createChaptersFromDetailedOutline,
  type DetailedOutlineListItem,
  type DetailedOutline,
  type DetailedOutlineGenerateRequest,
} from "../../services/detailedOutlinesApi";
import { SSEError, SSEPostClient } from "../../services/sseClient";

import { OUTLINE_COPY } from "./outlineCopy";

export type DetailedOutlineProgress = {
  current: number;
  total: number;
  message: string;
};

export type DetailedOutlineState = {
  items: DetailedOutlineListItem[];
  selected: DetailedOutline | null;
  generating: boolean;
  progress: DetailedOutlineProgress | null;
  editing: boolean;
  editContent: string;
  editTitle: string;
  saving: boolean;
  generateModalOpen: boolean;
  refresh: () => Promise<void>;
  selectVolume: (id: string) => Promise<void>;
  deselectVolume: () => void;
  openGenerateModal: () => void;
  closeGenerateModal: () => void;
  generate: (request: DetailedOutlineGenerateRequest, targetOutlineId?: string) => Promise<boolean>;
  cancelGenerate: () => void;
  startEdit: () => void;
  cancelEdit: () => void;
  setEditContent: (value: string) => void;
  setEditTitle: (value: string) => void;
  saveEdit: () => Promise<void>;
  deleteVolume: (id: string) => Promise<void>;
  createChapters: (id: string) => Promise<void>;
};

export function useDetailedOutlineState(
  projectId: string | undefined,
  outlineId: string | undefined,
): DetailedOutlineState {
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<DetailedOutlineListItem[]>([]);
  const [selected, setSelected] = useState<DetailedOutline | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<DetailedOutlineProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const streamClientRef = useRef<SSEPostClient | null>(null);

  useEffect(() => {
    return () => {
      streamClientRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!projectId || !outlineId) {
      setItems([]);
      return;
    }
    try {
      const list = await listDetailedOutlines(projectId, outlineId);
      setItems(list);
    } catch (error) {
      const err = error as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    }
  }, [projectId, outlineId, toast]);

  useEffect(() => {
    if (projectId && outlineId) {
      void refresh();
    } else {
      setItems([]);
      setSelected(null);
    }
  }, [projectId, outlineId, refresh]);

  const selectVolume = useCallback(
    async (id: string) => {
      try {
        const detail = await getDetailedOutline(id);
        setSelected(detail);
        setEditing(false);
      } catch (error) {
        const err = error as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [toast],
  );

  const deselectVolume = useCallback(() => {
    setSelected(null);
    setEditing(false);
  }, []);

  const openGenerateModal = useCallback(() => {
    setGenerateModalOpen(true);
  }, []);

  const closeGenerateModal = useCallback(() => {
    streamClientRef.current?.abort();
    setGenerateModalOpen(false);
  }, []);

  const cancelGenerate = useCallback(() => {
    streamClientRef.current?.abort();
  }, []);

  const generate = useCallback(
    async (request: DetailedOutlineGenerateRequest, targetOutlineId?: string) => {
      const effectiveOutlineId = targetOutlineId || outlineId;
      if (!projectId || !effectiveOutlineId) return false;
      setGenerating(true);
      setProgress({ current: 0, total: 0, message: "..." });
      streamClientRef.current = null;

      try {
        const url = `/api/projects/${projectId}/outlines/${effectiveOutlineId}/detailed_outlines/generate`;
        const client = new SSEPostClient(url, request, {
          onProgress: ({ message, progress: pct }) => {
            setProgress((prev) => ({
              current: prev?.current ?? 0,
              total: prev?.total ?? 0,
              message: message || `${Math.round(pct)}%`,
            }));
          },
          onCustomEvent: (eventName, data) => {
            const obj = data as Record<string, unknown> | null;
            if (eventName === "volume_start") {
              const volNum = typeof obj?.volume_number === "number" ? obj.volume_number : 0;
              const volTitle = typeof obj?.volume_title === "string" ? obj.volume_title : "";
              const total = typeof obj?.total === "number" ? obj.total : 0;
              setProgress({
                current: volNum,
                total,
                message: `${OUTLINE_COPY.detailedOutline.generatingVolumePrefix}${volNum}${OUTLINE_COPY.detailedOutline.volumeSuffix}/${OUTLINE_COPY.detailedOutline.totalPrefix}${total}${OUTLINE_COPY.detailedOutline.volumeSuffix}: ${volTitle}`,
              });
            } else if (eventName === "volume_complete") {
              const volNum = typeof obj?.volume_number === "number" ? obj.volume_number : 0;
              const total = typeof obj?.total === "number" ? obj.total : 0;
              setProgress((prev) => ({
                current: volNum,
                total,
                message: prev?.message ?? "",
              }));
            }
          },
          onDone: () => {
            setProgress((prev) =>
              prev ? { ...prev, message: OUTLINE_COPY.detailedOutline.generateDetailedDone } : prev,
            );
          },
        });
        streamClientRef.current = client;

        await client.connect();
        if (effectiveOutlineId === outlineId) {
          await refresh();
        }
        toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateDetailedDone);
        return true;
      } catch (error) {
        if (error instanceof SSEError && error.code === "ABORTED") {
          toast.toastSuccess(OUTLINE_COPY.detailedOutline.generateCanceled);
          if (effectiveOutlineId === outlineId) {
            await refresh();
          }
          return false;
        }
        if (error instanceof SSEError || error instanceof ApiError) {
          toast.toastError(`${error.message} (${(error as SSEError).code ?? (error as ApiError).code})`);
        } else {
          toast.toastError(OUTLINE_COPY.detailedOutline.generateDetailedFailed);
        }
        return false;
      } finally {
        streamClientRef.current = null;
        setGenerating(false);
        setProgress(null);
      }
    },
    [projectId, outlineId, refresh, toast],
  );

  const startEdit = useCallback(() => {
    if (!selected) return;
    setEditContent(selected.content_md ?? "");
    setEditTitle(selected.volume_title);
    setEditing(true);
  }, [selected]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateDetailedOutline(selected.id, {
        volume_title: editTitle,
        content_md: editContent,
      });
      setSelected(updated);
      setEditing(false);
      await refresh();
      toast.toastSuccess(OUTLINE_COPY.detailedOutline.saveDetailedSuccess);
    } catch (error) {
      const err = error as ApiError;
      toast.toastError(`${err.message} (${err.code})`, err.requestId);
    } finally {
      setSaving(false);
    }
  }, [editContent, editTitle, refresh, selected, toast]);

  const deleteVolumeHandler = useCallback(
    async (id: string) => {
      const ok = await confirm.confirm({
        ...OUTLINE_COPY.detailedOutline.deleteDetailedConfirm,
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteDetailedOutline(id);
        if (selected?.id === id) {
          setSelected(null);
          setEditing(false);
        }
        await refresh();
        toast.toastSuccess(OUTLINE_COPY.detailedOutline.deletedSuccess);
      } catch (error) {
        const err = error as ApiError;
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [confirm, refresh, selected?.id, toast],
  );

  const createChapters = useCallback(
    async (id: string) => {
      const ok = await confirm.confirm({
        title: OUTLINE_COPY.detailedOutline.createChaptersFromDetailed,
        description: OUTLINE_COPY.detailedOutline.createChaptersFromDetailedHint,
        confirmText: OUTLINE_COPY.confirm,
      });
      if (!ok) return;
      try {
        const result = await createChaptersFromDetailedOutline(id);
        toast.toastSuccess(`${OUTLINE_COPY.detailedOutline.createdChaptersPrefix}${result.count}${OUTLINE_COPY.detailedOutline.chapterCountSuffix}`);
        await refresh();
      } catch (error) {
        const err = error as ApiError;
        if (err.code === "CONFLICT" && err.status === 409) {
          const replaceOk = await confirm.confirm({
            title: OUTLINE_COPY.detailedOutline.replaceChaptersTitle,
            description: OUTLINE_COPY.detailedOutline.replaceChaptersDescription,
            confirmText: OUTLINE_COPY.detailedOutline.replaceChaptersConfirmText,
            danger: true,
          });
          if (!replaceOk) return;
          try {
            const retryResult = await createChaptersFromDetailedOutline(id, true);
            toast.toastSuccess(`${OUTLINE_COPY.detailedOutline.replacedChaptersPrefix}${retryResult.count}${OUTLINE_COPY.detailedOutline.chapterCountSuffix}`);
            await refresh();
          } catch (retryError) {
            const retryErr = retryError as ApiError;
            toast.toastError(`${retryErr.message} (${retryErr.code})`, retryErr.requestId);
          }
          return;
        }
        toast.toastError(`${err.message} (${err.code})`, err.requestId);
      }
    },
    [confirm, refresh, toast],
  );

  return {
    items,
    selected,
    generating,
    progress,
    editing,
    editContent,
    editTitle,
    saving,
    generateModalOpen,
    refresh,
    selectVolume,
    deselectVolume,
    openGenerateModal,
    closeGenerateModal,
    generate,
    cancelGenerate,
    startEdit,
    cancelEdit,
    setEditContent,
    setEditTitle,
    saveEdit,
    deleteVolume: deleteVolumeHandler,
    createChapters,
  };
}
