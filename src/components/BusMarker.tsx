import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import { COLORS } from "../constants/config";
import type { VehiclePosition } from "../types/transit";

interface BusMarkerProps {
  vehicle: VehiclePosition;
  delay?: number; // seconds
  onPress?: () => void;
  isSelected?: boolean;
}

export function BusMarker({ vehicle, delay = 0, onPress, isSelected }: BusMarkerProps) {
  const isDelayed = delay > 120;
  const isSeverelyDelayed = delay > 600;

  const markerColor = isSeverelyDelayed
    ? COLORS.error
    : isDelayed
      ? COLORS.warning
      : COLORS.busActive;

  const delayMinutes = Math.round(delay / 60);

  return (
    <Marker
      coordinate={{
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      }}
      rotation={vehicle.bearing}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[styles.container, isSelected && styles.selected]}>
        <View style={[styles.marker, { backgroundColor: markerColor }]}>
          <Text style={styles.routeText}>
            {vehicle.label || vehicle.routeId || "?"}
          </Text>
        </View>
        {isDelayed && (
          <View style={[styles.delayBadge, isSeverelyDelayed && styles.severeBadge]}>
            <Text style={styles.delayText}>+{delayMinutes}m</Text>
          </View>
        )}
        <View style={[styles.arrow, { borderTopColor: markerColor }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  selected: {
    transform: [{ scale: 1.2 }],
  },
  marker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  routeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  delayBadge: {
    position: "absolute",
    top: -8,
    right: -12,
    backgroundColor: COLORS.warning,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 28,
    alignItems: "center",
  },
  severeBadge: {
    backgroundColor: COLORS.error,
  },
  delayText: {
    color: "white",
    fontSize: 9,
    fontWeight: "bold",
  },
});
