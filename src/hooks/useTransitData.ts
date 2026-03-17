import { useState, useEffect, useCallback, useRef } from "react";
import { VIA_API } from "../constants/config";
import {
  fetchVehiclePositions,
  fetchTripUpdates,
  fetchServiceAlerts,
  buildRoutesSummary,
} from "../services/viaTransitService";
import { fetchBikeFacilities } from "../services/bikeService";
import type {
  VehiclePosition,
  TripUpdate,
  ServiceAlert,
  TransitRoute,
  BikeFeature,
} from "../types/transit";

export interface TransitDataState {
  vehicles: VehiclePosition[];
  tripUpdates: TripUpdate[];
  alerts: ServiceAlert[];
  routes: TransitRoute[];
  bikeRoutes: BikeFeature[];
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export function useTransitData() {
  const [state, setState] = useState<TransitDataState>({
    vehicles: [],
    tripUpdates: [],
    alerts: [],
    routes: [],
    bikeRoutes: [],
    isLoading: true,
    lastUpdated: null,
    error: null,
  });

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const refreshVehicles = useCallback(async () => {
    try {
      const vehicles = await fetchVehiclePositions();
      setState((prev) => {
        const routes = buildRoutesSummary(vehicles, prev.tripUpdates, prev.alerts);
        return {
          ...prev,
          vehicles,
          routes,
          lastUpdated: new Date(),
          isLoading: false,
          error: null,
        };
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: "Failed to refresh vehicle positions",
        isLoading: false,
      }));
    }
  }, []);

  const refreshTripUpdates = useCallback(async () => {
    try {
      const tripUpdates = await fetchTripUpdates();
      setState((prev) => {
        const routes = buildRoutesSummary(prev.vehicles, tripUpdates, prev.alerts);
        return { ...prev, tripUpdates, routes };
      });
    } catch {
      // Silent fail for trip updates - vehicle positions are more critical
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const alerts = await fetchServiceAlerts();
      setState((prev) => {
        const routes = buildRoutesSummary(prev.vehicles, prev.tripUpdates, alerts);
        return { ...prev, alerts, routes };
      });
    } catch {
      // Silent fail for alerts
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await Promise.all([refreshVehicles(), refreshTripUpdates(), refreshAlerts()]);
  }, [refreshVehicles, refreshTripUpdates, refreshAlerts]);

  // Initial load + bike routes (one-time fetch)
  useEffect(() => {
    refreshAll();
    fetchBikeFacilities().then((bikeRoutes) => {
      setState((prev) => ({ ...prev, bikeRoutes }));
    });
  }, [refreshAll]);

  // Set up polling intervals
  useEffect(() => {
    const vehicleInterval = setInterval(refreshVehicles, VIA_API.VEHICLE_REFRESH_MS);
    const tripInterval = setInterval(refreshTripUpdates, VIA_API.TRIPS_REFRESH_MS);
    const alertInterval = setInterval(refreshAlerts, VIA_API.ALERTS_REFRESH_MS);

    intervalsRef.current = [vehicleInterval, tripInterval, alertInterval];

    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, [refreshVehicles, refreshTripUpdates, refreshAlerts]);

  return { ...state, refreshAll };
}

// Hook to get delay info for a specific route
export function useRouteDelay(routeId: string, tripUpdates: TripUpdate[]) {
  const routeUpdates = tripUpdates.filter((tu) => tu.routeId === routeId);
  const maxDelay = Math.max(0, ...routeUpdates.map((tu) => tu.delay));
  const avgDelay =
    routeUpdates.length > 0
      ? routeUpdates.reduce((sum, tu) => sum + tu.delay, 0) / routeUpdates.length
      : 0;

  return {
    maxDelay,
    avgDelay: Math.round(avgDelay),
    delayedTrips: routeUpdates.filter((tu) => tu.delay > 60).length,
    totalTrips: routeUpdates.length,
    isDelayed: maxDelay > 120, // More than 2 minutes late
    isSeverelyDelayed: maxDelay > 600, // More than 10 minutes late
  };
}
