import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/config";
import type { TransitRoute } from "../types/transit";

interface RouteCardProps {
  route: TransitRoute;
  onPress?: () => void;
}

export function RouteCard({ route, onPress }: RouteCardProps) {
  const delayMinutes = Math.round(route.maxDelay / 60);
  const isDelayed = route.maxDelay > 120;
  const isSeverelyDelayed = route.maxDelay > 600;

  const statusColor = isSeverelyDelayed
    ? COLORS.error
    : isDelayed
      ? COLORS.warning
      : COLORS.success;

  const statusText = isSeverelyDelayed
    ? `${delayMinutes}min late`
    : isDelayed
      ? `${delayMinutes}min late`
      : "On Time";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.routeBadge, { backgroundColor: COLORS.primary }]}>
        <Text style={styles.routeNumber}>{route.shortName}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.routeName} numberOfLines={1}>
          {route.longName}
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="bus" size={14} color={COLORS.textSecondary} />
            <Text style={styles.statText}>
              {route.activeVehicles} active
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>

      {route.hasAlerts && (
        <Ionicons
          name="warning"
          size={20}
          color={COLORS.warning}
          style={styles.alertIcon}
        />
      )}

      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 4,
    gap: 12,
  },
  routeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
  },
  routeName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  alertIcon: {
    marginRight: 4,
  },
});
