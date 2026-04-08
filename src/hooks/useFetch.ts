import { useState, useEffect, useCallback } from 'react';

interface FetchState<T> {
    data: T;
    loading: boolean;
    error: string | null;
    refetch: () => void;
    isStale: boolean;
}

function useFetch<T>(
    url: string,
    fallback: T,
    options?: { skip?: boolean }
): FetchState<T> {
    const [data, setData] = useState<T>(fallback);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const [isStale, setIsStale] = useState(false);

    const fetchData = useCallback(async () => {
        if (options?.skip) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(url, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const json = await response.json();
            setData(json.data ?? json);
            setIsStale(false);
        } catch (err) {
            setData(fallback);
            setError(err instanceof Error ? err.message : 'An error occurred');
            setIsStale(true);
        } finally {
            setLoading(false);
        }
    }, [url, fallback, options?.skip]);

    useEffect(() => {
        fetchData();
    }, [fetchData, tick]);

    const refetch = () => setTick((prev) => prev + 1);

    return { data, loading, error, refetch, isStale };
}

export { useFetch };