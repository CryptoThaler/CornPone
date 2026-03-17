import React from "react";
import { Polyline } from "react-native-maps";
import { COLORS } from "../constants/config";
import type { BikeFeature } from "../types/transit";

interface BikeRouteOverlayProps {
  bikeRoutes: BikeFeature[];
  showExisting?: boolean;
  showPlanned?: boolean;
}

const TYPE_COLORS: Record<BikeFeature["type"], string> = {
  bike_lane: COLORS.bikeLane,
  bike_path: COLORS.bikePath,
  bike_route: COLORS.bikeRoute,
  bike_trail: COLORS.bikeTrail,
  shared_lane: "#FFD600",
};

const TYPE_WIDTHS: Record<BikeFeature["type"], number> = {
  bike_lane: 4,
  bike_path: 5,
  bike_route: 3,
  bike_trail: 5,
  shared_lane: 3,
};

const STATUS_DASH: Record<BikeFeature["status"], number[] | undefined> = {
  existing: undefined,
  planned: [10, 5],
  under_construction: [5, 5],
};

export function BikeRouteOverlay({
  bikeRoutes,
  showExisting = true,
  showPlanned = true,
}: BikeRouteOverlayProps) {
  const filteredRoutes = bikeRoutes.filter((route) => {
    if (route.status === "existing" && !showExisting) return false;
    if (
      (route.status === "planned" || route.status === "under_construction") &&
      !showPlanned
    )
      return false;
    return route.coordinates.length >= 2;
  });

  return (
    <>
      {filteredRoutes.map((route) => (
        <Polyline
          key={route.id}
          coordinates={route.coordinates}
          strokeColor={TYPE_COLORS[route.type] || COLORS.bikeRoute}
          strokeWidth={TYPE_WIDTHS[route.type] || 3}
          lineDashPattern={STATUS_DASH[route.status]}
          lineCap="round"
          lineJoin="round"
          zIndex={1}
        />
      ))}
    </>
  );
}
