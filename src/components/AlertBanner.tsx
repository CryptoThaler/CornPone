import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/config";
import type { ServiceAlert } from "../types/transit";
import { AlertEffect, AlertSeverity } from "../types/transit";

interface AlertBannerProps {
  alerts: ServiceAlert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter((a) => !dismissedIds.has(a.id));

  if (activeAlerts.length === 0) return null;

  const severeAlerts = activeAlerts.filter(
    (a) =>
      a.severity === AlertSeverity.SEVERE ||
      a.effect === AlertEffect.NO_SERVICE ||
      a.effect === AlertEffect.SIGNIFICANT_DELAYS
  );

  const displayAlerts = severeAlerts.length > 0 ? severeAlerts : activeAlerts;
  const alertColor =
    severeAlerts.length > 0 ? COLORS.error : COLORS.warning;

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  return (
    <View style={[styles.container, { backgroundColor: alertColor }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons name="warning" size={18} color="white" />
        <Text style={styles.headerText} numberOfLines={1}>
          {displayAlerts.length === 1
            ? displayAlerts[0].headerText
            : `${activeAlerts.length} Active Service Alert${activeAlerts.length > 1 ? "s" : ""}`}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="white"
        />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.alertList} nestedScrollEnabled>
          {activeAlerts.map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.headerText}</Text>
                {alert.descriptionText ? (
                  <Text style={styles.alertDescription} numberOfLines={3}>
                    {alert.descriptionText}
                  </Text>
                ) : null}
                {alert.informedEntities.length > 0 && (
                  <Text style={styles.alertRoutes}>
                    Routes:{" "}
                    {alert.informedEntities
                      .filter((e) => e.routeId)
                      .map((e) => e.routeId)
                      .join(", ") || "System-wide"}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => dismiss(alert.id)}
                style={styles.dismissButton}
              >
                <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  headerText: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  alertList: {
    maxHeight: 200,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  alertItem: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 13,
    marginBottom: 2,
  },
  alertDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginBottom: 4,
  },
  alertRoutes: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontStyle: "italic",
  },
  dismissButton: {
    paddingLeft: 8,
    justifyContent: "center",
  },
});
