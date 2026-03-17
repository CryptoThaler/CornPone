import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/config";

interface MapLegendProps {
  showBikeRoutes: boolean;
  showBusPositions: boolean;
  onToggleBikes: () => void;
  onToggleBuses: () => void;
}

export function MapLegend({
  showBikeRoutes,
  showBusPositions,
  onToggleBikes,
  onToggleBuses,
}: MapLegendProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Ionicons name="layers" size={20} color="white" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.legend}>
          <Text style={styles.title}>Map Layers</Text>

          <TouchableOpacity style={styles.row} onPress={onToggleBuses}>
            <View
              style={[
                styles.checkbox,
                showBusPositions && styles.checkboxActive,
              ]}
            >
              {showBusPositions && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <Ionicons name="bus" size={16} color={COLORS.busActive} />
            <Text style={styles.label}>Live Buses</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={onToggleBikes}>
            <View
              style={[
                styles.checkbox,
                showBikeRoutes && styles.checkboxActive,
              ]}
            >
              {showBikeRoutes && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <Ionicons name="bicycle" size={16} color={COLORS.bikeRoute} />
            <Text style={styles.label}>Bike Routes</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <Text style={styles.subtitle}>Bus Status</Text>
          <LegendItem color={COLORS.busActive} label="On Time" />
          <LegendItem color={COLORS.warning} label="Delayed" />
          <LegendItem color={COLORS.error} label="Severely Delayed" />

          <View style={styles.separator} />
          <Text style={styles.subtitle}>Bike Facilities</Text>
          <LegendLine color={COLORS.bikeLane} label="Bike Lane" />
          <LegendLine color={COLORS.bikePath} label="Bike Path" />
          <LegendLine color={COLORS.bikeTrail} label="Trail / Greenway" />
          <LegendLine color="#FFD600" label="Shared Lane" />
        </View>
      )}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    right: 12,
    alignItems: "flex-end",
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  legend: {
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
