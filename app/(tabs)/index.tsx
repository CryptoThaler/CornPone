import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SA_CENTER } from "../../src/constants/config";
import { useTransitData } from "../../src/hooks/useTransitData";
import { useUserLocation } from "../../src/hooks/useLocation";
import { BusMarker } from "../../src/components/BusMarker";
import { BikeRouteOverlay } from "../../src/components/BikeRouteOverlay";
import { AlertBanner } from "../../src/components/AlertBanner";
import { MapLegend } from "../../src/components/MapLegend";

export default function LiveMapScreen() {
  const {
    vehicles,
    tripUpdates,
    alerts,
    bikeRoutes,
    isLoading,
    lastUpdated,
    refreshAll,
  } = useTransitData();
  const { location } = useUserLocation();
  const mapRef = useRef<MapView>(null);

  const [showBikeRoutes, setShowBikeRoutes] = useState(true);
  const [showBusPositions, setShowBusPositions] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Build delay lookup by vehicle ID
  const delayByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    for (const tu of tripUpdates) {
      if (tu.vehicleId) {
        map.set(tu.vehicleId, tu.delay);
      }
      // Also map by trip ID for matching
      map.set(tu.tripId, tu.delay);
    }
    return map;
  }, [tripUpdates]);

  const getVehicleDelay = useCallback(
    (vehicleId: string, tripId: string) => {
      return delayByVehicle.get(vehicleId) || delayByVehicle.get(tripId) || 0;
    },
    [delayByVehicle]
  );

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  };

  const centerOnSA = () => {
    mapRef.current?.animateToRegion(SA_CENTER as Region, 500);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={SA_CENTER as Region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        customMapStyle={darkMapStyle}
        onPress={() => setSelectedVehicle(null)}
      >
        {/* Live bus positions */}
        {showBusPositions &&
          vehicles.map((vehicle) => (
            <BusMarker
              key={vehicle.vehicleId}
              vehicle={vehicle}
              delay={getVehicleDelay(vehicle.vehicleId, vehicle.tripId)}
              isSelected={selectedVehicle === vehicle.vehicleId}
              onPress={() => setSelectedVehicle(vehicle.vehicleId)}
            />
          ))}

        {/* Bike route overlay */}
        {showBikeRoutes && <BikeRouteOverlay bikeRoutes={bikeRoutes} />}
      </MapView>

      {/* Alerts banner */}
      <View style={styles.overlay}>
        <AlertBanner alerts={alerts} />
      </View>

      {/* Map controls */}
      <MapLegend
        showBikeRoutes={showBikeRoutes}
        showBusPositions={showBusPositions}
        onToggleBikes={() => setShowBikeRoutes(!showBikeRoutes)}
        onToggleBuses={() => setShowBusPositions(!showBusPositions)}
      />

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnUser}>
          <Ionicons name="navigate" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={centerOnSA}>
          <Ionicons name="locate" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={refreshAll}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={22} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {vehicles.length} buses live
          {lastUpdated &&
            ` · Updated ${lastUpdated.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}`}
        </Text>
        {tripUpdates.filter((t) => t.delay > 120).length > 0 && (
          <Text style={[styles.statusText, { color: COLORS.warning }]}>
            {" "}
            · {tripUpdates.filter((t) => t.delay > 120).length} delayed
          </Text>
        )}
      </View>

      {/* Selected vehicle info */}
      {selectedVehicle && (
        <SelectedVehicleInfo
          vehicleId={selectedVehicle}
          vehicles={vehicles}
          delayByVehicle={delayByVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </View>
  );
}

function SelectedVehicleInfo({
  vehicleId,
  vehicles,
  delayByVehicle,
  onClose,
}: {
  vehicleId: string;
  vehicles: any[];
  delayByVehicle: Map<string, number>;
  onClose: () => void;
}) {
  const vehicle = vehicles.find((v) => v.vehicleId === vehicleId);
  if (!vehicle) return null;

  const delay =
    delayByVehicle.get(vehicle.vehicleId) ||
    delayByVehicle.get(vehicle.tripId) ||
    0;
  const delayMinutes = Math.round(delay / 60);
  const speedMph = Math.round(vehicle.speed * 2.237);

  return (
    <View style={infoStyles.container}>
      <View style={infoStyles.header}>
        <View style={infoStyles.routeBadge}>
          <Text style={infoStyles.routeText}>
            {vehicle.label || vehicle.routeId}
          </Text>
        </View>
        <View style={infoStyles.headerInfo}>
          <Text style={infoStyles.title}>Route {vehicle.routeId}</Text>
          <Text style={infoStyles.subtitle}>Vehicle {vehicle.vehicleId}</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={infoStyles.stats}>
        <View style={infoStyles.stat}>
          <Text style={infoStyles.statLabel}>Speed</Text>
          <Text style={infoStyles.statValue}>{speedMph} mph</Text>
        </View>
        <View style={infoStyles.stat}>
          <Text style={infoStyles.statLabel}>Delay</Text>
          <Text
            style={[
              infoStyles.statValue,
              delay > 120 && { color: COLORS.warning },
              delay > 600 && { color: COLORS.error },
            ]}
          >
            {delay <= 60 ? "On Time" : `+${delayMinutes} min`}
          </Text>
        </View>
        <View style={infoStyles.stat}>
          <Text style={infoStyles.statLabel}>Heading</Text>
          <Text style={infoStyles.statValue}>{Math.round(vehicle.bearing)}°</Text>
        </View>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 120,
    left: 12,
    right: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  routeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  routeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "bold",
  },
});

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomControls: {
    position: "absolute",
    bottom: 100,
    right: 12,
    gap: 8,
  },
  controlButton: {
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
  statusBar: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "rgba(26, 26, 46, 0.9)",
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
