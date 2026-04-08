"use client";

import { useState, useEffect } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

export const LUCKNOW_FALLBACK = { lat: 26.8467, lng: 80.9462 };

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    error: null,
    loading: true,
    retry: () => {},
  });

  const getPosition = () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          error: null,
          loading: false,
          retry: getPosition,
        });
      },
      (error) => {
        setState({
          lat: LUCKNOW_FALLBACK.lat,
          lng: LUCKNOW_FALLBACK.lng,
          error: "Location नहीं मिली — manual select करें",
          loading: false,
          retry: getPosition,
        });
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };

  useEffect(() => {
    getPosition();
  }, []);

  return state;
}
