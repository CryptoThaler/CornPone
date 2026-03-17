import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Region, Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SA_CENTER, BIKE_FOCUS_AREAS } from "../../src/constants/config";
import { useTransitData } from "../../src/hooks/useTransitData";
import { useUserLocation } from "../../src/hooks/useLocation";
import { BikeRouteOverlay } from "../../src/components/BikeRouteOverlay";

const BIKE_CENTER = {
  latitude: 29.4320,
  longitude: -98.4920,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function BikeScreen() {
  const { bikeRoutes } = useTransitData();
  const { location } = useUserLocation();
  const mapRef = useRef<MapView>(null);

  const [showExisting, setShowExisting] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const focusOnArea = (key: string) => {
    const area = BIKE_FOCUS_AREAS[key as keyof typeof BIKE_FOCUS_AREAS];
    if (area && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: area.latitude,
          longitude: area.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
      setSelectedArea(key);
    }
  };

  const existingCount = bikeRoutes.filter((r) => r.status === "existing").length;
  const plannedCount = bikeRoutes.filter(
    (r) => r.status === "planned" || r.status === "under_construction"
  ).length;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={BIKE_CENTER as Region}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={bikeMapStyle}
      >
        <BikeRouteOverlay
          bikeRoutes={bikeRoutes}
          showExisting={showExisting}
          showPlanned={showPlanned}
        />

        {/* Focus area markers */}
        {Object.entries(BIKE_FOCUS_AREAS).map(([key, area]) => (
          <Marker
            key={key}
            coordinate={{ latitude: area.latitude, longitude: area.longitude }}
            title={area.name}
            pinColor={selectedArea === key ? COLORS.accent : COLORS.bikeRoute}
            onPress={() => setSelectedArea(key)}
          />
        ))}
      </MapView>

      {/* Quick navigation chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContainer}
      >
        {Object.entries(BIKE_FOCUS_AREAS).map(([key, area]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.chip,
              selectedArea === key && styles.chipActive,
            ]}
            onPress={() => focusOnArea(key)}
          >
            <Text
              style={[
                styles.chipText,
                selectedArea === key && styles.chipTextActive,
              ]}
            >
              {area.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter controls */}
      <View style={styles.filterPanel}>
        <TouchableOpacity
          style={[styles.filterButton, showExisting && styles.filterActive]}
          onPress={() => setShowExisting(!showExisting)}
        >
          <View
            style={[styles.filterDot, { backgroundColor: COLORS.bikeRoute }]}
          />
          <Text style={styles.filterText}>
            Existing ({existingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, showPlanned && styles.filterActive]}
          onPress={() => setShowPlanned(!showPlanned)}
        >
          <View
            style={[styles.filterDot, { backgroundColor: COLORS.warning }]}
          />
          <Text style={styles.filterText}>
            Planned ({plannedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Bike Facilities</Text>
        <LegendItem color={COLORS.bikeLane} label="Bike Lane" symbol="solid" />
        <LegendItem color={COLORS.bikePath} label="Bike Path" symbol="solid" />
        <LegendItem color={COLORS.bikeTrail} label="Trail / Greenway" symbol="solid" />
        <LegendItem color="#FFD600" label="Shared Lane" symbol="solid" />
        <LegendItem color={COLORS.textSecondary} label="Planned (dashed)" symbol="dashed" />
      </View>

      {/* Center on user button */}
      <TouchableOpacity
        style={styles.locateButton}
        onPress={() => {
          if (location && mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              },
              500
            );
          }
        }}
      >
        <Ionicons name="navigate" size={22} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

function LegendItem({
  color,
  label,
  symbol,
}: {
  color: string;
  label: string;
  symbol: "solid" | "dashed";
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendLine,
          { backgroundColor: color },
          symbol === "dashed" && styles.legendDashed,
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// Bike-friendly map style emphasizing parks and trails
const bikeMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3C7680" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2c6675" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#0e1626" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e6d70" }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  chipScroll: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    maxHeight: 44,
  },
  chipContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  chipActive: {
    backgroundColor: COLORS.bikeRoute,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.background,
  },
  filterPanel: {
    position: "absolute",
    bottom: 130,
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    opacity: 0.6,
    gap: 6,
  },
  filterActive: {
    opacity: 1,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "500",
  },
  legend: {
    position: "absolute",
    bottom: 20,
    left: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  legendTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    gap: 8,
  },
  legendLine: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  legendDashed: {
    opacity: 0.5,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  locateButton: {
    position: "absolute",
    bottom: 20,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
