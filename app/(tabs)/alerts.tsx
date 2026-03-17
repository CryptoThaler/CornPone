import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/config";
import { useTransitData } from "../../src/hooks/useTransitData";
import type { ServiceAlert } from "../../src/types/transit";
import { AlertEffect, AlertSeverity } from "../../src/types/transit";

export default function AlertsScreen() {
  const { alerts, tripUpdates, isLoading, refreshAll } = useTransitData();

  // Build delay summary per route
  const delayedRoutes = new Map<string, { maxDelay: number; trips: number }>();
  for (const tu of tripUpdates) {
    if (tu.delay > 120) {
      const existing = delayedRoutes.get(tu.routeId) || {
        maxDelay: 0,
        trips: 0,
      };
      existing.trips++;
      if (tu.delay > existing.maxDelay) existing.maxDelay = tu.delay;
      delayedRoutes.set(tu.routeId, existing);
    }
  }

  const delayAlerts = Array.from(delayedRoutes.entries())
    .sort((a, b) => b[1].maxDelay - a[1].maxDelay)
    .map(([routeId, data]) => ({
      type: "delay" as const,
      routeId,
      ...data,
    }));

  return (
    <View style={styles.container}>
      <FlatList
        data={[
          ...alerts.map((a) => ({ type: "alert" as const, alert: a })),
          ...delayAlerts.map((d) => ({ type: "delay" as const, delay: d })),
        ]}
        keyExtractor={(item, index) =>
          item.type === "alert" ? item.alert.id : `delay-${index}`
        }
        renderItem={({ item }) =>
          item.type === "alert" ? (
            <AlertItem alert={item.alert} />
          ) : (
            <DelayItem
              routeId={item.delay!.routeId}
              maxDelay={item.delay!.maxDelay}
              trips={item.delay!.trips}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshAll}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Service Alerts & Delays</Text>
            <Text style={styles.headerSubtitle}>
              {alerts.length} alert{alerts.length !== 1 ? "s" : ""} ·{" "}
              {delayedRoutes.size} delayed route{delayedRoutes.size !== 1 ? "s" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="checkmark-circle"
              size={56}
              color={COLORS.success}
            />
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptyText}>
              No service alerts or significant delays right now.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function AlertItem({ alert }: { alert: ServiceAlert }) {
  const isSevere =
    alert.severity === AlertSeverity.SEVERE ||
    alert.effect === AlertEffect.NO_SERVICE;

  const iconName =
    alert.effect === AlertEffect.NO_SERVICE
      ? "close-circle"
      : alert.effect === AlertEffect.DETOUR
        ? "git-branch"
        : alert.effect === AlertEffect.SIGNIFICANT_DELAYS
          ? "time"
          : "information-circle";

  const borderColor = isSevere ? COLORS.error : COLORS.warning;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.cardHeader}>
        <Ionicons
          name={iconName as any}
          size={22}
          color={borderColor}
        />
        <Text style={styles.cardTitle}>{alert.headerText}</Text>
      </View>
      {alert.descriptionText ? (
        <Text style={styles.cardDescription}>{alert.descriptionText}</Text>
      ) : null}
      {alert.informedEntities.length > 0 && (
        <View style={styles.routeTags}>
          {alert.informedEntities
            .filter((e) => e.routeId)
            .map((e, i) => (
              <View key={i} style={styles.routeTag}>
                <Text style={styles.routeTagText}>Route {e.routeId}</Text>
              </View>
            ))}
        </View>
      )}
      {alert.activePeriods.length > 0 && alert.activePeriods[0].start && (
        <Text style={styles.timeText}>
          Since{" "}
          {new Date(alert.activePeriods[0].start * 1000).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      )}
    </View>
  );
}

function DelayItem({
  routeId,
  maxDelay,
  trips,
}: {
  routeId: string;
  maxDelay: number;
  trips: number;
}) {
  const minutes = Math.round(maxDelay / 60);
  const isSevere = maxDelay > 600;
  const borderColor = isSevere ? COLORS.error : COLORS.warning;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.cardHeader}>
        <Ionicons name="time" size={22} color={borderColor} />
        <Text style={styles.cardTitle}>Route {routeId} Delayed</Text>
        <View
          style={[
            styles.delayBadge,
            { backgroundColor: borderColor + "22" },
          ]}
        >
          <Text style={[styles.delayBadgeText, { color: borderColor }]}>
            +{minutes}min
          </Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>
        {trips} trip{trips > 1 ? "s" : ""} running behind schedule. Maximum
        delay: {minutes} minutes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  cardDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 30,
  },
  routeTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginLeft: 30,
  },
  routeTag: {
    backgroundColor: COLORS.primary + "33",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  routeTagText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  timeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 30,
  },
  delayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  delayBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
