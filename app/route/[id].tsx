import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import MapView, { PROVIDER_GOOGLE, Region, Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SA_CENTER } from "../../src/constants/config";
import { useTransitData } from "../../src/hooks/useTransitData";
import { useRouteDelay } from "../../src/hooks/useTransitData";
import { BusMarker } from "../../src/components/BusMarker";

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vehicles, tripUpdates, alerts } = useTransitData();
  const mapRef = useRef<MapView>(null);

  const routeVehicles = useMemo(
    () => vehicles.filter((v) => v.routeId === id),
    [vehicles, id]
  );

  const routeAlerts = useMemo(
    () =>
      alerts.filter((a) =>
        a.informedEntities.some((e) => e.routeId === id)
      ),
    [alerts, id]
  );

  const delayInfo = useRouteDelay(id!, tripUpdates);

  // Build delay lookup for this route's vehicles
  const delayByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    for (const tu of tripUpdates.filter((t) => t.routeId === id)) {
      if (tu.vehicleId) map.set(tu.vehicleId, tu.delay);
      map.set(tu.tripId, tu.delay);
    }
    return map;
  }, [tripUpdates, id]);

  // Calculate map region to fit all vehicles
  const mapRegion = useMemo(() => {
    if (routeVehicles.length === 0) return SA_CENTER;
    const lats = routeVehicles.map((v) => v.latitude);
    const lngs = routeVehicles.map((v) => v.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
    };
  }, [routeVehicles]);

  const statusColor = delayInfo.isSeverelyDelayed
    ? COLORS.error
    : delayInfo.isDelayed
      ? COLORS.warning
      : COLORS.success;

  return (
    <ScrollView style={styles.container}>
      {/* Route header */}
      <View style={styles.header}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeNumber}>{id}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Route {id}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {delayInfo.isSeverelyDelayed
                ? `Severely Delayed (+${Math.round(delayInfo.maxDelay / 60)}min)`
                : delayInfo.isDelayed
                  ? `Delayed (+${Math.round(delayInfo.maxDelay / 60)}min)`
                  : "On Time"}
            </Text>
          </View>
        </View>
      </View>

      {/* Mini map showing route vehicles */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={mapRegion as Region}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {routeVehicles.map((vehicle) => (
            <BusMarker
              key={vehicle.vehicleId}
              vehicle={vehicle}
              delay={
                delayByVehicle.get(vehicle.vehicleId) ||
                delayByVehicle.get(vehicle.tripId) ||
                0
              }
            />
          ))}
        </MapView>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="bus"
          label="Active Buses"
          value={String(routeVehicles.length)}
          color={COLORS.primary}
        />
        <StatCard
          icon="time"
          label="Max Delay"
          value={
            delayInfo.maxDelay > 60
              ? `${Math.round(delayInfo.maxDelay / 60)}min`
              : "0min"
          }
          color={statusColor}
        />
        <StatCard
          icon="speedometer"
          label="Avg Delay"
          value={
            delayInfo.avgDelay > 60
              ? `${Math.round(delayInfo.avgDelay / 60)}min`
              : "0min"
          }
          color={COLORS.textSecondary}
        />
        <StatCard
          icon="warning"
          label="Alerts"
          value={String(routeAlerts.length)}
          color={routeAlerts.length > 0 ? COLORS.warning : COLORS.textSecondary}
        />
      </View>

      {/* Active vehicles list */}
      <Text style={styles.sectionTitle}>Active Vehicles</Text>
      {routeVehicles.length === 0 ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyText}>No active vehicles on this route</Text>
        </View>
      ) : (
        routeVehicles.map((v) => {
          const vDelay =
            delayByVehicle.get(v.vehicleId) ||
            delayByVehicle.get(v.tripId) ||
            0;
          const speedMph = Math.round(v.speed * 2.237);
          return (
            <View key={v.vehicleId} style={styles.vehicleRow}>
              <View style={styles.vehicleIcon}>
                <Ionicons name="bus" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleId}>Vehicle {v.vehicleId}</Text>
                <Text style={styles.vehicleDetail}>
                  {speedMph} mph · Heading {Math.round(v.bearing)}°
                </Text>
              </View>
              <Text
                style={[
                  styles.vehicleDelay,
                  vDelay > 120 && { color: COLORS.warning },
                  vDelay > 600 && { color: COLORS.error },
                ]}
              >
                {vDelay <= 60
                  ? "On Time"
                  : `+${Math.round(vDelay / 60)}min`}
              </Text>
            </View>
          );
        })
      )}

      {/* Route alerts */}
      {routeAlerts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          {routeAlerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Ionicons name="warning" size={18} color={COLORS.warning} />
              <View style={styles.alertInfo}>
                <Text style={styles.alertTitle}>{alert.headerText}</Text>
                {alert.descriptionText ? (
                  <Text style={styles.alertDesc}>{alert.descriptionText}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      )}

      <View style={styles.footer} />
    </ScrollView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  routeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  emptySection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginVertical: 2,
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  vehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleId: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  vehicleDetail: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  vehicleDelay: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: "bold",
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginVertical: 2,
    padding: 12,
    borderRadius: 10,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  alertDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    height: 40,
  },
});
