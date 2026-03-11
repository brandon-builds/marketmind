import { useState, useEffect, useRef, useCallback } from "react";

interface PriceTick {
  type: "price_update";
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

interface Snapshot {
  type: "snapshot";
  prices: PriceTick[];
}

interface MarketStatus {
  type: "market_status";
  status: "open" | "closed" | "pre" | "after";
  timestamp: number;
}

type WSMessage = PriceTick | Snapshot | MarketStatus;

export interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  flash?: "up" | "down" | null; // For flash animation
}

export function useWebSocket() {
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [connected, setConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState<string>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setMarketStatus("open");
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        if (msg.type === "snapshot") {
          const snapshot = msg as Snapshot;
          setLivePrices((prev) => {
            const next = new Map(prev);
            for (const tick of snapshot.prices) {
              next.set(tick.symbol, {
                symbol: tick.symbol,
                price: tick.price,
                change: tick.change,
                changePercent: tick.changePercent,
                timestamp: tick.timestamp,
                flash: null,
              });
            }
            return next;
          });
        } else if (msg.type === "price_update") {
          const tick = msg as PriceTick;
          setLivePrices((prev) => {
            const next = new Map(prev);
            const existing = prev.get(tick.symbol);
            const flashDir =
              existing && tick.price !== existing.price
                ? tick.price > existing.price
                  ? "up"
                  : "down"
                : null;

            next.set(tick.symbol, {
              symbol: tick.symbol,
              price: tick.price,
              change: tick.change,
              changePercent: tick.changePercent,
              timestamp: tick.timestamp,
              flash: flashDir,
            });

            // Clear flash after 600ms
            if (flashDir) {
              const existingTimeout = flashTimeoutsRef.current.get(tick.symbol);
              if (existingTimeout) clearTimeout(existingTimeout);

              flashTimeoutsRef.current.set(
                tick.symbol,
                setTimeout(() => {
                  setLivePrices((p) => {
                    const n = new Map(p);
                    const current = n.get(tick.symbol);
                    if (current) {
                      n.set(tick.symbol, { ...current, flash: null });
                    }
                    return n;
                  });
                  flashTimeoutsRef.current.delete(tick.symbol);
                }, 600)
              );
            }

            return next;
          });
        } else if (msg.type === "market_status") {
          setMarketStatus((msg as MarketStatus).status);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      flashTimeoutsRef.current.forEach((t) => clearTimeout(t));
      flashTimeoutsRef.current.clear();
    };
  }, [connect]);

  return { livePrices, connected, marketStatus };
}
