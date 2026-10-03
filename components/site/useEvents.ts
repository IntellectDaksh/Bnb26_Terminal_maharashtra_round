"use client";

import { useEffect, useState } from "react";
import type { EventInfo, MyEntries } from "@/lib/contracts";
import { api, ApiError, backoff } from "@/lib/api";

/** Poll a list endpoint: 5s normally, jittered backoff on failure, paused while the tab is hidden. */
function usePoll<T>(fetcher: () => Promise<T>, everyMs = 5_000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  useEffect(() => {
    let stop = false;
    let fails = 0;
    let t: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.visibilityState === "visible") {
        try {
          const d = await fetcher();
          if (stop) return;
          setData(d);
          setError(undefined);
          fails = 0;
        } catch (e) {
          fails++;
          if (!stop) setError(e instanceof ApiError ? e : new ApiError(0, "unknown", "Something went wrong."));
        }
      }
      if (!stop) t = setTimeout(run, fails ? backoff(fails, 2_000, 30_000) + 1_000 : everyMs);
    };
    run();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [fetcher, everyMs]);
  return { data, error };
}

const listEvents = () => api.listEvents();
const myEntries = () => api.myEntries();

export const useEvents = () => usePoll<EventInfo[]>(listEvents);
export const useMyEntries = () => usePoll<MyEntries["entries"]>(myEntries);
