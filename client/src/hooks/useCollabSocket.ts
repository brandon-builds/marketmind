import { useState, useEffect, useRef, useCallback } from "react";

interface CollabViewer {
  userId: string;
  userName: string;
}

interface CollabAnnotation {
  id: number;
  ticker: string;
  content: string;
  sentiment: string | null;
  userName: string;
  userId: string;
  createdAt: number;
}

interface CollabPresenceMsg {
  type: "collab_presence";
  watchlistId: number;
  viewers: CollabViewer[];
}

interface CollabAnnotationMsg {
  type: "collab_annotation";
  watchlistId: number;
  annotation: CollabAnnotation;
}

interface CollabAnnotationDeletedMsg {
  type: "collab_annotation_deleted";
  watchlistId: number;
  annotationId: number;
}

type CollabMessage = CollabPresenceMsg | CollabAnnotationMsg | CollabAnnotationDeletedMsg;

export function useCollabSocket(watchlistId: number | null, userId?: number, userName?: string) {
  const [viewers, setViewers] = useState<CollabViewer[]>([]);
  const [liveAnnotations, setLiveAnnotations] = useState<CollabAnnotation[]>([]);
  const [deletedAnnotationIds, setDeletedAnnotationIds] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!watchlistId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Join the collab channel
      ws.send(JSON.stringify({
        type: "collab_join",
        watchlistId,
        userId: String(userId),
        userName: userName || "Anonymous",
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "collab_presence" && msg.watchlistId === watchlistId) {
          const presenceMsg = msg as CollabPresenceMsg;
          setViewers(presenceMsg.viewers);
        } else if (msg.type === "collab_annotation" && msg.watchlistId === watchlistId) {
          const annotMsg = msg as CollabAnnotationMsg;
          setLiveAnnotations((prev) => {
            // Avoid duplicates
            if (prev.some((a) => a.id === annotMsg.annotation.id)) return prev;
            return [annotMsg.annotation, ...prev];
          });
        } else if (msg.type === "collab_annotation_deleted" && msg.watchlistId === watchlistId) {
          const delMsg = msg as CollabAnnotationDeletedMsg;
          setDeletedAnnotationIds((prev) => { const next = new Set(Array.from(prev)); next.add(delMsg.annotationId); return next; });
          setLiveAnnotations((prev) => prev.filter((a) => a.id !== delMsg.annotationId));
        }
      } catch {
        // Ignore non-collab messages (price ticks, etc.)
      }
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [watchlistId, userId, userName]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        // Send leave message before closing
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "collab_leave" }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      // Reset state on unmount
      setViewers([]);
      setLiveAnnotations([]);
      setDeletedAnnotationIds(new Set());
    };
  }, [connect]);

  // When watchlist changes, reset live state
  useEffect(() => {
    setLiveAnnotations([]);
    setDeletedAnnotationIds(new Set());
  }, [watchlistId]);

  return { viewers, liveAnnotations, deletedAnnotationIds };
}
